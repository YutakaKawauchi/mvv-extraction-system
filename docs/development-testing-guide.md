# 開発環境テストガイド

**最終更新**: 2025-07-13  
**対象システム**: MVV抽出システム + Phase 3完了（Visual Analytics Gallery + Professional Excel Export）

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

#### Phase 3新機能テスト
1. **企業情報ツールチップ**
   - 企業一覧で企業名にホバー
   - 詳細情報がツールチップで表示されることを確認
   - Markdownコピーボタンの動作確認

2. **4段階パイプラインUI**
   - MVV抽出画面で「完全自動処理」オプションを選択
   - 4段階のプログレスバーが表示されることを確認
   - 各ステップの成功/失敗が明確に表示されることを確認

3. **リアルタイム分析ダッシュボード（5つの分析機能）**
   - MVV分析タブにアクセス
   - 類似企業検索：企業選択→類似度ランキング表示
   - トレンド分析：業界フィルター→キーワード分析表示
   - ワードクラウド：独立タブ→インタラクティブ操作確認
   - ポジショニングマップ：MDS可視化→ドラッグナビゲーション
   - 独自性分析：スコア計算→ランキングテーブル表示
   - 品質評価：3軸評価→改善提案表示

4. **Visual Analytics Gallery（新機能）**
   - MVV分析タブ→「Visual Analytics」タブ選択
   - 各分析画面でのスクリーンショットキャプチャテスト
   - キャプチャ品質確認（2100×1350px高解像度）
   - IndexedDBストレージへの保存確認
   - TabID別分類確認（finder, trends, wordcloud等）
   - ストレージ使用量表示確認

5. **Professional Excel Export（新機能）**
   - Results画面→「Excel Export」ボタン
   - ステップバイステップウィザード操作
   - エクスポート設定：データシート選択、Visual Analytics含む/含まない
   - プレビュー画面確認：設定内容の表示
   - Excel生成・ダウンロード実行
   - 生成されたExcelファイルの確認：
     - Executive Summary シート
     - MVV Analysis (Simple) シート
     - MVV Analysis (Detail) シート
     - Company Master Data シート
     - Visual Analytics シート（画像付き）

6. **バックアップ・リストア機能**
   - 設定画面からバックアップを実行
   - 企業情報が含まれることを確認
   - 古い形式のバックアップをリストアして互換性を確認

7. **Admin Panel（隠しメニュー）**
   - Ctrl+Shift+A でアクセス
   - データ診断：企業データ整合性チェック
   - 回復ツール：バルク抽出、テスト実行
   - システム診断：API健全性確認

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

### Visual Analytics Gallery負荷テスト（新機能）

#### スクリーンショット連続キャプチャテスト
1. ブラウザでMVV分析画面を開く
2. Visual Analytics Galleryタブを選択
3. 各分析画面で連続キャプチャ（10回）を実行
4. IndexedDBストレージの応答時間を確認
5. メモリ使用量の増加を監視

#### 大量画像データExcel統合テスト
1. 50件のスクリーンショットを生成
2. Excel Export実行
3. 生成時間とファイルサイズを測定
4. 画像品質とレイアウトを確認

### リアルタイム分析パフォーマンステスト

#### 5つの分析機能同時負荷テスト
```javascript
// ブラウザのコンソールで実行
const testAnalysisPerformance = async () => {
  const startTime = performance.now();
  
  // 5つの分析を同時実行
  const promises = [
    // 類似企業検索
    analysisStore.findSimilarCompanies('company-1'),
    // トレンド分析
    analysisStore.calculateTrends('製造業'),
    // ワードクラウド生成
    analysisStore.generateWordCloud(['mission', 'vision']),
    // ポジショニングマップ
    analysisStore.calculatePositioning(),
    // 独自性分析
    analysisStore.calculateUniqueness('company-1')
  ];
  
  await Promise.all(promises);
  const endTime = performance.now();
  
  console.log(`5分析同時実行時間: ${Math.round(endTime - startTime)}ms`);
};

testAnalysisPerformance();
```

