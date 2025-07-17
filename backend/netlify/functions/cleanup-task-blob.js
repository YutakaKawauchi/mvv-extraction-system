const { getStore, connectLambda } = require('@netlify/blobs');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * Task Blob Cleanup API
 * 
 * 完了した非同期タスクのNetlify Blobsデータを削除する
 * フロントエンドがタスク結果を受信・処理完了後に呼び出される
 * 
 * URL Pattern: /.netlify/functions/cleanup-task-blob
 * Method: DELETE
 * Query Params: 
 *   - taskId: 必須、削除するタスクID
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

  if (event.httpMethod !== 'DELETE') {
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
    // 認証チェック
    const authResult = validateApiAccess(event);
    if (!authResult.valid) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: authResult.error || 'Authentication required' })
      };
    }

    // クエリパラメータの解析
    const queryParams = event.queryStringParameters || {};
    const { taskId } = queryParams;

    // 入力検証
    if (!taskId) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskId query parameter is required',
          example: '/.netlify/functions/cleanup-task-blob?taskId=async_12345'
        })
      };
    }

    logger.info('Task blob cleanup request', { 
      taskId,
      user: authResult.user?.username
    });

    // Netlify Blobsストアから削除
    const taskStore = getStore('async-task-results');
    
    // 削除前に存在確認
    const existingData = await taskStore.get(taskId);
    if (!existingData) {
      logger.warn('Task blob not found for cleanup', { taskId });
      return {
        statusCode: 404,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Task blob not found',
          taskId,
          message: 'The specified task blob does not exist or has already been deleted'
        })
      };
    }

    // 削除実行
    await taskStore.delete(taskId);
    
    // 削除確認
    const verifyDeleted = await taskStore.get(taskId);
    const deleted = !verifyDeleted;

    logger.info('Task blob cleanup completed', { 
      taskId,
      deleted,
      originalDataSize: existingData ? existingData.length : 0,
      user: authResult.user?.username
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        taskId,
        deleted,
        message: deleted ? 'Task blob deleted successfully' : 'Task blob may still exist',
        data: {
          taskId,
          deletedAt: Date.now(),
          originalDataSize: existingData ? existingData.length : 0
        }
      })
    };

  } catch (error) {
    logger.error('Task blob cleanup error', {
      taskId: event.queryStringParameters?.taskId,
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to cleanup task blob',
        message: error.message,
        taskId: event.queryStringParameters?.taskId || 'unknown'
      })
    };
  }
};