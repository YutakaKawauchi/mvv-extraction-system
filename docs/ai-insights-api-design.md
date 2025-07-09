# AI Analysis System Design Document

## Document Status
**Current Status**: Phase 3準備完了 (Enhanced Company Management System) - COMPLETED (2025-07-09)
**This Document**: Phase 3.1 (静的分析機能) - NEXT IMPLEMENTATION

## Phase 2-b Implementation Summary (COMPLETED 2025-07-09)

### Real-time Embeddings Analysis Features
- ✅ **Client-side Similarity Calculation**: Real-time embeddings-based similarity using IndexedDB
- ✅ **Enhanced Algorithm**: 70% embeddings + 25% morphological analysis + 15% industry bonus
- ✅ **Performance Optimization**: LRU caching, progressive calculation, symmetric matrix optimization
- ✅ **UI/UX Enhancements**: Interactive tooltips, tag-based explanations, markdown copy functionality
- ✅ **Industry-Agnostic**: Supports any industry beyond healthcare with comprehensive keyword dictionary

### Technical Implementation (Phase 2-b)
```typescript
// Key Components
- /frontend/src/services/similarityCalculator.ts - Enhanced similarity algorithm
- /frontend/src/services/similarityCache.ts - LRU caching system
- /frontend/src/services/progressiveCalculator.ts - Progressive calculation system
- /frontend/src/stores/embeddingsAnalysisStore.ts - Real-time analysis state management
- /frontend/src/components/MVVAnalysis/EmbeddingsAnalysisDashboard.tsx - Main dashboard
- /frontend/src/components/MVVAnalysis/EmbeddingsSimilarCompanyFinder.tsx - Company finder with tooltips
```

### Performance Metrics (Phase 2-b)
- **Tab Load Time**: <1 second (optimized from 3-5 seconds)
- **Similarity Calculation**: Instant display with progressive enhancement
- **Cache Hit Rate**: 50%+ for repeated calculations
- **Memory Usage**: Efficient IndexedDB storage with 94 companies

---

## Phase 3: AI-Powered Insights System (FUTURE IMPLEMENTATION)

### 概要
既存の静的MVV類似度データを活用し、GPT-4o-miniによる深い洞察を生成するAPI。
Phase 3の第一段階として実装予定。

## API仕様

### エンドポイント
```
POST /.netlify/functions/generate-insights
```

### 認証
- **JWT認証**: 既存のJWTトークンベース認証
- **API Key認証**: バックアップとしてAPI key認証も対応
- **レート制限**: 1ユーザーあたり10回/分

### リクエスト形式

#### 1. 企業間類似度洞察
```json
{
  "type": "similarity",
  "companyIds": ["company_20", "company_92"],
  "analysisData": {
    "similarity": 0.8466,
    "commonKeywords": {
      "mission": ["医療", "社会"],
      "vision": ["患者", "生活"],
      "values": ["品質", "安全"]
    },
    "categories": ["医療機器", "メディカル"]
  },
  "language": "ja"
}
```

#### 2. 単一企業分析
```json
{
  "type": "company",
  "companyIds": ["company_20"],
  "analysisData": {
    "mvv": {
      "mission": "医療を通じて社会に貢献する",
      "vision": "患者さんの生活の質向上...",
      "values": "Respect, Integrity, Care..."
    },
    "similarCompanies": [
      {"name": "メドトロニック", "similarity": 0.8466},
      {"name": "キャノンメディカル", "similarity": 0.7982}
    ],
    "category": "医療機器"
  },
  "language": "ja"
}
```

#### 3. 業界分析
```json
{
  "type": "industry",
  "category": "医療機器",
  "analysisData": {
    "companies": ["テルモ", "キャノンメディカル", "オリンパス"],
    "avgInternalSimilarity": 0.752,
    "avgExternalSimilarity": 0.643,
    "coherenceIndex": 0.109
  },
  "language": "ja"
}
```

### レスポンス形式

#### 成功レスポンス
```json
{
  "success": true,
  "data": {
    "insights": {
      "summary": "テルモとメドトロニック日本の類似度が0.85と非常に高い理由...",
      "keyFactors": [
        "両社とも「医療を通じた社会貢献」を核とする使命を掲げている",
        "患者中心の価値観が強く表れている",
        "品質と安全への高いコミットメント"
      ],
      "businessImplications": [
        "競合として類似した市場ポジショニング",
        "顧客セグメントの重複可能性",
        "差別化要因の検討が重要"
      ],
      "recommendations": [
        "独自の価値提案の明確化",
        "特定領域での専門性強化",
        "パートナーシップの可能性検討"
      ]
    },
    "metadata": {
      "analysisType": "similarity",
      "processingTime": 2340,
      "confidence": 0.89,
      "tokensUsed": 1250
    }
  }
}
```

#### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "INVALID_COMPANY_ID",
    "message": "指定された企業IDが見つかりません",
    "details": "company_999 is not found in analysis data"
  }
}
```

## 技術実装詳細

### 使用技術
- **AI Model**: OpenAI GPT-4o-mini (コスト効率)
- **Runtime**: Netlify Functions (Node.js 18)
- **Authentication**: JWT + API Key (既存システム統合)
- **Logging**: 既存logging.jsシステム活用

### プロンプト戦略

#### システムプロンプト
```
あなたは日本のヘルスケア業界のMVV（Mission・Vision・Values）分析の専門家です。
企業の理念と価値観を深く理解し、ビジネス的な洞察を提供してください。

分析の観点：
1. MVVの本質的な意味と企業文化への影響
2. 業界内での位置づけと競合関係
3. ビジネス戦略への示唆
4. 具体的で実行可能な推奨事項

回答は必ず日本語で、ビジネスパーソンが理解しやすい言葉で説明してください。
```

#### ユーザープロンプト（類似度分析）
```
以下の2社のMVV類似度分析結果について詳細な洞察を提供してください：

企業A: {company1.name} ({company1.category})
Mission: {company1.mission}
Vision: {company1.vision}  
Values: {company1.values}

企業B: {company2.name} ({company2.category})
Mission: {company2.mission}
Vision: {company2.vision}
Values: {company2.values}

類似度: {similarity}
共通キーワード:
- Mission: {commonKeywords.mission}
- Vision: {commonKeywords.vision}
- Values: {commonKeywords.values}

以下の形式でJSONとして回答してください：
{responseFormat}
```

### コスト最適化

#### トークン使用量削減
- **入力最適化**: 必要最小限の情報のみ送信
- **プロンプト効率化**: 簡潔で効果的なプロンプト設計
- **出力制御**: 最大トークン数制限（1500トークン）

#### キャッシュ戦略
- **企業ペア**: 同じ企業ペアの分析結果をキャッシュ（24時間）
- **キーハッシュ**: `md5(companyId1_companyId2_type)`でキャッシュキー生成
- **ストレージ**: Netlify環境変数またはローカルファイル

### エラーハンドリング

#### エラー種別
1. **認証エラー**: 401 Unauthorized
2. **レート制限**: 429 Too Many Requests  
3. **無効データ**: 400 Bad Request
4. **AI API エラー**: 502 Bad Gateway
5. **内部エラー**: 500 Internal Server Error

#### 復旧戦略
- **リトライ機能**: AI APIエラー時の自動リトライ（最大3回）
- **フォールバック**: 簡素化された分析結果を返却
- **詳細ログ**: エラー原因の詳細記録

## パフォーマンス目標

- **レスポンス時間**: 平均 3-5秒
- **成功率**: 95%以上
- **コスト**: $0.02/回以下
- **同時リクエスト**: 最大10件

## セキュリティ考慮事項

- **入力検証**: 企業IDとデータの妥当性チェック
- **出力フィルタ**: 機密情報の意図しない出力防止
- **ログマスキング**: 機密データの自動マスク
- **レート制限**: DDoS攻撃防止

## テスト戦略

### 単体テスト
- [ ] 認証機能の検証
- [ ] 入力データバリデーション
- [ ] AI API統合テスト
- [ ] エラーハンドリング

### 結合テスト  
- [ ] フロントエンド統合
- [ ] 既存認証システムとの連携
- [ ] ログシステム統合

### パフォーマンステスト
- [ ] レスポンス時間測定
- [ ] 同時接続負荷テスト
- [ ] コスト効率検証

## 実装マイルストーン

### Phase 3.1: 静的分析機能 (Week 1)
- [ ] 企業独自性スコア計算機能
- [ ] MVV成熟度診断システム
- [ ] 業界トレンド分析データ生成
- [ ] 競合ポジショニングマップ可視化

### Phase 3.2: AI分析機能 (Week 2)
- [ ] Netlify Functions基盤構築
- [ ] OpenAI GPT-4o-mini統合
- [ ] 基本的な類似度洞察生成
- [ ] 段階的課金システム実装

### Phase 3.3: 最適化・拡張 (Week 3)
- [ ] キャッシュシステム実装
- [ ] エラーハンドリング強化
- [ ] パフォーマンス調整
- [ ] 包括的テスト実行

## 次期フェーズとの連携

このAPIは Phase 3の基盤として：
- **Phase 2-b連携**: 既存のリアルタイム類似度計算結果を活用
- **インサイトタブ**: フロントエンドでの段階的機能展開
- **課金システム**: 段階的な機能制限とマネタイゼーション

設計完了日: 2025-07-08
実装予定: Phase 3.1 (2025-07-10以降)