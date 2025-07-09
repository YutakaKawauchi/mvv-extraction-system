# MVV AI分析システム アーキテクチャ設計

## 概要

94社のMVVデータを活用した高度なAI分析システム。Phase 2-b (Real-time Embeddings Analysis) 完了済み。

**現在の状況**: Phase 2-b 完了 (2025-07-09)
**次期計画**: Phase 3 (AI-Powered Insights System)

## Phase 2-b: Real-time Embeddings Analysis（完了済み）

### 実装済み機能
1. **リアルタイム類似性計算**
   - クライアントサイドでの即座な類似度計算
   - IndexedDBに保存された embeddings を活用
   - 70% embeddings + 25% 形態素解析 + 15% 業界ボーナスの複合アルゴリズム

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

### 技術スタック
```
Backend:
├── /analyze-similarity (Netlify Function)
├── Python libraries: numpy, scikit-learn
├── OpenAI API (text-embedding-3-small)
└── File-based caching (JSON)

Frontend:
├── MVVAnalyzer (新規コンポーネント)
├── SimilarityMatrix (ヒートマップ表示)
├── SimilarCompanies (類似企業リスト)
└── Charts.js / D3.js (可視化)
```

## フェーズ2: 高度分析・洞察抽出

### 機能
1. **MVV品質評価**
   - GPT-4o-mini による包括性・具体性分析
   - 独自性スコア算出
   - 改善提案生成

2. **キーワード・トレンド分析**
   - 形態素解析 + TF-IDF
   - 業界別特徴語抽出
   - 感情分析（positive/neutral/negative）

3. **インタラクティブ可視化**
   - t-SNE/UMAP による2D/3D空間マッピング
   - 動的フィルタリング
   - レーダーチャート

## フェーズ3: MVVジェネレーター

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

## 次のステップ

### Phase 1B: API・可視化実装
1. Netlify Functions API実装（`/analyze-similarity`）
2. フロントエンド可視化コンポーネント
3. インタラクティブUI実装
4. 本番デプロイ