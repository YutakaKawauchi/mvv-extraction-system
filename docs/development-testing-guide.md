# 開発環境テストガイド

**最終更新**: 2025-07-09  
**対象システム**: MVV抽出システム + 強化された企業管理システム

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

# APIキー設定
OPENAI_API_KEY=your-openai-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key
MVP_API_SECRET=mvv-extraction-2024-secure-key

# 環境設定
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://192.168.x.x:5173
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

## 🧪 APIテスト

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

### 5. ステップ3: 保護されたAPIテスト（既存機能）

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

### 6. ステップ4: 企業情報抽出APIテスト（新機能）

#### 企業情報抽出テスト
```bash
curl -X POST "http://localhost:8888/.netlify/functions/extract-company-info-perplexity" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mvv-extraction-2024-secure-key" \
  -d '{
    "companyId": "test-003",
    "companyName": "トヨタ自動車株式会社",
    "companyWebsite": "https://global.toyota/jp/"
  }'
```

期待するレスポンス：
```json
{
  "success": true,
  "data": {
    "establishedYear": 1937,
    "employeeCount": 372817,
    "capital": 635400000000,
    "industry": "自動車製造業",
    "location": {
      "address": "愛知県豊田市トヨタ町1番地",
      "prefecture": "愛知県",
      "city": "豊田市",
      "postalCode": "471-8571"
    },
    "businessDescription": "自動車の製造・販売",
    "jsicCategory": "輸送用機械器具製造業",
    "confidence": 0.92,
    "extractedFrom": "https://global.toyota/jp/company/profile/"
  },
  "metadata": {
    "processingTime": 8500,
    "timestamp": "2025-07-09T...",
    "source": "perplexity"
  }
}
```

### 7. ステップ5: 4段階自動パイプラインテスト（新機能）

#### フルパイプライン実行テスト
```bash
curl -X POST "http://localhost:8888/.netlify/functions/company-processor" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mvv-extraction-2024-secure-key" \
  -d '{
    "companyId": "test-004",
    "companyName": "ソニーグループ株式会社",
    "companyWebsite": "https://www.sony.com/ja/",
    "pipeline": {
      "steps": ["company", "mvv", "companyInfo", "jsicCategory"],
      "providers": {
        "mvv": "perplexity",
        "companyInfo": "perplexity"
      }
    }
  }'
```

期待するレスポンス：
```json
{
  "success": true,
  "data": {
    "pipelineId": "pipeline-test-004",
    "companyId": "test-004",
    "steps": {
      "company": {
        "status": "completed",
        "data": {
          "id": "test-004",
          "name": "ソニーグループ株式会社",
          "website": "https://www.sony.com/ja/"
        }
      },
      "mvv": {
        "status": "completed",
        "data": {
          "mission": "クリエイティビティとテクノロジーの力で、世界を感動で満たす",
          "vision": "テクノロジー・コンテンツ・サービスの企業として、世界を感動で満たす",
          "values": ["多様性", "クリエイティビティ", "テクノロジー"],
          "confidence_scores": {
            "mission": 0.95,
            "vision": 0.93,
            "values": 0.88
          }
        }
      },
      "companyInfo": {
        "status": "completed",
        "data": {
          "establishedYear": 1946,
          "employeeCount": 108900,
          "capital": 880214000000,
          "industry": "電子・電気機器",
          "location": {
            "address": "東京都港区港南1-7-1",
            "prefecture": "東京都",
            "city": "港区",
            "postalCode": "108-0075"
          },
          "jsicCategory": "電子部品・デバイス・電子回路製造業"
        }
      },
      "jsicCategory": {
        "status": "completed",
        "data": {
          "category": "電子部品・デバイス・電子回路製造業",
          "confidence": 0.95
        }
      }
    },
    "overallProgress": 1.0,
    "overallStatus": "completed"
  },
  "metadata": {
    "totalProcessingTime": 35800,
    "timestamp": "2025-07-09T...",
    "pipelineVersion": "1.0.0"
  }
}
```

#### パイプライン進捗確認
処理中に別のターミナルで進捗を確認：
```bash
curl -X GET "http://localhost:8888/.netlify/functions/pipeline-status/test-004" \
  -H "X-API-Key: mvv-extraction-2024-secure-key"
```

### 8. ステップ6: フロントエンドUIテスト

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

#### 新機能テスト
1. **企業情報ツールチップ**
   - 企業一覧で企業名にホバー
   - 詳細情報がツールチップで表示されることを確認
   - Markdownコピーボタンの動作確認

2. **4段階パイプラインUI**
   - MVV抽出画面で「完全自動処理」オプションを選択
   - 4段階のプログレスバーが表示されることを確認
   - 各ステップの成功/失敗が明確に表示されることを確認

3. **バックアップ・リストア機能**
   - 設定画面からバックアップを実行
   - 企業情報が含まれることを確認
   - 古い形式のバックアップをリストアして互換性を確認

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

