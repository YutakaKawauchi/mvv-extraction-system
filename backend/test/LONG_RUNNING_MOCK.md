# 長時間処理モックサービス (Phase ε.3.2)

このドキュメントは、5-15分の長時間処理をシミュレートするモックサービスの使用方法を説明します。実際のAPI呼び出しなしで非同期タスクシステムの完全なテストが可能になります。

## モックサービス概要

### 目的
- **完全無料テスト**: 実際のAPI呼び出しなしで長時間処理をテスト
- **シナリオベース**: 成功・タイムアウト・エラー・断続的障害をシミュレート
- **段階的プログレス**: リアルタイムの進捗更新をテスト
- **フル機能テスト**: ポーリング、エラーハンドリング、リトライ機能をテスト

### 対応シナリオ
1. **success**: 正常完了（設定時間で完了）
2. **timeout**: タイムアウトシミュレート（80%進捗でタイムアウト）
3. **error**: エラーシミュレート（50%進捗でエラー）
4. **intermittent**: 断続的エラー（30%、70%でエラー後回復）
5. **slow**: スロータスク（重い計算処理シミュレート）

## API仕様

### エンドポイント
```
POST /.netlify/functions/long-running-mock
```

### リクエスト例
```bash
curl -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "scenario": "success",
    "duration": 300000,
    "progressSteps": 10,
    "taskType": "mock-verification"
  }'
```

### パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|---|-----------|------|
| `scenario` | string | "success" | 実行シナリオ（success/timeout/error/intermittent/slow） |
| `duration` | number | 300000 | 実行時間（ミリ秒）※5分デフォルト |
| `progressSteps` | number | 10 | プログレスステップ数 |
| `taskType` | string | "mock-task" | タスクタイプ（ログ用） |
| `taskId` | string | 自動生成 | タスクID（省略可） |

### レスポンス例
```json
{
  "success": true,
  "taskId": "mock_1642345678901_task_abc123",
  "message": "Long-running mock task initiated",
  "data": {
    "scenario": "success",
    "estimatedDuration": 300000,
    "progressSteps": 10,
    "pollingUrl": "/.netlify/functions/task-status?taskId=mock_1642345678901_task_abc123",
    "statusCheckInterval": 2000,
    "mockTask": true
  },
  "metadata": {
    "initiatedAt": 1642345678901,
    "expectedCompletionTime": 1642345978901,
    "mockScenario": "success",
    "realApiCost": "$0.00"
  }
}
```

## 使用例

### 1. 基本的な成功シナリオテスト
```bash
# 5分間の正常処理をテスト
curl -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "success",
    "duration": 300000,
    "progressSteps": 15
  }'
```

### 2. 高速テスト（開発用）
```bash
# 30秒の高速テスト
curl -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "success",
    "duration": 30000,
    "progressSteps": 5
  }'
```

### 3. タイムアウトシナリオテスト
```bash
# 10分設定で8分時点でタイムアウト
curl -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "timeout",
    "duration": 600000,
    "progressSteps": 20
  }'
```

### 4. エラーシナリオテスト
```bash
# 5分設定で2.5分時点でエラー
curl -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "error",
    "duration": 300000,
    "progressSteps": 10
  }'
```

### 5. 断続的エラーシナリオテスト
```bash
# 一時的エラーからの回復をテスト
curl -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "intermittent",
    "duration": 240000,
    "progressSteps": 12
  }'
```

## プログレス確認

### ポーリングでステータス確認
```bash
# 2秒間隔でステータスをポーリング
curl "http://localhost:8888/.netlify/functions/task-status?taskId=mock_1642345678901_task_abc123"
```

