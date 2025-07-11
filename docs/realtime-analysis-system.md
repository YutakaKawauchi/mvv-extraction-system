# リアルタイム分析システム技術仕様書

## 概要

MVV抽出システムのリアルタイム分析機能の技術アーキテクチャ、データフロー、パフォーマンス最適化について詳述します。

## 1. システムアーキテクチャ

### 1.1 全体構成
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UI Components │◄──►│   Analysis Store │◄──►│   IndexedDB     │
│                 │    │                  │    │                 │
│ - Dashboard     │    │ - Real-time calc │    │ - Company data  │
│ - Word Cloud    │    │ - LRU Cache      │    │ - Embeddings    │
│ - Positioning   │    │ - Progress mgmt  │    │ - Similarity    │
│ - Uniqueness    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Runtime Environment                    │
│  - TinySegmenter (形態素解析)                                      │
│  - OpenAI Embeddings (text-embedding-3-small)                   │
│  - Cosine Similarity Calculation                                │
│  - MDS Algorithm (多次元尺度法)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 データフロー
1. **データ読み込み**: IndexedDBから企業データと埋め込みベクトルを取得
2. **リアルタイム計算**: ユーザー操作に応じて類似度やスコアを動的計算
3. **結果キャッシュ**: LRUキャッシュで計算結果を保存
4. **UI更新**: React状態管理による即座の画面反映

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
```

### 2.2 データ同期戦略
- **即座更新**: 企業データ変更時の即座反映
- **差分更新**: 変更のあったデータのみ再計算
- **バックグラウンド処理**: UIブロックを避けた非同期処理

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

---

**最終更新**: 2025-07-11  
**バージョン**: 2.0  
**実装状況**: 本番環境稼働中  
**パフォーマンス**: 100社規模で <3秒処理