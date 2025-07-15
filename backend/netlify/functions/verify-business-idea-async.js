const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * 非同期ビジネスアイデア検証API (Phase ε.1.3)
 * 
 * Background Functionへのプロキシとして機能し、
 * 開発環境でのCORS問題を回避する
 * 
 * URL Pattern: /.netlify/functions/verify-business-idea-async
 * Method: POST
 */

exports.handler = async (event, context) => {
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

    // リクエスト解析
    const requestBody = JSON.parse(event.body);
    const { taskId, taskType, inputData, context: taskContext, config } = requestBody;

    logger.info('Async task proxy request', { 
      taskId,
      taskType,
      user: authResult.user?.username,
      inputDataSize: JSON.stringify(inputData).length,
      development: true
    });

    // タスクIDを生成（既存のものがない場合）
    const generatedTaskId = taskId || `async_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Background Functionの実行をシミュレート
    // 実際の環境では、ここでBackground Functionを呼び出しますが、
    // 開発環境では即座に応答を返します
    const response = {
      success: true,
      taskId: generatedTaskId,
      status: 'accepted',
      message: 'Task accepted for background processing',
      metadata: {
        backgroundFunctionId: `bf_${generatedTaskId}`,
        estimatedDuration: 120000, // 2分
        acceptedAt: Date.now()
      }
    };

    logger.info('Async task accepted', { 
      taskId: generatedTaskId,
      backgroundFunctionId: response.metadata.backgroundFunctionId,
      responseSize: JSON.stringify(response).length,
      development: true,
      mockProcessing: true
    });

    // 202 Accepted ステータスで応答
    return {
      statusCode: 202,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json',
        'X-Task-ID': generatedTaskId
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    logger.error('Async task proxy error', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to start async task',
        message: error.message
      })
    };
  }
};