### プログレスレスポンス例
```json
{
  "success": true,
  "taskId": "mock_1642345678901_task_abc123",
  "data": {
    "id": "mock_1642345678901_task_abc123",
    "type": "mock-verification",
    "status": "processing",
    "progress": {
      "percentage": 60,
      "currentStep": "Performing competitive analysis",
      "estimatedTimeRemaining": 120000,
      "detailedSteps": [
        {
          "stepName": "Initializing task environment",
          "status": "completed",
          "duration": 30000,
          "timestamp": 1642345708901
        },
        {
          "stepName": "Loading company data",
          "status": "completed",
          "duration": 30000,
          "timestamp": 1642345738901
        }
      ]
    },
    "timestamps": {
      "createdAt": 1642345678901,
      "startedAt": 1642345678901,
      "lastUpdatedAt": 1642345858901,
      "completedAt": null
    }
  },
  "metadata": {
    "polledAt": 1642345858901,
    "continuePoll": true,
    "mock": true,
    "scenario": "success",
    "longRunningTest": true
  }
}
```

### 完了時のレスポンス例
```json
{
  "success": true,
  "taskId": "mock_1642345678901_task_abc123",
  "data": {
    "id": "mock_1642345678901_task_abc123",
    "type": "mock-verification",
    "status": "completed",
    "progress": {
      "percentage": 100,
      "currentStep": "Finalizing output",
      "estimatedTimeRemaining": 0
    },
    "result": {
      "taskId": "mock_1642345678901_task_abc123",
      "scenario": "success",
      "processingTime": 300000,
      "mockGenerated": true,
      "realApiCost": 0.00,
      "success": true,
      "data": {
        "overallAssessment": {
          "overallScore": {
            "viabilityScore": 85,
            "innovationScore": 92,
            "marketPotentialScore": 78,
            "totalScore": 85
          },
          "recommendation": {
            "decision": "GO",
            "reasoning": "Mock analysis shows strong potential across all metrics"
          }
        }
      }
    },
    "timestamps": {
      "createdAt": 1642345678901,
      "startedAt": 1642345678901,
      "lastUpdatedAt": 1642345978901,
      "completedAt": 1642345978901
    }
  },
  "metadata": {
    "polledAt": 1642345978901,
    "continuePoll": false,
    "mock": true,
    "scenario": "success",
    "longRunningTest": true
  }
}
```

## テスト自動化

### Jest テストスイート統合
```bash
# モックサービステストを含む全テスト実行
npm run test:mock

# モックサービスのみテスト
npm test -- --testNamePattern="Long-Running Mock Service"
```

### テストスイートでの利用
```javascript
// 自動テストでの利用例
describe('Long-Running Mock Service', () => {
  test('should complete 5-minute task successfully', async () => {
    const response = await makeRequest('/long-running-mock', {
      method: 'POST',
      body: JSON.stringify({
        scenario: 'success',
        duration: 300000,
        progressSteps: 10
      })
    });
    
    expect(response.data.success).toBe(true);
    expect(response.data.taskId).toMatch(/^mock_\\d+_task_[a-z0-9]+$/);
  });
});
```

## シナリオ詳細

### 1. Success シナリオ
- **実行時間**: 設定時間通り
- **プログレス**: 均等に進捗
- **ステップ例**: 
  1. Initializing task environment
  2. Loading company data
  3. Analyzing business context
  4. Generating industry insights
  5. Performing competitive analysis
  6. Validating business model
  7. Generating recommendations
  8. Compiling final results
  9. Quality assurance check
  10. Finalizing output

### 2. Timeout シナリオ
- **実行時間**: 設定時間の80%で停止
- **エラー**: `MOCK_TIMEOUT`
- **リトライ可能**: `true`

### 3. Error シナリオ
- **実行時間**: 設定時間の50%で停止
- **エラー**: `MOCK_API_ERROR`
- **リトライ可能**: `false`

### 4. Intermittent シナリオ
- **エラー発生**: 30%、70%進捗時点
- **回復**: エラー後自動回復
- **最終結果**: 成功

