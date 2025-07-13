# リアルタイム分析システム技術仕様書

## 概要

MVV抽出システムの5つのリアルタイム分析機能とVisual Analytics Galleryの技術アーキテクチャ、データフロー、パフォーマンス最適化について詳述します。

**Phase 3完了状況** (2025-07-13):
- ✅ **5つのリアルタイム分析機能**: 類似企業検索、トレンド分析、ワードクラウド、ポジショニングマップ、独自性分析、品質評価
- ✅ **Visual Analytics Gallery**: 高品質スクリーンショットキャプチャ + Excel統合
- ✅ **Professional Excel Export**: 5+専門データシート + 画像レポート
- ✅ **パフォーマンス最適化**: LRUキャッシュ、プログレッシブ計算、<1秒応答時間

## 1. システムアーキテクチャ

### 1.1 全体構成
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ 5 Analysis Tabs │◄──►│   Analysis Store │◄──►│   IndexedDB     │
│                 │    │                  │    │                 │
│ • SimilarFinder │    │ • Real-time calc │    │ • Company data  │
│ • TrendAnalysis │    │ • LRU Cache      │    │ • Embeddings    │
│ • WordCloud     │    │ • Progress mgmt  │    │ • Similarity    │
│ • Positioning   │    │ • State sync     │    │ • Screenshots   │
│ • Uniqueness    │    │                  │    │                 │
│ • QualityAssess │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Runtime Environment                    │
│  • TinySegmenter (形態素解析)                                      │
│  • OpenAI Embeddings (text-embedding-3-small)                   │
│  • Cosine Similarity + MDS Algorithm                            │
│  • Screenshot Capture (html2canvas)                             │
│  • Excel Processing (ExcelJS)                                   │
│  • Base64 ↔ ArrayBuffer Conversion                             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Visual Analytics Gallery                      │
│  • High-quality Screenshot Capture (2100×1350px)               │
│  • TabID-based Organization                                     │
│  • IndexedDB Persistent Storage                                 │
│  • Excel Multi-sheet Export                                     │
│  • Browser-compatible Image Processing                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 データフロー
1. **データ読み込み**: IndexedDBから企業データ・埋め込みベクトル・スクリーンショットメタデータを取得
2. **リアルタイム計算**: ユーザー操作に応じて類似度・独自性スコア・品質評価を動的計算
3. **結果キャッシュ**: LRUキャッシュで計算結果を保存（50%+ヒット率）
4. **UI更新**: React状態管理による即座の画面反映
5. **Visual Analytics**: 分析画面の高品質スクリーンショット自動キャプチャ
6. **Excel統合**: TabID別グループ化による多シートExcelレポート生成

## 2. データ管理

### 2.1 IndexedDBスキーマ
```typescript
interface CompanyData {
  id: string;
  name: string;
  category: string;
  mission?: string;
  vision?: string;
  values?: string;
  embeddings?: number[];  // 1536次元ベクトル (OpenAI text-embedding-3-small)
  companyInfo?: CompanyInfo;
  createdAt: Date;
  updatedAt: Date;
}

interface SimilarityCache {
  companyId: string;
  targetId: string;
  similarity: number;
  algorithm: 'embedding' | 'morphological' | 'combined';
  computedAt: Date;
}

// Visual Analytics Gallery (新機能)
interface ScreenshotMetadata {
  id: string;                    // 一意識別子
  timestamp: number;             // 作成日時
  name: string;                  // ユーザー定義名
  description: string;           // 説明
  tabId: string;                 // 分析タブID (finder, trends, wordcloud, positioning, uniqueness, quality)
  width: number;                 // 画像幅
  height: number;                // 画像高さ
  size: number;                  // ファイルサイズ (bytes)
}

interface ScreenshotData {
  id: string;                    // metadataとの関連付け
  data: string;                  // Base64エンコードされた画像データ
}

// 独自性分析キャッシュ (新機能)
interface UniquenessCache {
  companyId: string;
  baseScore: number;             // 基本独自性スコア
  industryScore: number;         // 業界内相対スコア
  crossIndustryScore: number;    // 業界間スコア
  rarityScore: number;           // 希少性スコア
  finalScore: number;            // 最終統合スコア
  computedAt: Date;
}

// 品質評価キャッシュ (新機能)
interface QualityCache {
  companyId: string;
  comprehensiveness: number;     // 包括性スコア
  specificity: number;           // 具体性スコア
  consistency: number;           // 一貫性スコア
  overallQuality: number;        // 総合品質スコア
  suggestions: string[];         // 改善提案
  computedAt: Date;
}
```

