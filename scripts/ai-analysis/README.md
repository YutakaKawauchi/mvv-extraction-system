# MVV AI分析システム スクリプト

このディレクトリには、MVVデータのAI分析用ローカルスクリプトが含まれています。

## 概要

95社のヘルスケア企業MVVデータを分析し、企業間の類似性・業界パターン・インサイトを抽出するシステム。

## スクリプト一覧

### 1. mvv_data_processor.js
- **機能**: CSVデータの前処理・クリーニング
- **入力**: `/data/analysis-data/mvv-data-95companies.csv`
- **出力**: `/data/analysis-data/processed/preprocessed_mvv_data.json`
- **実績**: 95社から62社の完全MVVデータを抽出

### 2. embedding_generator.js
- **機能**: OpenAI Embeddings APIでベクトル化
- **モデル**: text-embedding-3-small（コスト効率重視）
- **特徴**: 
  - キャッシュ機能（再実行時の費用削減）
  - 中間保存（5社ごと、障害対策）
  - レート制限対応（1秒間隔）
- **出力**: `/data/analysis-data/processed/mvv_embeddings.json`

### 3. similarity_analyzer.js
- **機能**: コサイン類似度による企業間類似性分析
- **分析内容**:
  - 62×62類似度マトリックス
  - 業界内/業界間類似度
  - 最類似企業ペア特定
- **出力**: `/data/analysis-data/processed/similarity_analysis.json`

### 4. test_embedding.js
- **機能**: API接続テスト（少数サンプル）
- **用途**: 本番実行前の動作確認

## 実行方法

### 環境設定
```bash
# 必要なパッケージインストール
npm install

# 環境変数設定（backend/.envから自動読み込み）
# OPENAI_API_KEY が必要
```

### 実行手順
```bash
# 1. データ前処理
node mvv_data_processor.js

# 2. テスト実行（オプション）
node test_embedding.js

# 3. Embedding生成（API費用: 約$0.50）
node embedding_generator.js

# 4. 類似性分析
node similarity_analyzer.js
```

## 分析結果（2025-07-08実行）

### 統計情報
- **分析対象**: 62社（完全MVVデータ保有）
- **業界カテゴリ**: 7種類
- **平均類似度**: 0.6466
- **最高類似度**: 0.8466（テルモ ⟷ 日本メドトロニック）

### 業界別類似度
1. メディカル: 0.7035（業界内平均）
2. 製薬: 0.7004
3. バイオテクノロジー: 0.6938
4. デジタルヘルス: 0.6713
5. その他業界: 0.65前後

## データファイル

### 入力データ（git除外）
- `mvv-data-95companies.csv`: 実企業MVVデータ

### 処理済みデータ（git除外、再利用可能）
- `preprocessed_mvv_data.json`: 前処理済みデータ
- `mvv_embeddings.json`: ベクトル埋め込み（5.8MB）
- `similarity_analysis.json`: 類似性分析結果

## 注意事項

- **APIキー**: OpenAI APIキーが必要（backend/.envで設定）
- **コスト**: Embedding生成には費用発生（約$0.50/62社）
- **機密性**: 実企業データのため、git除外設定済み
- **再実行**: キャッシュ機能により、既存Embeddingは再利用される

## 次のステップ

1. Netlify Functions APIとして実装
2. フロントエンド可視化コンポーネント開発
3. GPT-4o-miniによるインサイト生成機能