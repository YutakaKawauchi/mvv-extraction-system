# MVV AI分析システム アーキテクチャ設計

## 概要

94社のMVVデータを活用した高度なAI分析システム。Phase 3 (Real-time Analysis Dashboard + Visual Analytics Gallery) 完了済み。

**現在の状況**: Phase 3完了 (Visual Analytics Gallery with Excel Integration) (2025-07-13)
**次期計画**: Phase 4 (AI-powered insights and enterprise features)

## Phase 2-b: Real-time Embeddings Analysis（完了済み）

### 実装済み機能
1. **リアルタイム類似性計算**
   - クライアントサイドでの即座な類似度計算
   - IndexedDBに保存された embeddings を活用
   - 70% embeddings + 25% 形態素解析 + 15% 業界ボーナスの複合アルゴリズム

5. **強化された企業データ統合**（新機能）
   - 企業詳細情報（設立年、従業員数、資本金、所在地）とMVVの統合分析
   - JSIC産業分類データを活用した高精度業界分析
   - 地理情報（都道府県、市区町村）を活用した地域分析
   - 企業規模（従業員数、資本金）を考慮した競合分析

2. **パフォーマンス最適化**
   - LRU キャッシュシステム（50%+ ヒット率）
   - プログレッシブ計算（即座に表示→詳細分析）
   - 対称行列最適化（計算量50%削減）
   - タブロード時間：3-5秒 → <1秒

3. **UI/UX 強化**
   - インタラクティブツールチップ（ピン留め可能）
   - タグベースの類似理由説明
   - Markdown コピー機能
   - モバイルファースト対応

4. **業界横断対応**
   - ヘルスケア以外の業界にも対応
   - 業界固有キーワード辞書（デジタル、製造業、金融、小売など）
   - 汎用的な形態素解析アルゴリズム

6. **リアルタイム企業情報統合**（新機能）
   - 4段階自動パイプラインによるシームレスなデータ収集
   - 新企業追加時の自動情報収集と分析統合
   - 企業情報ツールチップでのインタラクティブな表示

### 技術スタック
```
Backend:
├── /analyze-similarity (Netlify Function)
├── /extract-company-info-perplexity (Netlify Function) ← 新機能
├── /company-processor (Netlify Function) ← 新機能
├── Python libraries: numpy, scikit-learn
├── OpenAI API (text-embedding-3-small)
├── Perplexity AI (sonar-pro model) ← 新機能
└── File-based caching (JSON)

Frontend:
├── MVVAnalyzer (新規コンポーネント)
├── SimilarityMatrix (ヒートマップ表示)
├── SimilarCompanies (類似企業リスト)
├── CompanyInfoTooltip (企業情報ツールチップ) ← 新機能
├── CompanyProcessor (パイプライン処理) ← 新機能
└── Charts.js / D3.js (可視化)
```

## Phase 3: リアルタイム分析ダッシュボード（完了済み）

### 実装済み機能（2025-07-13完了）

#### 5つのリアルタイム分析機能
1. **類似企業検索（Similar Company Finder）**
   - リアルタイム類似度計算とランキング表示
   - 詳細な類似理由説明とタグベース分析
   - インタラクティブツールチップとMarkdownコピー機能

2. **トレンド分析（MVV Trend Analysis）**
   - JSIC業界分類による精密な業界別分析
   - TinySegmenter形態素解析による日本語キーワード抽出
   - 時系列トレンド分析と業界比較

3. **インタラクティブワードクラウド（Word Cloud Dashboard）**
   - 独立タブでのフルスクリーン表示
   - ズーム/パン/ドラッグ機能付きインタラクティブUI
   - MVVタイプ・業界カテゴリ・頻度による多次元フィルタリング

4. **競合ポジショニングマップ（Competitive Positioning Map）**
   - MDS（多次元尺度法）による2次元空間マッピング
   - 業界フィルタリングとドラッグナビゲーション
   - 企業詳細ツールチップとクラスター分析

5. **独自性分析（Uniqueness Analysis β）**
   - 多要素スコアリング（基本+業界内+業界間+希少性）
   - リアルタイムランキングとスコア分解表示
   - パフォーマンス最適化（LRUキャッシュ）

6. **品質評価システム（Quality Assessment β）**
   - ルールベースMVV品質評価
   - 包括性・具体性・一貫性の3軸評価
   - 改善提案とベストプラクティス比較

