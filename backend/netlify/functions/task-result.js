const { getStore, connectLambda } = require('@netlify/blobs');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * タスク結果取得API (洗練された設計 v2.0)
 * 
 * result blob 専用の取得エンドポイント
 * 単一責任: 完了したタスクの結果のみを取得
 * 
 * URL Pattern: /.netlify/functions/task-result
 * Method: GET
 * Query Params: 
 *   - taskId: 必須、タスクID
 * 
 * Response:
 *   - 200: result blob が存在する場合（完了済み）
 *   - 404: result blob が存在しない場合（未完了または不存在）
 *   - 500: サーバーエラー
 */

exports.handler = async (event, context) => {
  // Netlify Blobs Lambda互換性のための初期化
  connectLambda(event);
  
  // Handle CORS preflight
  const corsResponse = handleCors(event);
  if (corsResponse) {
    return corsResponse;
  }

  // Get CORS headers for all responses
  const corsHeadersObj = corsHeaders(event.headers.origin || event.headers.Origin);

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed. Only GET is supported.' })
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

    // パラメータ取得
    const taskId = event.queryStringParameters?.taskId;
    if (!taskId) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskId parameter is required',
          usage: 'GET /task-result?taskId=your-task-id'
        })
      };
    }

    logger.info('Task result request', { taskId, user: authResult.user?.username });

    // Result blob から結果を取得
    const result = await getTaskResult(taskId);
    
    if (!result) {
      logger.info('Task result not found', { taskId });
      return {
        statusCode: 404,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Task result not found',
          taskId,
          message: 'The task has not completed yet or does not exist'
        })
      };
    }

    logger.info('Task result retrieved successfully', { 
      taskId, 
      hasResult: !!result.result,
      resultKeys: result.result ? Object.keys(result.result) : [],
      status: result.status
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
        status: result.status,
        result: result.result,
        metadata: result.metadata,
        timestamps: result.timestamps
      })
    };

  } catch (error) {
    logger.error('Task result retrieval error', {
      error: error.message,
      stack: error.stack,
      taskId: event.queryStringParameters?.taskId || 'unknown'
    });
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to retrieve task result',
        message: error.message
      })
    };
  }
};

/**
 * タスク結果の取得（result blob 専用）
 * 
 * @param {string} taskId - タスクID
 * @returns {Promise<Object|null>} - タスク結果またはnull
 */
async function getTaskResult(taskId) {
  try {
    const taskStore = getStore('async-task-results');
    const taskResultRaw = await taskStore.get(taskId);
    
    if (!taskResultRaw) {
      return null;
    }

    // JSON文字列をパース
    let taskResult;
    try {
      taskResult = typeof taskResultRaw === 'string' ? JSON.parse(taskResultRaw) : taskResultRaw;
    } catch (parseError) {
      logger.error('Failed to parse task result JSON', {
        taskId,
        dataType: typeof taskResultRaw,
        dataLength: taskResultRaw ? taskResultRaw.length : 0,
        dataSample: taskResultRaw ? String(taskResultRaw).substring(0, 100) : null,
        parseError: parseError.message
      });
      throw parseError;
    }

    // 結果の検証
    if (!taskResult || typeof taskResult !== 'object') {
      logger.warn('Invalid task result format', { taskId, resultType: typeof taskResult });
      return null;
    }

    // 必要なフィールドの確認
    if (!taskResult.result) {
      logger.warn('Task result missing result field', { 
        taskId, 
        availableFields: Object.keys(taskResult) 
      });
      return null;
    }

    logger.info('Task result parsed successfully', {
      taskId,
      status: taskResult.status,
      hasResult: !!taskResult.result,
      resultKeys: taskResult.result ? Object.keys(taskResult.result) : [],
      hasMetadata: !!taskResult.metadata,
      hasTimestamps: !!taskResult.timestamps
    });

    return taskResult;

  } catch (error) {
    logger.error('Failed to retrieve task result from blob', {
      taskId,
      error: error.message
    });
    throw error;
  }
}