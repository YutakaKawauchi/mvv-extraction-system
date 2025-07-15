# 本番環境コンソールテストガイド

## 🌐 本番環境での長時間モックサービステスト

### 前提条件
- 本番環境URL: https://your-username.github.io（実際のURLに置換）
- ブラウザのDevTools（F12）を使用
- 認証済みの状態

## 1. 基本テスト用JavaScriptコード

### コンソールにコピー＆ペーストして実行：

```javascript
// 本番環境長時間モックサービステスト
async function testLongRunningMockProduction() {
    console.log('🚀 Starting Production Long-Running Mock Test');
    console.log('Time:', new Date().toLocaleTimeString());
    
    const API_BASE = 'https://your-username.github.io/.netlify/functions'; // 本番URL（実際のURLに置換）
    
    // APIキーを環境から取得（実際の値はユーザーが設定）
    const apiKey = localStorage.getItem('apiKey') || prompt('Enter API Key:');
    if (!apiKey) {
        console.error('❌ API Key required');
        return;
    }
    
    try {
        // Step 1: モックタスク開始
        console.log('📡 Starting mock task...');
        const startResponse = await fetch(`${API_BASE}/long-running-mock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                scenario: 'success',
                duration: 30000, // 30秒テスト
                progressSteps: 6,
                taskType: 'production-console-test'
            })
        });
        
        if (!startResponse.ok) {
            throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
        }
        
        const startData = await startResponse.json();
        console.log('✅ Task started:', startData);
        
        const taskId = startData.taskId;
        if (!taskId) {
            throw new Error('No task ID received');
        }
        
        // Step 2: ポーリング開始
        console.log('🔄 Starting polling for task:', taskId);
        let pollCount = 0;
        const maxPolls = 20;
        
        const pollInterval = setInterval(async () => {
            try {
                pollCount++;
                console.log(`📊 Poll ${pollCount}/${maxPolls}`);
                
                const statusResponse = await fetch(`${API_BASE}/task-status?taskId=${taskId}`, {
                    method: 'GET',
                    headers: {
                        'X-API-Key': apiKey
                    }
                });
                
                if (!statusResponse.ok) {
                    throw new Error(`Status check failed: ${statusResponse.status}`);
                }
                
                const statusData = await statusResponse.json();
                const status = statusData?.data?.data?.status;
                const progress = statusData?.data?.data?.progress?.percentage;
                const currentStep = statusData?.data?.data?.progress?.currentStep;
                
                console.log(`📈 Status: ${status}, Progress: ${progress}%, Step: ${currentStep}`);
                
                // 完了チェック
                if (status === 'completed' || status === 'failed') {
                    clearInterval(pollInterval);
                    console.log('🎉 Test completed!');
                    console.log('📋 Final result:', statusData?.data?.data?.result);
                    console.log('⏱️ Total polls:', pollCount);
                    return;
                }
                
                // タイムアウトチェック
                if (pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    console.log('⏰ Polling timeout reached');
                    return;
                }
                
            } catch (error) {
                console.error(`❌ Poll ${pollCount} error:`, error);
            }
        }, 5000); // 5秒間隔（サーバー負荷軽減）
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('📍 Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
}