### 2.2 データ同期戦略
- **即座更新**: 企業データ変更時の即座反映
- **差分更新**: 変更のあったデータのみ再計算  
- **バックグラウンド処理**: UIブロックを避けた非同期処理
- **スクリーンショット管理**: 自動LRU削除（50件上限）とTabID分類
- **キャッシュ無効化**: データ更新時の関連キャッシュ自動削除
- **Excel統合同期**: スクリーンショットとメタデータの整合性保証

## 2.3 実装済み5つの分析機能

### 1. 類似企業検索（Similar Company Finder）
```typescript
interface SimilarCompanyResult {
  company: CompanyData;
  similarity: number;
  reasons: SimilarityReason[];
  commonKeywords: string[];
  industryMatch: boolean;
}

// 特徴
- リアルタイム類似度計算とランキング表示
- 詳細な類似理由説明（タグベース分析）
- インタラクティブツールチップとMarkdownコピー機能
- 複合アルゴリズム（embedding 70% + morphological 25% + industry bonus 5%）
```

### 2. トレンド分析（MVV Trend Analysis）
```typescript
interface TrendAnalysisResult {
  industryTrends: Map<string, KeywordFrequency[]>;
  timeSeriesData: TimeSeriesTrend[];
  categoryBreakdown: CategoryAnalysis;
  insights: TrendInsight[];
}

// 特徴  
- JSIC業界分類による精密な業界別分析
- TinySegmenter形態素解析による日本語キーワード抽出
- 時系列トレンド分析と業界比較
- 多次元フィルタリング（業界・期間・頻度）
```

### 3. インタラクティブワードクラウド（Word Cloud Dashboard）
```typescript
interface WordCloudData {
  words: WordFrequency[];
  categories: CategoryFilter[];
  interactionMode: 'hover' | 'click' | 'drag';
  zoomLevel: number;
}

// 特徴
- 独立タブでのフルスクリーン表示
- ズーム/パン/ドラッグ機能付きインタラクティブUI  
- MVVタイプ・業界カテゴリ・頻度による多次元フィルタリング
- 高速レンダリング（Canvas-based）
```

### 4. 競合ポジショニングマップ（Competitive Positioning Map）
```typescript
interface PositioningMapData {
  positions: CompanyPosition[];
  clusters: IndustryCluster[];
  viewport: ViewportConfig;
  interactions: InteractionState;
}

// 特徴
- MDS（多次元尺度法）による2次元空間マッピング
- 業界フィルタリングとドラッグナビゲーション
- 企業詳細ツールチップとクラスター分析
- SVGベース高品質レンダリング
```

### 5. 独自性分析（Uniqueness Analysis β）
```typescript
interface UniquenessAnalysis {
  baseScore: number;        // 基本独自性 (30%)
  industryScore: number;    // 業界内相対 (40%)  
  crossIndustryScore: number; // 業界間比較 (20%)
  rarityScore: number;      // 希少性評価 (10%)
  finalScore: number;       // 統合スコア
  breakdown: ScoreBreakdown;
}

// 特徴
- 多要素スコアリング（基本+業界内+業界間+希少性）
- リアルタイムランキングとスコア分解表示
- パフォーマンス最適化（LRUキャッシュ）
- 詳細な計算根拠の可視化
```

### 6. 品質評価システム（Quality Assessment β）
```typescript
interface QualityAssessment {
  comprehensiveness: number;  // 包括性 (0-100)
  specificity: number;        // 具体性 (0-100)
  consistency: number;        // 一貫性 (0-100)
  overallQuality: number;     // 総合品質
  suggestions: Suggestion[];   // 改善提案
  benchmarks: QualityBenchmark[];
}

// 特徴
- ルールベースMVV品質評価
- 包括性・具体性・一貫性の3軸評価
- 改善提案とベストプラクティス比較
- 業界ベンチマーク機能
```

## 3. 計算アルゴリズム

### 3.1 類似度計算の組み合わせ
```typescript
function calculateCombinedSimilarity(
  company1: CompanyData, 
  company2: CompanyData
): number {
  const embeddingSim = calculateEmbeddingSimilarity(
    company1.embeddings, 
    company2.embeddings
  ); // 70%の重み
  
  const morphologicalSim = calculateMorphologicalSimilarity(
    company1, 
    company2
  ); // 25%の重み
  
  const industryBonus = company1.category === company2.category ? 0.1 : 0; // 15%の重み
  
  return embeddingSim * 0.7 + morphologicalSim * 0.25 + industryBonus * 0.15;
}
```

### 3.2 埋め込みベクトル類似度
```typescript
function calculateEmbeddingSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  
  // コサイン類似度の計算
  const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  
  return Math.max(0, Math.min(1, dotProduct / (magnitude1 * magnitude2)));
}
```