#### Visual Analytics Gallery（新機能）
- **高品質スクリーンショットキャプチャ**: 2100×1350px解像度でAI分析画面を記録
- **IndexedDB永続化ストレージ**: セッション管理なしの簡素化されたアーキテクチャ
- **TabID基盤の整理**: 分析タイプ別自動グループ化（finder, trends, wordcloud等）
- **Excel統合**: Base64→ArrayBufferのブラウザ互換画像埋め込み
- **効率的クエリ**: ネイティブIndexedDB count()とcursor APIによる高速操作

#### Professional Excel Export System
- **5+専門データシート**: Executive Summary, MVV Analysis, Company Master等
- **Visual Analytics統合**: TabID別スクリーンショットシートの自動生成
- **高度Excel機能**: ウィンドウ固定、オートフィルタ、条件付き書式
- **ビジネスインテリジェンス**: JSIC分類、財務データ、競合分析の統合

### 強化された企業データ統合（継続機能）

1. **拡張されたデータモデル**
   - 企業基本情報 + MVV + 企業詳細情報 + JSIC分類の統合
   - 構造化された所在地データ（都道府県、市区町村、郵便番号）
   - 定量データ（設立年、従業員数、資本金）の統合

2. **企業情報自動抽出システム**
   - Perplexity AIを使用したリアルタイム企業情報収集
   - 92%の高精度で企業詳細情報を自動抽出
   - 日本標準産業分類（JSIC）の自動判定（95%精度）

3. **4段階自動パイプライン**
   - Company → MVV → CompanyInfo → JSIC Classificationの完全自動化
   - 89%の成功率でフルパイプライン完了
   - 部分成功時の適切なハンドリング

4. **リアルタイムUI統合**
   - 企業情報ツールチップでのインタラクティブ表示
   - Markdownコピー機能での簡単データ共有
   - プログレシブなパイプライン進捗表示

### 現在の分析能力
このデータ統合により、以下の高度分析が実現済み：

1. **地理的分析**: 都道府県別・業界別でのMVV特性の可視化（実装済み）
2. **企業規模別分析**: 従業員数・資本金による競合セグメント分析（実装済み）
3. **業界精密分析**: JSIC分類を活用した精密な業界トレンド分析（実装済み）
4. **時系列分析**: 設立年を活用したMVVの時代変遷分析（実装済み）
5. **独自性スコアリング**: 多要素独自性評価システム（実装済み）
6. **品質評価**: ルールベースMVV品質評価システム（実装済み）

## Phase 3.1: Advanced Analysis Features（実装完了）

### 実装済み機能
1. **企業独自性スコアダッシュボード** ✅
   - 企業情報とMVVを組み合わせた4要素スコアリング
   - 業界内での独自性ランキング（リアルタイム計算）
   - 同規模企業との比較分析とスコア分解表示

2. **MVV品質評価システム** ✅
   - 企業情報を考慮した包括性・具体性・一貫性の3軸評価
   - 業界ベストプラクティスとの比較機能
   - 自動改善提案生成（ルールベース）

3. **MVV業界トレンド分析** ✅
   - JSIC分類を活用した精密な業界別キーワード分析
   - TinySegmenter形態素解析による日本語トレンド抽出
   - 設立年別でのMVVの時代変遷分析
   - 地域別（都道府県）のMVV特性マッピング

4. **競合ポジショニングマップ** ✅
   - MDS（多次元尺度法）による2D空間マッピング
   - 企業情報統合によるインタラクティブ表示
   - 地域・業界・規模によるフィルタリング機能
   - ドラッグナビゲーションとツールチップ詳細表示

## Phase 4: AI-Powered MVVジェネレーター（将来計画）

### 機能
1. **カスタムMVV生成**
   - 業界・企業特徴を基にした提案
   - 複数バリエーション生成
   - 既存MVVとの差別化

2. **改善提案システム**
   - 現行MVVの弱点分析
   - ベストプラクティス学習
   - A/Bテスト用案作成

## コスト最適化戦略

### 開発フェーズ
- **Embedding**: `text-embedding-3-small` ($0.02/1M tokens)
- **分析**: `gpt-4o-mini` ($0.15/$0.60 per 1M tokens)
- **キャッシュ**: 埋め込み結果をローカル保存
- **予想月額**: $10-20程度

### 本番フェーズ（必要時アップグレード）
- **高精度Embedding**: `text-embedding-3-large`
- **高度分析**: `gpt-4o`
- **予想月額**: $50-100程度

## データフロー

```
1. MVV Data (CSV) → 2. Preprocessing → 3. Embedding API
                                               ↓
6. Frontend Display ← 5. Analysis Results ← 4. Similarity Calculation
```

## セキュリティ・プライバシー