#### キャッシュ効率テスト
```javascript
// ブラウザのコンソールで実行
const testCacheEfficiency = async () => {
  const companyId = 'test-company-1';
  
  // 初回計算（キャッシュミス）
  const start1 = performance.now();
  await analysisStore.calculateSimilarity(companyId, 'test-company-2');
  const time1 = performance.now() - start1;
  
  // 2回目計算（キャッシュヒット）
  const start2 = performance.now();
  await analysisStore.calculateSimilarity(companyId, 'test-company-2');
  const time2 = performance.now() - start2;
  
  console.log(`キャッシュミス: ${Math.round(time1)}ms`);
  console.log(`キャッシュヒット: ${Math.round(time2)}ms`);
  console.log(`高速化率: ${Math.round((time1 - time2) / time1 * 100)}%`);
};

testCacheEfficiency();
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

### フロントエンドUI（基本機能）
- [ ] 認証画面の表示確認
- [ ] ログイン成功
- [ ] ダッシュボード表示確認
- [ ] セッション状態表示確認
- [ ] ログアウト機能確認
- [ ] 企業情報ツールチップ表示確認
- [ ] 4段階プログレスバー表示確認
- [ ] バックアップ・リストア機能確認

### Phase 3新機能（リアルタイム分析）
- [ ] 類似企業検索：企業選択→類似度計算→ランキング表示
- [ ] トレンド分析：業界フィルター→形態素解析→キーワード抽出
- [ ] ワードクラウド：独立タブ→インタラクティブ操作→ズーム/パン
- [ ] ポジショニングマップ：MDS計算→2D可視化→ドラッグナビゲーション
- [ ] 独自性分析：4要素スコア→ランキングテーブル→詳細分解
- [ ] 品質評価：3軸評価→改善提案→ベンチマーク比較

### Visual Analytics Gallery（新機能）
- [ ] スクリーンショットキャプチャ：高解像度（2100×1350px）撮影成功
- [ ] IndexedDBストレージ：メタデータ+画像データ永続化確認
- [ ] TabID分類：finder/trends/wordcloud/positioning/uniqueness/quality
- [ ] ストレージ管理：使用量表示、自動LRU削除（50件上限）
- [ ] 画像品質：PNG形式、高品質（95%品質）維持

### Professional Excel Export（新機能）
- [ ] エクスポートウィザード：3ステップ（設定→プレビュー→生成）
- [ ] データシート生成：Executive Summary, MVV Analysis, Company Master
- [ ] Visual Analytics統合：TabID別画像シート自動生成
- [ ] Excel高度機能：ウィンドウ固定、オートフィルタ、条件付き書式
- [ ] ファイル品質：レイアウト、画像表示、データ整合性
- [ ] ダウンロード機能：適切なファイル名、実行時間確認

### Admin Panel（隠しメニュー）
- [ ] 隠しアクセス：Ctrl+Shift+A→管理者パネル表示
- [ ] データ診断：企業データ整合性、MVV完全性チェック
- [ ] 回復ツール：バルク抽出、単体テスト、バッチ処理
- [ ] システム診断：API健全性、パフォーマンス監視

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
- [ ] リアルタイム分析レスポンス時間（<1秒目標）
- [ ] LRUキャッシュ効率（50%+ヒット率目標）
- [ ] Visual Analytics キャプチャ時間（<1秒目標）
- [ ] Excel生成時間（50件画像で<5秒目標）

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

### Visual Analytics Gallery関連問題

#### スクリーンショットキャプチャが失敗する場合
**問題**: 画像が生成されない、または品質が低い
**解決策**:
- html2canvasライブラリの動作確認
- ブラウザのCanvas APIサポート確認
- 対象要素の表示状態確認（display: none等）
- キャプチャ対象領域のサイズ確認

#### IndexedDBストレージエラー
**問題**: 画像保存/読み込みに失敗
**解決策**:
- ブラウザのIndexedDBサポート確認
- ストレージ容量制限チェック（Chrome: ~75% of disk）
- データベーススキーマの確認
- プライベートブラウジングモードの無効化

#### Excel画像統合エラー
**問題**: ExcelファイルにVBase64が正しく埋め込まれない
**解決策**:
```javascript
// ブラウザ環境でのArrayBuffer変換確認
const testBase64Conversion = (base64Data) => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log('変換成功:', bytes.buffer.byteLength, 'bytes');
    return bytes.buffer;
  } catch (error) {
    console.error('Base64変換エラー:', error);
    return null;
  }
};
```

### リアルタイム分析関連問題

#### 分析処理が遅い場合
**問題**: 類似度計算やスコアリングに時間がかかる
**解決策**:
- LRUキャッシュのヒット率確認
- 計算対象データの件数確認
- ブラウザの開発者ツールでメモリ使用量監視
- Web Workersの利用検討（重い計算処理）

#### キャッシュが機能しない場合
**問題**: 同じ計算を繰り返し実行してしまう
**解決策**:
```javascript
// キャッシュ動作確認
const debugCache = () => {
  const cache = analysisStore.similarityCache;
  console.log('キャッシュサイズ:', cache.size);
  console.log('キャッシュ内容:', Array.from(cache.keys()).slice(0, 10));
  
  // ヒット率計算
  const stats = analysisStore.getCacheStats();
  console.log('ヒット率:', (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1) + '%');
};
```

#### ワードクラウドが表示されない場合
**問題**: インタラクティブワードクラウドが空白
**解決策**:
- 形態素解析データの確認
- TinySegmenterの動作確認
- キーワード頻度データの検証
- Canvas/SVGレンダリングエラーの確認

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

4. **Phase 3機能の統合テスト**
   - CSVインポート→パイプライン実行→リアルタイム分析の一連のフロー
   - MVV分析→Visual Analytics Gallery→Excel Export統合フロー
   - 大量データでのパフォーマンステスト（94社+Visual Analytics）
   - リアルタイム分析5機能の安定性確認

5. **Phase 4準備**
   - AI-powered insights機能の技術検証
   - 多言語対応の基盤テスト
   - エンタープライズ機能の要件定義
   - 1000社規模スケーラビリティの事前検証

---

**最終更新日**: 2025-07-13  
**作成者**: Claude  
**対象システムバージョン**: 3.0.0（Phase 3完了：Visual Analytics Gallery + Professional Excel Export）