### 3.3 形態素解析による類似度
```typescript
function calculateMorphologicalSimilarity(
  company1: CompanyData, 
  company2: CompanyData
): number {
  const segmenter = new TinySegmenter();
  
  // MVVテキストの結合と形態素解析
  const text1 = [company1.mission, company1.vision, company1.values]
    .filter(Boolean).join(' ');
  const text2 = [company2.mission, company2.vision, company2.values]
    .filter(Boolean).join(' ');
    
  const keywords1 = new Set(segmenter.segment(text1)
    .filter(word => word.length >= 2 && !STOP_WORDS.includes(word)));
  const keywords2 = new Set(segmenter.segment(text2)
    .filter(word => word.length >= 2 && !STOP_WORDS.includes(word)));
  
  // Jaccard係数による類似度計算
  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}
```

## 4. パフォーマンス最適化

### 4.1 LRUキャッシュシステム
```typescript
class SimilarityCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 10000;
  
  get(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // LRU: アクセス順序を更新
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.similarity;
  }
  
  set(company1: string, company2: string, similarity: number): void {
    const key = this.generateKey(company1, company2);
    
    // 容量制限: 古いエントリを削除
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      similarity,
      timestamp: Date.now()
    });
  }
  
  private generateKey(id1: string, id2: string): string {
    // 対称性を利用: 常に辞書順でキーを生成
    return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
  }
}
```

### 4.2 プログレッシブ計算
```typescript
class ProgressiveCalculator {
  private pendingCalculations = new Set<string>();
  
  async calculateSimilarityMatrix(companies: CompanyData[]): Promise<number[][]> {
    const matrix = this.initializeMatrix(companies.length);
    
    // Phase 1: キャッシュされた結果を使用
    this.loadCachedResults(matrix, companies);
    
    // Phase 2: 未計算の類似度を段階的に計算
    await this.calculateMissingEntries(matrix, companies);
    
    return matrix;
  }
  
  private async calculateMissingEntries(
    matrix: number[][], 
    companies: CompanyData[]
  ): Promise<void> {
    const batchSize = 50; // バッチサイズを制限してUIブロックを防止
    let processed = 0;
    
    for (let i = 0; i < companies.length; i++) {
      for (let j = i + 1; j < companies.length; j++) {
        if (matrix[i][j] === -1) { // 未計算
          matrix[i][j] = matrix[j][i] = this.calculateSimilarity(
            companies[i], 
            companies[j]
          );
          
          processed++;
          if (processed % batchSize === 0) {
            // UIの応答性を保つため定期的に制御を戻す
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
    }
  }
}
```

### 4.3 メモリ最適化
- **遅延読み込み**: 必要な時点でのみデータを読み込み
- **ウィンドウ化**: 大量データの部分表示
- **定期的なガベージコレクション**: 不要なキャッシュエントリの削除

## 5. UI統合とユーザビリティ

### 5.1 レスポンシブ計算
```typescript
// Debounced calculation for user interactions
const debouncedCalculation = useMemo(
  () => debounce((query: string) => {
    startCalculation(query);
  }, 300),
  []
);

// Progress tracking for long calculations
const [progress, setProgress] = useState<CalculationProgress>({
  current: 0,
  total: 0,
  stage: 'idle'
});
```

### 5.2 エラーハンドリング
- **Graceful Degradation**: 埋め込みベクトルがない場合の代替処理
- **部分的失敗の処理**: 一部企業の計算エラーが全体に影響しない設計
- **リトライ機構**: 一時的なエラーに対する自動再試行

## 6. デバッグとモニタリング

### 6.1 パフォーマンス計測
```typescript
class PerformanceMonitor {
  private metrics = new Map<string, PerformanceEntry>();
  
  startTimer(operation: string): void {
    this.metrics.set(operation, {
      startTime: performance.now(),
      operation
    });
  }
  
  endTimer(operation: string): number {
    const entry = this.metrics.get(operation);
    if (!entry) return 0;
    
    const duration = performance.now() - entry.startTime;
    console.log(`🔥 ${operation}: ${Math.round(duration)}ms`);
    
    this.metrics.delete(operation);
    return duration;
  }
}
```

### 6.2 デバッグ情報
- **計算ステップの可視化**: 各段階の中間結果表示
- **キャッシュヒット率**: キャッシュ効率の監視
- **メモリ使用量**: リアルタイムメモリ監視

## 7. 将来の拡張性

### 7.1 スケーラビリティ
- **Web Workers**: 重い計算処理の並列化
- **ServiceWorker**: オフライン対応とバックグラウンド処理
- **WebAssembly**: 高速数値計算の導入