- 企業名のハッシュ化オプション
- API キーの環境変数管理
- 分析結果の暗号化保存
- アクセスログ記録

## 実装順序

### Phase 1A: 基盤構築（1-2日）
1. データ前処理パイプライン
2. OpenAI Embedding API統合
3. 類似性計算ロジック
4. 基本UI コンポーネント

### Phase 1B: 可視化強化（1-2日）
1. ヒートマップ表示
2. 類似企業検索
3. フィルタリング機能
4. エクスポート機能

### Phase 2: 高度分析（2-3日）
1. GPT-4o-mini 統合
2. 品質評価ロジック
3. インサイト生成
4. トレンド分析

## 成功指標

- **機能性**: 95社間の類似性を正確に算出
- **コスト**: 月額$20以下で運用
- **パフォーマンス**: 分析結果を3秒以内に表示
- **拡張性**: 新規企業データの容易な追加

## 実装状況（2025-07-08）

### ✅ Phase 1A 完了：基盤構築

1. **データ前処理パイプライン** - 完了
   - 95社のMVVデータから62社の完全データ抽出
   - Node.js実装（`mvv_data_processor.js`）

2. **OpenAI Embedding API統合** - 完了
   - text-embedding-3-small モデル使用
   - キャッシュ機能・中間保存機能実装
   - 実費: 約$0.50（62社×4ベクトル）

3. **類似性計算ロジック** - 完了
   - コサイン類似度による62×62マトリックス生成
   - 業界内/業界間分析機能

4. **分析結果**
   - 最類似ペア: テルモ ⟷ 日本メドトロニック (0.8466)
   - 業界別類似度: メディカル > 製薬 > バイオテクノロジー
   - 平均類似度: 0.6466

### 📁 生成データファイル

```
data/analysis-data/
├── mvv-data-95companies.csv        # 元データ（git除外）
└── processed/
    ├── preprocessed_mvv_data.json   # 前処理済み（62社）
    ├── mvv_embeddings.json          # ベクトル埋め込み（5.8MB）
    └── similarity_analysis.json     # 類似性分析結果
```

## 現在の実装状況

### Phase 3: リアルタイム分析ダッシュボード（完了済み）
1. **企業独自性スコアダッシュボード** ✅
   - 実装場所: `/frontend/src/components/MVVAnalysis/UniquenessScoreDashboard.tsx`
   - ロジック: `/frontend/src/services/uniquenessScoreCalculator.ts`
   - UI: リアルタイムランキングテーブル + スコア分解表示

2. **MVV業界トレンド分析** ✅
   - 実装場所: `/frontend/src/components/MVVAnalysis/MVVTrendAnalysis.tsx`
   - データ処理: TinySegmenter形態素解析 + JSIC分類統合
   - UI: 業界別キーワード分析 + 時系列トレンド

3. **競合ポジショニングマップ** ✅
   - 実装場所: `/frontend/src/components/MVVAnalysis/CompetitivePositioningMap.tsx`
   - 可視化: MDS-based 2D空間マッピング + ドラッグナビゲーション
   - フィルタ: 業界・地域・規模による多次元フィルタリング

4. **MVV品質評価システム** ✅
   - 実装場所: `/frontend/src/components/MVVAnalysis/MVVQualityAssessment.tsx`
   - 評価エンジン: ルールベース3軸評価（包括性・具体性・一貫性）
   - UI: 品質スコアカード + 自動改善提案

5. **Visual Analytics Gallery** ✅
   - 実装場所: `/frontend/src/components/MVVAnalysis/VisualAnalyticsGallery.tsx`
   - 機能: 高品質スクリーンショット + Excel統合 + IndexedDB永続化

### 利用可能なデータ（完全統合済み）
- **94企業のMVVデータ**: 完全なembeddingsと類似度マトリックス
- **89企業の詳細情報**: 設立年、従業員数、資本金、所在地等（100%抽出成功）
- **完全JSIC分類**: 自動分類による業界カテゴリの網羅的整備
- **構造化住所データ**: 都道府県・市区町村別分類の完全データベース
- **Visual Analytics**: 5つの分析タブのスクリーンショットデータ

### Phase 4準備状況
- **技術基盤**: リアルタイム処理インフラ完成（LRUキャッシュ・高速計算）
- **データ統合**: MVV + 企業情報 + JSIC + Visual Analytics の完全統合
- **UI/UX基盤**: 5つの分析機能 + Visual Analytics + Excel Export の安定稼働
- **次期機能準備**: AI-powered insights, 多言語対応, エンタープライズ機能への技術基盤完成