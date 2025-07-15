# テストセキュリティガイドライン

## 🚨 重要なセキュリティ注意事項

### 1. APIキー管理
- **❌ 絶対禁止**: 実際のAPIキーをテストコードにハードコーディング
- **❌ 絶対禁止**: 本番APIキーをGitコミット  
- **✅ 推奨**: 環境変数を使用
- **✅ 推奨**: 開発用と本番用のAPIキーを分離

### 2. テスト環境の分離

#### ローカル開発テスト
```bash
# 開発用APIキーを使用
export MVP_API_SECRET="development-test-key"
export API_BASE_URL="http://localhost:8888/.netlify/functions"
./test/scripts/test-long-running-e2e.sh
```

#### 本番環境テスト（注意が必要）
```bash
# 本番APIキーは環境変数で設定
export MVP_API_SECRET="actual-production-secret"
export API_BASE_URL="https://your-app.netlify.app/.netlify/functions"
./test/scripts/test-long-running-e2e.sh
```

### 3. 推奨されるテスト戦略

#### 階層的テスト戦略
1. **Mock テスト** (無料・高速)
   ```bash
   npm run test:mock
   ```

2. **ローカル統合テスト** (開発環境)
   ```bash
   export MVP_API_SECRET="development-key"
   ./test/scripts/test-long-running-e2e.sh --quick
   ```

3. **ステージング環境テスト** (本番相当環境)
   ```bash
   export MVP_API_SECRET="staging-key"
   export API_BASE_URL="https://staging.your-app.netlify.app/.netlify/functions"
   ./test/scripts/test-long-running-e2e.sh
   ```

4. **本番環境テスト** (必要最小限)
   ```bash
   # 慎重に実行、課金が発生する可能性
   export MVP_API_SECRET="production-key"
   export API_BASE_URL="https://your-app.netlify.app/.netlify/functions"
   ./test/scripts/test-long-running-e2e.sh --minimal
   ```

### 4. CI/CD環境でのテスト

#### GitHub Actions設定例
```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Mockテスト（無料）
      - name: Run Mock Tests
        run: |
          cd backend
          npm install
          npm run test:mock
      
      # 統合テスト（本番シークレット使用）
      - name: Run Integration Tests
        if: github.ref == 'refs/heads/main'
        env:
          MVP_API_SECRET: ${{ secrets.MVP_API_SECRET }}
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
        run: |
          cd backend
          ./test/scripts/test-long-running-e2e.sh --minimal
```

### 5. セキュリティチェックリスト

#### コミット前チェック
- [ ] テストファイルに実際のAPIキーが含まれていない
- [ ] .env.test が .gitignore に追加されている
- [ ] ハードコーディングされたURLが本番環境を指していない
- [ ] テスト結果ファイルにセンシティブ情報が含まれていない

#### 本番環境テスト前チェック
- [ ] 課金が発生する可能性を理解している
- [ ] 本番データへの影響を確認済み
- [ ] レート制限を考慮している
- [ ] エラー時のロールバック計画がある

### 6. 緊急時の対応

#### APIキー漏洩時
1. **即座にAPIキーを無効化**
2. **新しいAPIキーを生成**
3. **Gitコミット履歴からキーを削除**
4. **影響範囲を調査**

#### 本番環境での問題発生時
1. **テストを即座に停止**
2. **影響を最小限に抑制**
3. **ログを保存して原因調査**
4. **必要に応じてロールバック**

### 7. 開発チーム用ガイドライン

#### 新メンバー向け
```bash
# 1. リポジトリクローン後の初期設定
cp test/.env.test.example test/.env.test
# 2. .env.test を編集して開発用の値を設定
# 3. Mockテストで動作確認
npm run test:mock
```

#### レビュアー向けチェックポイント
- テストコードにシークレットが含まれていないか
- 新しいテストが適切な環境分離を行っているか
- 本番環境への影響を最小限に抑えているか

### 8. ツールとスクリプト

#### シークレットスキャン
```bash
# コミット前のシークレットチェック
git diff --cached | grep -i "secret\|key\|password\|token" && echo "⚠️  Potential secret detected"
```

#### 安全なテスト実行
```bash
# 環境変数が正しく設定されているかチェック
./test/scripts/test-long-running-e2e.sh --check-env
```

## まとめ

- **Always Mock First**: 最初は常にMockテストを使用
- **Environment Isolation**: 環境の適切な分離
- **Secret Management**: シークレットの適切な管理  
- **Gradual Testing**: 段階的なテスト戦略
- **Cost Awareness**: 課金を意識したテスト設計

これらのガイドラインに従うことで、セキュアで効率的なテスト環境を維持できます。