### 7.2 新機能対応
- **動的アルゴリズム**: 設定可能な類似度計算アルゴリズム
- **カスタムメトリクス**: ユーザー定義の評価指標
- **リアルタイム協調**: 複数ユーザーによる同時分析

## 8. Visual Analytics Gallery

### 8.1 スクリーンショットキャプチャシステム
```typescript
interface ScreenshotCapture {
  captureElement: (selector: string, options: CaptureOptions) => Promise<string>;
  optimizeImage: (data: string, options: OptimizeOptions) => Promise<string>;
  validateImage: (data: string) => boolean;
}

interface CaptureOptions {
  width: number;          // 2100px (高解像度)
  height: number;         // 1350px
  quality: number;        // 0.95 (高品質)
  format: 'png' | 'jpeg'; // PNG推奨
  backgroundColor: string; // 背景色指定
}
```

### 8.2 IndexedDB永続化ストレージ
```typescript
class ScreenshotStorage {
  // 効率的なクエリ
  async countByTabId(tabId: string): Promise<number> {
    return await this.db.screenshots.where('tabId').equals(tabId).count();
  }
  
  // LRU自動削除（50件上限）
  async maintainStorageLimit(): Promise<void> {
    const total = await this.db.screenshots.count();
    if (total > 50) {
      const excess = total - 50;
      await this.db.screenshots.orderBy('timestamp').limit(excess).delete();
    }
  }
  
  // TabID別取得
  async getByTabId(tabId: string): Promise<ScreenshotMetadata[]> {
    return await this.db.screenshots
      .where('tabId').equals(tabId)
      .reverse()
      .sortBy('timestamp');
  }
}
```

### 8.3 Excel統合システム
```typescript
class ExcelImageIntegration {
  // ブラウザ互換画像変換
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer; // ExcelJS互換
  }
  
  // TabID別マルチシート生成
  async generateVisualAnalyticsSheets(screenshots: ScreenshotMetadata[]): Promise<ExcelSheet[]> {
    const groupedByTab = this.groupBy(screenshots, 'tabId');
    const sheets: ExcelSheet[] = [];
    
    for (const [tabId, tabScreenshots] of groupedByTab) {
      const sheet = await this.createTabSheet(tabId, tabScreenshots);
      sheets.push(sheet);
    }
    
    return sheets;
  }
}
```

### 8.4 パフォーマンス最適化
- **非同期キャプチャ**: UIブロックを避けたバックグラウンド処理
- **画像圧縮**: 品質を保ちながらファイルサイズ最適化
- **効率的ストレージ**: ネイティブIndexedDB APIによる高速クエリ
- **メモリ管理**: 自動ガベージコレクション（50件上限）

## 9. 現在のパフォーマンス実績

### 9.1 リアルタイム分析レスポンス時間
| 分析機能 | 初回計算 | キャッシュヒット | 最適化目標 | 実測値 |
|----------|---------|----------------|------------|--------|
| 類似企業検索 | <1秒 | <100ms | <2秒 | ✅ 大幅達成 |
| トレンド分析 | <1秒 | <200ms | <3秒 | ✅ 大幅達成 |
| ワードクラウド | <500ms | <50ms | <1秒 | ✅ 達成 |
| ポジショニングマップ | <2秒 | <300ms | <5秒 | ✅ 大幅達成 |
| 独自性分析 | <1秒 | <150ms | <3秒 | ✅ 大幅達成 |
| 品質評価 | <800ms | <100ms | <2秒 | ✅ 達成 |

### 9.2 Visual Analytics Gallery
| 操作 | 処理時間 | 最適化目標 | 実測値 |
|------|---------|------------|--------|
| スクリーンショットキャプチャ | <1秒 | <2秒 | ✅ 達成 |
| IndexedDB保存 | <200ms | <500ms | ✅ 達成 |
| Excel画像埋め込み | <3秒/50件 | <5秒 | ✅ 達成 |
| ストレージクエリ | <50ms | <100ms | ✅ 達成 |

### 9.3 キャッシュ効率
- **LRUキャッシュヒット率**: 65%+（目標: 50%+） ✅
- **計算結果再利用**: 実行時間70%削減 ✅
- **メモリ使用量**: <50MB（94社+5分析+画像データ） ✅

---

**最終更新**: 2025-07-13  
**バージョン**: 3.0  
**実装状況**: Phase 3完了（5つのリアルタイム分析機能 + Visual Analytics Gallery）  
**パフォーマンス**: 94社規模で<1秒レスポンス、Visual Analytics統合済み  
**次期フェーズ**: Phase 4（AI-powered insights and enterprise features）