# Company Info API Test Suite

このテストスイートは、企業情報抽出APIの品質を保証し、課金を最小限に抑えながら包括的なテストを実行します。

## テストモード

### 1. Mock Mode（推奨・デフォルト）
```bash
npm run test:mock
# または
npm test
```

**特徴:**
- 💰 **完全無料**: 実際のAPIを呼び出さない
- 🚀 **高速**: モックデータを使用
- 🔄 **繰り返し実行可能**: 何度実行しても課金なし
- 📊 **包括的**: 全テストケースを実行

**用途:**
- 日常的な開発テスト
- CI/CDパイプライン
- コードレビュー前の確認

### 2. Minimal Mode（最小課金）
```bash
npm run test:minimal
```

**特徴:**
- 💲 **最小課金**: 1-2回のAPI呼び出しのみ
- ⚡ **基本検証**: 最重要機能のみテスト
- 📈 **推定コスト**: ~$0.02 (約¥3)

**用途:**
- 本番デプロイ前の最終確認
- 新しいAPI keyの動作確認

### 3. Integration Mode（フル課金）
```bash
npm run test:integration
```

**特徴:**
- 💸 **フル課金**: 全APIを実際に呼び出し
- 🔍 **完全検証**: 実際のPerplexity APIとの統合テスト
- 📊 **推定コスト**: ~$0.10 (約¥15)

**用途:**
- 月次の統合テスト
- 重要な機能変更後の確認
- 本番環境での動作確認

## テスト実行手順

### 1. 環境設定
```bash
# 必要な環境変数を設定
export PERPLEXITY_API_KEY="your-perplexity-api-key"
export MVP_API_SECRET="your-api-secret"
```

### 2. 依存関係のインストール
```bash
cd backend
npm install
```

### 3. テスト実行
```bash
# 日常的なテスト（無料）
npm run test:mock

# 最小限のAPIテスト（有料）
npm run test:minimal

# 完全な統合テスト（有料）
npm run test:integration

# 監視モード（開発時）
npm run test:watch
```

## テスト結果の確認

### 1. コンソール出力
```
🚀 Starting Company Info API Tests
📋 Test Mode: mock
💰 Cost Estimation: Free
⏰ Started at: 2024-01-01T00:00:00.000Z

✅ Passed: 8
❌ Failed: 0
⏭️  Skipped: 0
💰 Estimated Cost: $0.00 (¥0.00)
⏱️  Duration: 1250ms
```

### 2. 詳細結果ファイル
テスト結果は `test/results/` フォルダに保存されます：
- `company-info-test-mock-2024-01-01T00-00-00-000Z.json`
- `company-info-test-minimal-2024-01-01T00-00-00-000Z.json`
- `company-info-test-integration-2024-01-01T00-00-00-000Z.json`

## テストケース

### 基本テスト
- 入力パラメータの検証
- HTTPメソッドの検証
- レスポンス形式の検証

### 企業情報抽出テスト
- **トヨタ自動車**: 大企業・上場企業のテスト
- **サイバーエージェント**: IT企業のテスト
- **スタートアップ企業**: 未上場企業のテスト

### パフォーマンステスト
- 複数リクエストの並行処理
- レスポンス時間の測定

### エラーハンドリングテスト
- API エラーの適切な処理
- 無効なデータの処理

## コスト管理

### 推定コスト（2024年1月現在）
- Perplexity API: $0.011/リクエスト
- 1USD = 150JPY（概算）

### テストモード別コスト
| モード | API呼び出し数 | 推定コスト（USD） | 推定コスト（JPY） |
|--------|---------------|-------------------|-------------------|
| Mock | 0 | $0.00 | ¥0 |
| Minimal | 1-2 | $0.01-0.02 | ¥2-3 |
| Integration | 8-10 | $0.09-0.11 | ¥14-17 |

### コスト削減のベストプラクティス
1. 日常的なテストは `mock` モードを使用
2. 実際のAPIテストは月1回程度に制限
3. 新機能のテストは `minimal` モードから開始
4. 本番デプロイ前のみ `integration` モードを使用

## トラブルシューティング

### よくある問題

#### 1. PERPLEXITY_API_KEY が設定されていない
```bash
Error: PERPLEXITY_API_KEY is not set
```
**解決方法**: `.env` ファイルまたは環境変数にAPIキーを設定

#### 2. テストがタイムアウトする
```bash
Error: Test timeout
```
**解決方法**: ネットワーク接続を確認、またはmockモードを使用

#### 3. 予期しない課金
**解決方法**: 
- `TEST_MODE=mock` を明示的に設定
- テスト実行前にモードを確認

## CI/CD での使用

### GitHub Actions での例
```yaml
- name: Run API Tests
  run: |
    cd backend
    npm install
    npm run test:mock
  env:
    PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}
    MVP_API_SECRET: ${{ secrets.MVP_API_SECRET }}
```

### 本番デプロイ前の確認
```bash
# 1. モックテストで基本機能を確認
npm run test:mock

# 2. 最小限のAPIテストで実際の動作を確認
npm run test:minimal

# 3. 問題がなければデプロイ
npm run deploy:prod
```

## 注意事項

1. **課金に注意**: `integration` モードは実際のAPIを呼び出すため課金が発生します
2. **環境変数の管理**: 本番のAPIキーを開発環境で使用しないよう注意
3. **レート制限**: 実際のAPIには制限があるため、連続実行に注意
4. **テスト結果の保存**: 結果ファイルは `.gitignore` に追加してください

## 更新履歴

- 2025-07-09: 企業情報抽出APIテストスイート完成
- テストスイートの作成とモック機能の実装
- 3段階のテストモード（mock/minimal/integration）の実装
- コスト管理機能の追加
- CORS処理とレート制限の統合
- 包括的なエラーハンドリングテスト