### 5. Slow シナリオ
- **特徴**: 重い計算処理をシミュレート
- **プログレス**: 通常より詳細なステップ名
- **実行時間**: 設定通り（ステップ名が「重い処理」を示す）

## パフォーマンス & メモリ管理

### メモリ使用量
- **タスク状態**: Map()ベースのインメモリ管理
- **自動クリーンアップ**: 24時間経過後に自動削除
- **推奨同時実行数**: 最大50タスク

### ログ出力
```
INFO: Starting long-running mock task { taskId: "mock_...", scenario: "success", duration: 300000 }
INFO: Mock task completed { taskId: "mock_...", status: "completed", duration: 300000 }
```

## トラブルシューティング

### よくある問題

#### 1. タスクが見つからない
```json
{
  "error": "Task not found",
  "taskId": "mock_invalid_id"
}
```
**解決**: タスクIDが正しいか確認。24時間経過後は自動削除される。

#### 2. 不正なシナリオ
```json
{
  "error": "Invalid scenario",
  "scenario": "invalid",
  "validScenarios": ["success", "timeout", "error", "intermittent", "slow"]
}
```
**解決**: 有効なシナリオ名を使用。

#### 3. メモリ不足
**解決**: 長時間実行タスクを定期的にクリーンアップ。

## 統合テスト例

### フロントエンド統合テスト
```typescript
// React component での利用例
const { startTask } = useAsyncTask();

const testLongRunningProcess = async () => {
  const task = await startTask({
    type: 'mock-task',
    inputData: {
      scenario: 'success',
      duration: 60000, // 1分テスト
      progressSteps: 6
    }
  });
  
  // ポーリング開始（useAsyncTaskが自動処理）
  console.log('Task started:', task.id);
};
```

### E2Eテスト
```bash
#!/bin/bash
# 完全なE2Eテストスクリプト

echo "Starting E2E Long-Running Mock Test..."

# 1. タスク開始
RESPONSE=$(curl -s -X POST "http://localhost:8888/.netlify/functions/long-running-mock" \
  -H "Content-Type: application/json" \
  -d '{"scenario":"success","duration":60000,"progressSteps":6}')

TASK_ID=$(echo $RESPONSE | jq -r '.taskId')
echo "Task started: $TASK_ID"

# 2. ポーリング
for i in {1..30}; do
  STATUS=$(curl -s "http://localhost:8888/.netlify/functions/task-status?taskId=$TASK_ID")
  PROGRESS=$(echo $STATUS | jq -r '.data.progress.percentage')
  CURRENT_STATUS=$(echo $STATUS | jq -r '.data.status')
  
  echo "Progress: $PROGRESS% - Status: $CURRENT_STATUS"
  
  if [ "$CURRENT_STATUS" = "completed" ]; then
    echo "Task completed successfully!"
    exit 0
  elif [ "$CURRENT_STATUS" = "failed" ]; then
    echo "Task failed!"
    exit 1
  fi
  
  sleep 3
done

echo "Test timeout"
exit 1
```

## 本番環境での利用

### 注意事項
- **開発・テスト専用**: 本番環境での使用は想定していません
- **認証**: 本番環境では認証チェックが有効
- **ログ**: 全活動がログに記録される

### 無効化方法
```javascript
// 本番環境での無効化
if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_MOCK_SERVICE) {
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Mock service disabled in production' })
  };
}
```

## まとめ

この長時間処理モックサービスにより、以下が可能になります：

1. **完全無料テスト**: 実際のAPI課金なしで長時間処理をテスト
2. **包括的シナリオ**: 成功・失敗・タイムアウト・断続的エラーをテスト
3. **リアルな体験**: 実際の非同期処理と同じUXをテスト
4. **開発効率**: 実際のAPI待機時間なしで開発可能
5. **自動化対応**: CI/CDパイプラインでの自動テスト

これで、ユーザーの質問「ローカルで長時間のモックサービスを作ってテストをしていますか？」に対して、完全な長時間処理モックサービスを提供できました。