# 本番環境テストガイド 🌐

## 📋 概要

本番環境での長時間モックサービステストの実行方法を説明します。ブラウザの画面とコンソールの両方でテストが可能です。

## 🎯 テスト方法

### 方法1: UI画面でのテスト（推奨）

#### 1. 本番サイトにアクセス
- URL: https://your-username.github.io（実際のURLに置換）
- ログインして認証済み状態にする

#### 2. デバッグモード起動
```
Ctrl + Shift + D
```
- キーボードショートカットでデバッグパネルが表示されます
- 本番環境では警告が表示されますが、テスト目的なので問題ありません

#### 3. テスト設定
デバッグパネルで以下を設定：
- **Scenario**: success/error/timeout/intermittent から選択
- **Duration**: テスト時間（ミリ秒）例：30000 = 30秒
- **Progress Steps**: 進捗ステップ数（3-20）

#### 4. テスト実行
- "▶️ Start Test" ボタンをクリック
- リアルタイムでログが表示される
- ポーリング状況、進捗、完了状態が確認できる

#### 5. ログ収集
- "📋 Copy Logs" ボタンでログをクリップボードにコピー
- ログを貼り付けて解析を依頼

### 方法2: ブラウザコンソールでのテスト

#### 1. DevTools起動
- F12キーまたは右クリック→「検証」
- Consoleタブを選択

#### 2. テストコード実行
```javascript
// 簡単テスト（30秒）
(async () => {
    const base = 'https://your-username.github.io/.netlify/functions'; // 実際のURLに置換
    const apiKey = 'your-api-key'; // 実際のAPIキーに置換
    
    console.log('🚀 Starting test...');
    
    // タスク開始
    const r1 = await fetch(`${base}/long-running-mock`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify({scenario: 'success', duration: 30000, progressSteps: 6})
    });
    const d1 = await r1.json();
    console.log('✅ Started:', d1.taskId);
    
    // ポーリング
    for (let i = 1; i <= 20; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const r2 = await fetch(`${base}/task-status?taskId=${d1.taskId}`, {
            headers: {'X-API-Key': apiKey}
        });
        const d2 = await r2.json();
        const s = d2?.data?.data?.status;
        const p = d2?.data?.data?.progress?.percentage;
        console.log(`📊 Poll ${i}: ${s} (${p}%)`);
        if (s === 'completed' || s === 'failed') break;
    }
    console.log('🎉 Done!');
})();
```

## 📊 期待される結果

### 成功パターン
```
🚀 Starting Production Long-Running Mock Test
📡 Starting mock task...
✅ Task started successfully
Task ID: mock_1234567890_task_abc123
🔄 Starting polling...
📊 Poll 1/20
📈 Status: processing, Progress: 0%, Step: Starting mock task...
📊 Poll 2/20  
📈 Status: processing, Progress: 17%, Step: Initializing task environment
📊 Poll 3/20
📈 Status: processing, Progress: 33%, Step: Loading company data
...
📊 Poll 15/20
📈 Status: completed, Progress: 100%, Step: Finalizing output
🎉 Test completed successfully!
⏱️ Total polls: 15
```

### 確認ポイント
- ✅ タスク開始成功（taskId取得）
- ✅ ポーリング応答正常（5秒間隔）
- ✅ プログレス段階的更新（0%→100%）
- ✅ ステータス遷移（processing→completed）
- ✅ 最終結果取得

## 🚨 エラーパターン

### CORS エラー
```
❌ Test failed: Failed to fetch
Error details: {message: "Failed to fetch", stack: "..."}
```

### 認証エラー
```
❌ Poll 1 error: HTTP 401: Unauthorized
```

### タイムアウト
```
⏰ Polling timeout reached
```

## 🔍 ログ解析のお願い

以下の情報を含むログを貼り付けてください：

1. **開始ログ**: タスクID、設定情報
2. **ポーリングログ**: 進捗の変化
3. **完了/エラーログ**: 最終結果
4. **エラー詳細**: もしエラーが発生した場合

### ログ例
```
[11:30:15] INFO: 🚀 Starting Production Long-Running Mock Test
[11:30:15] INFO: Scenario: success, Duration: 30000ms, Steps: 6
[11:30:15] INFO: 📡 Starting mock task...
[11:30:16] SUCCESS: ✅ Task started successfully
[11:30:16] INFO: Task ID: mock_1234567890_task_abc123
[11:30:16] INFO: 🔄 Starting polling...
[11:30:18] INFO: 📊 Poll 1/20
[11:30:18] INFO: 📈 Status: processing, Progress: 0%, Step: Starting mock task...
...
```

## 🔧 トラブルシューティング

### 1. デバッグパネルが表示されない
- キーボードショートカット再実行: `Ctrl + Shift + D`
- ページ再読み込み後に再試行
- ブラウザのDevToolsでエラーチェック

### 2. APIエラーが発生する
```javascript
// ヘルスチェック
fetch('https://your-username.github.io/.netlify/functions/health')
.then(r => r.json())
.then(d => console.log('Health:', d));
```

### 3. 認証エラーが発生する
- ログイン状態を確認
- セッション期限を確認
- 再ログインを試行

## 📈 期待されるパフォーマンス

- **開始レスポンス**: 200-500ms
- **ポーリング間隔**: 5.0秒±0.1秒
- **プログレス更新**: 段階的（設定ステップ数に応じて）
- **完了検出**: リアルタイム
- **総処理時間**: 設定時間±10%

## 🎯 テストシナリオ推奨例

### クイックテスト（15秒）
- Scenario: success
- Duration: 15000
- Progress Steps: 3

### 標準テスト（30秒）
- Scenario: success  
- Duration: 30000
- Progress Steps: 6

### エラーテスト（20秒）
- Scenario: error
- Duration: 20000
- Progress Steps: 4

### 長時間テスト（2分）
- Scenario: intermittent
- Duration: 120000
- Progress Steps: 10

ログを貼り付けていただければ、本番環境での動作状況を詳細に解析いたします！