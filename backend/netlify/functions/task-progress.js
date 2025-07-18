const { getStore, connectLambda } = require('@netlify/blobs');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * Task Progress API
 * 
 * 非同期タスクの進捗情報を取得する
 * バックグラウンドAPIが保存した進捗情報をNetlify Blobsから取得
 * 
 * URL Pattern: /.netlify/functions/task-progress
 * Method: GET
 * Query Params: 
 *   - taskId: 必須、進捗を取得するタスクID
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Method not allowed' 
      })
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
        body: JSON.stringify({ 
          success: false,
          error: authResult.error || 'Authentication required' 
        })
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
          success: false,
          error: 'taskId query parameter is required',
          example: '/.netlify/functions/task-progress?taskId=async_12345'
        })
      };
    }

    logger.info('Task progress request', { 
      taskId,
      user: authResult.user?.username
    });

    // Netlify Blobsから進捗情報を取得
    const taskStore = getStore('async-task-results');
    
    // 進捗情報を取得
    const progressKey = `${taskId}_progress`;
    const progressData = await taskStore.get(progressKey);
    
    if (!progressData) {
      // 進捗情報が見つからない場合は、タスクが処理中または完了済みの可能性がある
      return {
        statusCode: 200,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          progress: null,
          message: 'No progress information available',
          taskId
        })
      };
    }

    // 進捗データを解析
    let progress;
    try {
      progress = JSON.parse(progressData);
    } catch (parseError) {
      logger.error('Failed to parse progress data', {
        taskId,
        progressKey,
        error: parseError.message
      });
      
      return {
        statusCode: 500,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Failed to parse progress data',
          taskId
        })
      };
    }

    logger.info('Task progress retrieved', { 
      taskId,
      progressKey,
      percentage: progress.percentage,
      currentStep: progress.currentStep,
      detailedStepsCount: progress.detailedSteps?.length || 0
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        progress,
        taskId
      })
    };

  } catch (error) {
    logger.error('Task progress error', {
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
        success: false,
        error: 'Failed to get task progress',
        message: error.message,
        taskId: event.queryStringParameters?.taskId || 'unknown'
      })
    };
  }
};