// 実行
testLongRunningMockProduction();
```

## 2. 短縮版テストコード（簡単コピペ用）

```javascript
// 簡単テスト版
(async () => {
    const apiKey = localStorage.getItem('apiKey') || 'your-api-key-here';
    const base = 'https://your-username.github.io/.netlify/functions'; // 実際のURLに置換
    
    console.log('🚀 Starting test...');
    
    // タスク開始
    const r1 = await fetch(`${base}/long-running-mock`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': apiKey},
        body: JSON.stringify({scenario: 'success', duration: 15000, progressSteps: 3})
    });
    const d1 = await r1.json();
    console.log('✅ Started:', d1.taskId);
    
    // ポーリング
    for (let i = 1; i <= 10; i++) {
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

## 3. エラー診断用コード

```javascript
// デバッグ用詳細ログ
async function debugProductionAPI() {
    const apiKey = 'your-api-key-here';
    const base = 'https://your-username.github.io/.netlify/functions'; // 実際のURLに置換
    
    console.log('🔍 Debug: Checking API endpoints...');
    
    // Health check
    try {
        const health = await fetch(`${base}/health`);
        console.log('💚 Health:', await health.json());
    } catch (e) {
        console.error('❌ Health failed:', e);
    }
    
    // Auth test
    try {
        const auth = await fetch(`${base}/task-status?taskId=test`, {
            headers: {'X-API-Key': apiKey}
        });
        console.log('🔐 Auth test:', auth.status, await auth.json());
    } catch (e) {
        console.error('❌ Auth failed:', e);
    }
}

// 実行
debugProductionAPI();
```

## 4. テスト手順

### Step 1: 本番環境にアクセス
1. https://your-username.github.io を開く（実際のURLに置換）
2. F12でDevToolsを開く
3. Consoleタブに移動

### Step 2: APIキー設定
```javascript
// APIキーを設定（一度だけ）
localStorage.setItem('apiKey', 'your-actual-production-api-key');
```

### Step 3: テスト実行
上記のコードをコンソールにコピー＆ペーストして実行

### Step 4: ログ収集
- ✅ 開始ログ
- 📊 ポーリングログ（進捗状況）
- 🎉 完了ログ
- ❌ エラーログ（もしあれば）

## 5. 期待される出力例

```
🚀 Starting Production Long-Running Mock Test
Time: 11:30:15 AM
📡 Starting mock task...
✅ Task started: {taskId: "mock_...", success: true, ...}
🔄 Starting polling for task: mock_1234567890_task_abc123
📊 Poll 1/20
📈 Status: processing, Progress: 0%, Step: Starting mock task...
📊 Poll 2/20
📈 Status: processing, Progress: 17%, Step: Initializing task environment
📊 Poll 3/20
📈 Status: processing, Progress: 33%, Step: Loading company data
📊 Poll 4/20
📈 Status: processing, Progress: 50%, Step: Analyzing business context
📊 Poll 5/20
📈 Status: processing, Progress: 67%, Step: Generating industry insights
📊 Poll 6/20
📈 Status: processing, Progress: 83%, Step: Performing competitive analysis
📊 Poll 7/20
📈 Status: completed, Progress: 100%, Step: Finalizing output
🎉 Test completed!
📋 Final result: {overallAssessment: {...}, metadata: {...}}
⏱️ Total polls: 7
```

## 6. ログ解析ポイント

### 成功パターン確認
- [ ] タスク開始成功（200 OK）
- [ ] taskId正常取得
- [ ] ポーリング応答正常
- [ ] プログレス段階的更新
- [ ] 最終完了確認

### エラーパターン確認
- [ ] CORS エラー
- [ ] 認証エラー（401）
- [ ] タイムアウトエラー
- [ ] ネットワークエラー
- [ ] JSON解析エラー

### パフォーマンス確認
- [ ] 開始レスポンス時間
- [ ] ポーリング間隔の一貫性
- [ ] 全体完了時間
- [ ] メモリ使用量

## 7. トラブルシューティング

### CORS エラーの場合
```javascript
// CORS確認
fetch('https://your-username.github.io/.netlify/functions/health', {
    method: 'OPTIONS'
}).then(r => console.log('CORS headers:', Object.fromEntries(r.headers)));
```

### 認証エラーの場合
```javascript
// 認証テスト
fetch('https://your-username.github.io/.netlify/functions/health')
.then(r => r.json())
.then(d => console.log('Unauth health:', d));
```

## 8. 結果レポート例

```
=== 本番環境テスト結果 ===
テスト時刻: 2025-07-15 11:30:15
環境: Production (https://your-username.github.io)
シナリオ: Success (30秒)

✅ 成功項目:
- タスク開始: 成功 (200ms)
- ポーリング: 成功 (15回)
- プログレス更新: 正常 (0%→100%)
- 完了検出: 正常

📊 パフォーマンス:
- 開始時間: 200ms
- 総実行時間: 30.2秒
- ポーリング間隔: 2.0秒±0.1秒
- 完了検出: リアルタイム

🌐 本番環境特有の確認点:
- CORS設定: ✅ 正常
- CDN経由: ✅ 正常  
- 認証: ✅ 正常
- レート制限: ✅ 制限内
```

このようなログを貼り付けていただければ、本番環境での動作状況を詳細に解析できます！