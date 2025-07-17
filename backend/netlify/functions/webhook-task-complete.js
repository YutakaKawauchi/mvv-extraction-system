const { getStore, connectLambda } = require('@netlify/blobs');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * Webhook Handler for Background Function Task Completion
 * 
 * Background Functionから完了通知を受信し、結果をNetlify Blobsに保存
 * 
 * URL Pattern: /.netlify/functions/webhook-task-complete
 * Method: POST
 * 
 * Request Body:
 * {
 *   taskId: string,
 *   status: 'completed' | 'failed',
 *   result?: any,
 *   error?: string,
 *   metadata?: any
 * }
 */

exports.handler = async (event, context) => {
  // ログリクエスト記録（CORS対応のため必須）
  logger.apiRequest(event.httpMethod, event.path, event.headers, event.body);
  
  // Netlify Blobs Lambda互換性のための初期化
  connectLambda(event);
  
  // Handle CORS preflight
  const corsResponse = handleCors(event);
  if (corsResponse) {
    return corsResponse;
  }

  // Get CORS headers for all responses
  const corsHeadersObj = corsHeaders(event.headers.origin || event.headers.Origin);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 認証チェック - 内部呼び出しのため、APIキーまたはWebhook署名を確認
    const authResult = validateApiAccess(event);
    if (!authResult.valid) {
      // 内部呼び出しの場合、特別なヘッダーで認証を許可
      const isInternalCall = event.headers['x-background-function'] === 'true';
      if (!isInternalCall) {
        return {
          statusCode: 401,
          headers: {
            ...corsHeadersObj,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Authentication required' })
        };
      }
    }

    // リクエスト解析
    const requestBody = JSON.parse(event.body);
    const { 
      taskId,
      status,
      result,
      error,
      metadata = {}
    } = requestBody;

    // 入力検証
    if (!taskId || !status) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskId and status are required',
          received: { taskId, status }
        })
      };
    }

    // ステータス検証
    if (!['completed', 'failed'].includes(status)) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Invalid status. Must be "completed" or "failed"',
          received: status
        })
      };
    }

    logger.info('Webhook task completion received', {
      taskId,
      status,
      hasResult: !!result,
      hasError: !!error,
      metadataKeys: Object.keys(metadata),
      resultSize: result ? JSON.stringify(result).length : 0,
      resultPreview: result ? (typeof result === 'object' ? Object.keys(result) : String(result).substring(0, 100)) : null
    });

    // Netlify Blobsに結果を保存
    let taskStore;
    let taskResult;
    
    // 結果オブジェクトを準備
    taskResult = {
      taskId,
      status,
      result: result || null,
      error: error || null,
      metadata: {
        ...metadata,
        completedAt: Date.now(),
        processedBy: 'webhook-task-complete',
        version: '1.0.0'
      },
      timestamps: {
        receivedAt: Date.now(),
        completedAt: Date.now()
      }
    };
    
    try {
      // Netlify Blobsストアを初期化
      taskStore = getStore('async-task-results');
      
      // タスクIDをキーとして保存（JSON文字列として明示的に保存）
      const taskResultJson = JSON.stringify(taskResult);
      
      logger.info('About to save to Netlify Blobs', {
        taskId,
        taskResultType: typeof taskResult,
        taskResultJsonLength: taskResultJson.length,
        taskResultSample: taskResultJson.substring(0, 200) + '...'
      });
      
      await taskStore.set(taskId, taskResultJson);
      
      // 保存後の確認
      const savedData = await taskStore.get(taskId);
      logger.info('Verification of saved data', {
        taskId,
        savedDataExists: !!savedData,
        savedDataType: typeof savedData,
        savedDataLength: savedData ? savedData.length : 0,
        canParseAsJSON: savedData ? (() => {
          try {
            JSON.parse(savedData);
            return true;
          } catch {
            return false;
          }
        })() : false
      });
      
      logger.info('Task result saved to Netlify Blobs', {
        taskId,
        status,
        blobKey: taskId,
        originalResultSize: result ? JSON.stringify(result).length : 0,
        savedObjectSize: JSON.stringify(taskResult).length,
        savedObjectKeys: Object.keys(taskResult)
      });
    } catch (blobError) {
      logger.error('Failed to save to Netlify Blobs', {
        taskId,
        error: blobError.message,
        stack: blobError.stack
      });
      
      // エラーを再投げして、適切にエラーレスポンスを返す
      throw blobError;
    }

    // 成功時のログは上記のtryブロック内に移動済み

    // 成功レスポンス
    return {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        taskId,
        message: 'Task completion processed successfully',
        data: {
          taskId,
          status,
          savedAt: Date.now(),
          blobKey: taskId
        }
      })
    };

  } catch (error) {
    logger.error('Webhook task completion error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      requestBody: event.body
    });

    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to process task completion',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};