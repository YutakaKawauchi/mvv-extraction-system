# MVV類似性分析のスケーラビリティ分析

## 企業追加時の計算コスト

### 現状（62社）
- **類似度マトリックス**: 62×62 = 3,844セル
- **計算量**: O(n²) = 62² = 3,844回のコサイン類似度計算
- **処理時間**: 約3秒（ローカル）

### 企業1社追加（63社）の場合

#### 💡 効率的なアプローチ（増分計算）
1. **新規企業のEmbedding生成**: 1社分のみ
2. **類似度計算**: 新規企業 vs 既存62社 = 62回のみ
3. **マトリックス更新**: 
   - 新しい行/列を追加
   - 対角線要素（自己類似度）= 1.0

#### 計算量比較
```
❌ 全再計算: O(63²) = 3,969回 → +125回（+3.2%）
✅ 増分計算: O(n) = 62回のみ → 大幅な効率化
```

## APIコスト分析

### OpenAI Embedding API（text-embedding-3-small）
- **料金**: $0.02 per 1M tokens
- **日本語MVVテキスト**: 平均200文字 ≈ 300トークン

### 1社追加のコスト
```
新規企業1社の場合:
- Mission Embedding: ~100トークン
- Vision Embedding: ~100トークン  
- Values Embedding: ~150トークン
- Combined Embedding: ~300トークン
合計: ~650トークン = $0.000013（約0.002円）
```

### スケール別コスト試算

| 企業数 | 増分API呼び出し | 増分コスト | 累積コスト |
|--------|----------------|------------|------------|
| 63社   | 1社×4回        | $0.000013  | $0.500013  |
| 100社  | 38社×4回       | $0.000494  | $0.500494  |
| 200社  | 138社×4回      | $0.001794  | $0.501794  |
| 500社  | 438社×4回      | $0.005694  | $0.505694  |

### 計算時間の推移

| 企業数 | マトリックスサイズ | 増分計算時間 | 全体再計算時間 |
|--------|-------------------|--------------|----------------|
| 62社   | 62×62            | -            | 3秒            |
| 63社   | 63×63            | 0.1秒        | 3.1秒          |
| 100社  | 100×100          | 1.6秒        | 8秒            |
| 200社  | 200×200          | 3.2秒        | 32秒           |
| 500社  | 500×500          | 8秒          | 200秒          |

## 実装戦略

### 1. 増分更新アルゴリズム
```javascript
// 新規企業追加時の効率的な更新
async function addCompanyToAnalysis(newCompany, existingAnalysis) {
  // 1. 新規企業のEmbedding生成（APIコスト発生）
  const newEmbeddings = await generateEmbeddings(newCompany);
  
  // 2. 既存企業との類似度計算（ローカル計算のみ）
  const similarities = existingAnalysis.companies.map(company => ({
    company,
    similarity: cosineSimilarity(newEmbeddings.combined, company.embeddings.combined)
  }));
  
  // 3. マトリックス更新（新しい行/列追加）
  updateSimilarityMatrix(existingAnalysis.matrix, similarities);
  
  return updatedAnalysis;
}
```

### 2. キャッシュ戦略
- **Level 1**: Embedding結果のキャッシュ（重複計算回避）
- **Level 2**: 類似度計算結果のキャッシュ
- **Level 3**: 可視化データのキャッシュ

### 3. 段階的ロード
```javascript
// 大規模データの段階的処理
const BATCH_SIZE = 10;

async function processLargeDataset(companies) {
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE);
    await processBatch(batch);
    
    // UI更新 + 中間保存
    updateUI(getCurrentProgress());
    await saveIntermediateResults();
  }
}
```

## パフォーマンス最適化

### フロントエンド側
- **仮想化**: 大きなマトリックスの表示最適化
- **WebWorker**: 類似度計算をバックグラウンドで実行
- **Canvas描画**: SVGからCanvasに変更（大量データ）

### バックエンド側
- **ベクトルDB**: Redis/Pineconeで高速検索
- **並列処理**: 複数のEmbedding並列生成
- **分散計算**: 大規模時はWorker分散

## 現実的な運用限界

### 推奨企業数
- **快適動作**: ~200社（類似度マトリックス 200×200 = 40,000セル）
- **動作限界**: ~500社（ブラウザメモリ限界）

### 500社超の場合
1. **ベクトル検索エンジン**導入（Pinecone/Weaviate）
2. **類似度のTop-K検索**（全マトリックス不要）
3. **サーバーサイド分析**（結果のみフロントエンド送信）

## 結論

### 1社追加の実際コスト
- **APIコスト**: 約$0.000013（0.002円）
- **計算時間**: 約0.1秒（増分更新）
- **メモリ使用量**: +125KB程度

### スケーラビリティ
- **100社まで**: 現行アーキテクチャで快適動作
- **200社まで**: 軽微な最適化で対応可能
- **500社以上**: アーキテクチャ刷新が必要

**結論**: 企業数の増加に対して、APIコストは線形、計算コストは定数時間（増分更新）で非常に効率的です。