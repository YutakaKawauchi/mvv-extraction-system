# MVV AI分析 フロントエンド設計書

## 概要

MVV類似性分析結果を可視化し、インタラクティブな分析体験を提供するフロントエンドシステム。

## 実装アプローチ（段階的）

### Phase 1: 静的データ可視化（現在実装）
- **目的**: 既存分析結果の即座の価値提供
- **データ**: ローカル分析済み62社のデータを静的に表示
- **メリット**: 
  - 実装が簡単、すぐに動作確認可能
  - APIコスト不要
  - 高速な初期ロード

### Phase 2: Netlify Functions API統合
- **目的**: 動的な分析機能の追加
- **機能**:
  - 新規企業のEmbedding生成
  - カスタム類似性検索
  - リアルタイム分析更新
- **データ管理**: 
  - 既存62社: サーバー側キャッシュ
  - 新規追加: API経由で生成

### Phase 3: フル機能実装（最終形態）
- **目的**: 完全な自律型分析システム
- **機能**:
  - Web上でのリアルタイムEmbedding生成
  - IndexedDBによる永続化
  - オフライン対応
  - バッチ分析機能

## データアーキテクチャ

### 現在のデータフロー（Phase 1）
```
[分析済みJSON] → [Public folder] → [React Component] → [Visualization]
```

### 最終形態のデータフロー
```
[MVV Data] → [Embedding API] → [IndexedDB Cache] → [Analysis Engine] → [Visualization]
     ↓                               ↑
[新規企業] → [Real-time Processing] ┘
```

## コンポーネント設計

### 1. MVVAnalysisDashboard（メインコンテナ）
- 分析結果の統合ビュー
- タブ切り替え（ヒートマップ/ネットワーク/インサイト）

### 2. SimilarityHeatmap（類似度ヒートマップ）
- 62×62マトリックスの可視化
- インタラクティブなズーム・パン
- クリックで詳細表示

### 3. CompanyNetwork（企業ネットワーク図）
- Force-directed graphで類似性を視覚化
- 業界別カラーリング
- ドラッグ可能なノード

### 4. IndustryAnalysis（業界別分析）
- 業界内/業界間類似度の比較
- バーチャート・レーダーチャート
- 統計サマリー

### 5. SimilarCompanyFinder（類似企業検索）
- 選択企業の最類似企業リスト
- 類似度スコア表示
- MVV比較ビュー

### 6. InsightPanel（AI洞察パネル）
- GPT-4o-miniによる分析コメント
- トレンド・パターンの説明
- 改善提案（Phase 2以降）

## 技術スタック

### 可視化ライブラリ
- **D3.js**: ヒートマップ、ネットワーク図
- **Chart.js/Recharts**: 基本的なチャート
- **react-force-graph**: 3Dネットワーク可視化

### データ管理
- **Zustand**: 分析データのグローバル状態管理
- **React Query**: API呼び出し管理（Phase 2）
- **Dexie.js**: IndexedDB操作（Phase 3）

## 実装優先順位

### Phase 1（即座に価値提供）
1. 分析データの静的配置
2. SimilarityHeatmap実装
3. SimilarCompanyFinder実装
4. 基本的なフィルタリング機能

### Phase 2（動的機能）
1. Netlify Functions API実装
2. 新規企業追加機能
3. リアルタイム再分析
4. InsightPanel（GPT-4o-mini統合）

### Phase 3（完全版）
1. Web上Embedding生成
2. IndexedDB統合
3. オフライン対応
4. バッチ処理UI

## パフォーマンス最適化

### データサイズ考慮
- similarity_analysis.json: 約10MB（62×62マトリックス含む）
- 初期ロード最適化:
  - 必要なデータのみ読み込み
  - 遅延ロード実装
  - データ圧縮

### 描画最適化
- Canvas/WebGLベースの描画（大量データ）
- 仮想スクロール（リスト表示）
- デバウンス/スロットル処理

## セキュリティ・プライバシー

### Phase 1
- 静的データのため、特別な考慮不要
- 企業名は公開情報

### Phase 2以降
- API認証（JWT活用）
- レート制限
- 機密データの暗号化

## 成功指標

- **UX**: 3秒以内に初期表示
- **インタラクション**: 60fps維持
- **価値**: ユーザーが新しい洞察を得られる
- **拡張性**: 1000社まで対応可能な設計