## 🧪 ストレステスト

### 並列処理負荷テスト

#### 5企業同時処理（開発環境）
```bash
# 5社同時にMVV抽出を実行
for i in {1..5}; do
  curl -X POST "http://localhost:8888/.netlify/functions/extract-mvv-perplexity" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: mvv-extraction-2024-secure-key" \
    -d "{
      \"companyId\": \"stress-test-$i\",
      \"companyName\": \"テスト企業$i\",
      \"companyWebsite\": \"https://example$i.com\"
    }" &
done
wait
```

#### 2企業同時処理（本番環境推奨）
```bash
# 2社同時にフルパイプラインを実行
for i in {1..2}; do
  curl -X POST "http://localhost:8888/.netlify/functions/company-processor" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: mvv-extraction-2024-secure-key" \
    -d "{
      \"companyId\": \"pipeline-test-$i\",
      \"companyName\": \"パイプラインテスト$i\",
      \"companyWebsite\": \"https://pipeline$i.com\",
      \"pipeline\": {
        \"steps\": [\"company\", \"mvv\", \"companyInfo\", \"jsicCategory\"],
        \"providers\": {
          \"mvv\": \"perplexity\",
          \"companyInfo\": \"perplexity\"
        }
      }
    }" &
done
wait
```

### エラーハンドリングテスト

#### タイムアウトテスト
```bash
# 存在しないサイトでタイムアウトを引き起こす
curl -X POST "http://localhost:8888/.netlify/functions/extract-company-info-perplexity" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mvv-extraction-2024-secure-key" \
  -d '{
    "companyId": "timeout-test",
    "companyName": "存在しない企業",
    "companyWebsite": "https://this-site-does-not-exist-12345.com"
  }'
```

#### 部分失敗テスト
```bash
# MVVは成功、企業情報は失敗するケース
curl -X POST "http://localhost:8888/.netlify/functions/company-processor" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mvv-extraction-2024-secure-key" \
  -d '{
    "companyId": "partial-failure-test",
    "companyName": "部分失敗テスト企業",
    "companyWebsite": "https://example.com",
    "pipeline": {
      "steps": ["company", "mvv", "companyInfo", "jsicCategory"],
      "providers": {
        "mvv": "openai",
        "companyInfo": "perplexity"
      },
      "simulateFailure": ["companyInfo"]
    }
  }'
```

## ✅ テスト完了チェックリスト

### バックエンドAPI
- [ ] ヘルスチェック成功
- [ ] ログインAPI（成功・失敗）テスト完了
- [ ] トークン検証API テスト完了
- [ ] JWTでの保護されたAPI アクセス成功
- [ ] APIキーでの既存API アクセス成功
- [ ] 企業情報抽出API テスト完了
- [ ] 4段階パイプラインAPI テスト完了

### フロントエンドUI
- [ ] 認証画面の表示確認
- [ ] ログイン成功
- [ ] ダッシュボード表示確認
- [ ] セッション状態表示確認
- [ ] ログアウト機能確認
- [ ] 企業情報ツールチップ表示確認
- [ ] 4段階プログレスバー表示確認
- [ ] バックアップ・リストア機能確認

### セキュリティ
- [ ] レート制限テスト（連続5回以上のログイン失敗で制限）
- [ ] 無効なトークンでのAPI拒否確認
- [ ] セッション有効期限確認
- [ ] APIキー認証の正常動作確認
- [ ] CORS設定の正常動作確認

### パフォーマンス
- [ ] 同時処理テスト（開発: 5件、本番: 2件）
- [ ] タイムアウト処理の確認
- [ ] 部分失敗時の適切なハンドリング
- [ ] エラーリトライ機能の確認

### モバイル対応
- [ ] スマートフォンサイズでの表示確認
- [ ] タッチ操作の確認
- [ ] レスポンシブデザインの確認

## 🎯 トラブルシューティング補足

### 企業情報抽出が失敗する場合
**問題**: `extract-company-info-perplexity` が404や500を返す
**解決策**: 
- Perplexity APIキーの確認
- 企業ウェブサイトURLの有効性確認
- タイムアウト設定の調整（30秒→ 45秒）

### パイプラインが途中で止まる場合
**問題**: 4段階のうち特定のステップで停止
**解決策**:
- ログを確認して失敗ステップを特定
- 個別APIでのテストを実施
- 部分リトライ機能の使用

### JSIC分類が「その他」になる場合
**問題**: 産業分類が正しく判定されない
**解決策**:
- 企業情報のindustryフィールドを確認
- businessDescriptionの内容を確認
- 手動でJSICカテゴリを設定

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

4. **新機能の統合テスト**
   - CSVインポート→パイプライン実行の一連のフロー
   - バックアップ→リストア→データ検証
   - 大量データでのパフォーマンステスト

---

**最終更新日**: 2025-07-09  
**作成者**: Claude  
**対象システムバージョン**: 2.0.0（強化された企業管理システム）