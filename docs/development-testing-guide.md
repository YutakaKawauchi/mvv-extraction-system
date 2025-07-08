# 開発環境での認証システムテストガイド

## 🚀 セットアップ手順

### 1. 環境変数の確認

#### バックエンド設定確認
```bash
cd backend
cat .env
```

以下の設定が含まれていることを確認：
```bash
# 認証設定
AUTH_USERNAME=admin
AUTH_PASSWORD=test123
JWT_SECRET=development-jwt-secret-key-for-testing-minimum-256-bits-long
JWT_EXPIRATION=24h
LOGIN_RATE_LIMIT=10
```

#### フロントエンド設定確認
```bash
cd frontend
cat .env.local
```

以下の設定が含まれていることを確認：
```bash
VITE_API_BASE_URL=/.netlify/functions
VITE_API_SECRET=mvv-extraction-2024-secure-key
VITE_ENVIRONMENT=development
```

### 2. 開発サーバー起動

#### ターミナル1: バックエンド起動
```bash
cd backend
npm install  # まだ行っていない場合
netlify dev
```

成功すると以下のメッセージが表示されます：
```
◈ Netlify Dev ◈
◈ Injected build command: npm run build
◈ Functions server is listening on 8888
◈ Starting Netlify Dev. This can take a moment.
◈ Server listening on http://localhost:8888
```

#### ターミナル2: フロントエンド起動
```bash
cd frontend
npm run dev
```

成功すると以下のメッセージが表示されます：
```
VITE v7.0.2  ready in XXXms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.181.112:5173/
```

## 🧪 認証システムテスト

### 3. ステップ1: 認証エンドポイントテスト

#### ヘルスチェック
```bash
curl http://localhost:8888/.netlify/functions/health
```

期待するレスポンス：
```json
{
  "status": "healthy",
  "timestamp": "2025-01-08T..."
}
```

#### ログインAPIテスト
```bash
curl -X POST "http://localhost:8888/.netlify/functions/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "test123"
  }'
```

期待するレスポンス：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "username": "admin",
      "role": "admin"
    },
    "expiresAt": "2025-01-09T..."
  }
}
```

#### 無効なログインテスト
```bash
curl -X POST "http://localhost:8888/.netlify/functions/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "wrong"
  }'
```

期待するレスポンス：
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

### 4. ステップ2: トークン検証テスト

上記のログインで取得したトークンを使用：

```bash
# トークンを変数に保存
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# トークン検証
curl -X POST "http://localhost:8888/.netlify/functions/auth/validate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

期待するレスポンス：
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "username": "admin",
      "role": "admin"
    },
    "expiresAt": "2025-01-09T...",
    "issuedAt": "2025-01-08T..."
  }
}
```

### 5. ステップ3: 保護されたAPIテスト

#### JWTトークンでMVV抽出テスト
```bash
curl -X POST "http://localhost:8888/.netlify/functions/extract-mvv" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "companyId": "test-001",
    "companyName": "テスト企業",
    "companyWebsite": "https://example.com"
  }'
```

#### APIキーでのテスト（既存方式）
```bash
curl -X POST "http://localhost:8888/.netlify/functions/extract-mvv" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mvv-extraction-2024-secure-key" \
  -d '{
    "companyId": "test-002", 
    "companyName": "APIキーテスト企業",
    "companyWebsite": "https://example.com"
  }'
```

どちらも成功するはずです（デュアル認証対応）。

### 6. ステップ4: フロントエンドUIテスト

#### ブラウザでアクセス
1. ブラウザで `http://localhost:5173/` にアクセス
2. 認証画面が表示されることを確認

#### ログインテスト
1. **ユーザー名**: `admin`
2. **パスワード**: `test123`
3. 「ログイン」ボタンをクリック

#### 成功確認
- ダッシュボードが表示される
- ヘッダーにセッション状態が表示される
- 「admin」として表示される
- セッション残り時間が表示される

#### ログアウトテスト
1. ヘッダーの「ログアウト」ボタンをクリック
2. ログイン画面に戻ることを確認

## 🐛 トラブルシューティング

### よくある問題と解決方法

#### 1. バックエンドが起動しない
**エラー**: `Missing environment variables`
**解決**: backend/.env ファイルの認証設定を確認

#### 2. フロントエンドで認証画面が表示されない
**エラー**: AuthGuard が機能していない
**解決**: frontend/.env.local の設定とAuthGuard実装を確認

#### 3. CORS エラー
**エラー**: `Access-Control-Allow-Origin`
**解決**: backend/.env の ALLOWED_ORIGINS にフロントエンドURLを追加

#### 4. JWT エラー
**エラー**: `secretOrPrivateKey has a minimum key size`
**解決**: JWT_SECRET を最低32文字以上に設定

#### 5. ログインできない
**確認項目**:
- ユーザー名: `admin`（大文字小文字区別）
- パスワード: `test123`
- ネットワーク接続
- バックエンドの動作状況

### デバッグコマンド

#### ログ確認
```bash
# バックエンドのログ確認
# netlify dev を実行しているターミナルでログを確認

# フロントエンドのブラウザコンソール
# F12 → Console タブでエラーを確認
```

#### ネットワーク確認
```bash
# バックエンドポート確認
netstat -an | grep 8888

# フロントエンドポート確認
netstat -an | grep 5173
```

## ✅ テスト完了チェックリスト

### バックエンドAPI
- [ ] ヘルスチェック成功
- [ ] ログインAPI（成功・失敗）テスト完了
- [ ] トークン検証API テスト完了
- [ ] JWTでの保護されたAPI アクセス成功
- [ ] APIキーでの既存API アクセス成功

### フロントエンドUI
- [ ] 認証画面の表示確認
- [ ] ログイン成功
- [ ] ダッシュボード表示確認
- [ ] セッション状態表示確認
- [ ] ログアウト機能確認

### セキュリティ
- [ ] レート制限テスト（連続5回以上のログイン失敗で制限）
- [ ] 無効なトークンでのAPI拒否確認
- [ ] セッション有効期限確認

### モバイル対応
- [ ] スマートフォンサイズでの表示確認
- [ ] タッチ操作の確認
- [ ] レスポンシブデザインの確認

## 🎯 次のステップ

テストが完了したら：

1. **本番環境デプロイ準備**
   - 本番用のパスワード設定
   - 本番用のJWT_SECRET生成
   - 環境変数の本番設定

2. **セキュリティ強化**
   - より複雑なパスワード設定
   - JWT_SECRET のセキュア生成
   - HTTPS での運用確認

3. **ユーザビリティテスト**
   - 実際の運用フロー確認
   - エラーハンドリングの改善
   - パフォーマンス最適化