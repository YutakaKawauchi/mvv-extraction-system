const { getStore, connectLambda } = require('@netlify/blobs');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * Unified Task Blob Cleanup API
 * 
 * 完了した非同期タスクのNetlify Blobsデータを一括削除する
 * フロントエンドがタスク結果を受信・処理完了後に呼び出される
 * 
 * URL Pattern: /.netlify/functions/cleanup-task-blob
 * Method: DELETE
 * Body: {
 *   taskId: string,              // 必須：タスクID
 *   cleanup: 'all' | 'result' | 'progress'  // オプション：削除対象（デフォルト: 'all'）
 * }
 * 
 * Response: {
 *   success: boolean,
 *   taskId: string,
 *   deleted: {
 *     result: { deleted: boolean, size: number },
 *     progress: { deleted: boolean, size: number }
 *   },
 *   summary: { totalDeleted: number, totalSize: number }
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

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Method not allowed. Only DELETE is supported.',
        usage: 'DELETE with body: {"taskId": "async_12345", "cleanup": "all"}'
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
        body: JSON.stringify({ error: authResult.error || 'Authentication required' })
      };
    }

    // リクエストボディの解析
    const requestBody = JSON.parse(event.body || '{}');
    const { 
      taskId, 
      cleanup = 'all'  // デフォルトは全削除
    } = requestBody;

    // 入力検証
    if (!taskId) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskId is required in request body',
          example: '{"taskId": "async_12345", "cleanup": "all"}',
          cleanupOptions: ['all', 'result', 'progress']
        })
      };
    }

    // cleanup オプションの検証
    const validCleanupOptions = ['all', 'result', 'progress'];
    if (!validCleanupOptions.includes(cleanup)) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: `Invalid cleanup option: ${cleanup}`,
          validOptions: validCleanupOptions
        })
      };
    }

    logger.info('Unified task blob cleanup request', { 
      taskId,
      cleanup,
      user: authResult.user?.username
    });

    // Netlify Blobsストアを初期化
    const taskStore = getStore('async-task-results');
    
    // 削除対象ブロブの定義
    const blobTargets = {
      result: taskId,                    // タスク結果ブロブ
      progress: `${taskId}_progress`     // 進捗ブロブ
    };

    // 削除対象を決定
    let targetsToDelete = [];
    if (cleanup === 'all') {
      targetsToDelete = ['result', 'progress'];
    } else {
      targetsToDelete = [cleanup];
    }

    // 削除実行と結果記録
    const deletionResults = {};
    let totalDeleted = 0;
    let totalSize = 0;

    for (const blobType of targetsToDelete) {
      const blobKey = blobTargets[blobType];
      
      try {
        // 削除前に存在確認
        const existingData = await taskStore.get(blobKey);
        const dataExists = !!existingData;
        const originalSize = dataExists ? existingData.length : 0;

        if (dataExists) {
          // 削除実行
          await taskStore.delete(blobKey);
          
          // 削除確認
          const verifyDeleted = await taskStore.get(blobKey);
          const deleted = !verifyDeleted;
          
          deletionResults[blobType] = {
            deleted,
            size: originalSize,
            existed: true
          };
          
          if (deleted) {
            totalDeleted++;
            totalSize += originalSize;
          }
          
          logger.info(`${blobType} blob deletion completed`, {
            taskId,
            blobKey,
            deleted,
            originalSize
          });
        } else {
          // 存在しない場合も成功として扱う
          deletionResults[blobType] = {
            deleted: true,
            size: 0,
            existed: false
          };
          
          logger.info(`${blobType} blob not found (already deleted or never existed)`, {
            taskId,
            blobKey
          });
        }
      } catch (error) {
        deletionResults[blobType] = {
          deleted: false,
          size: 0,
          existed: false,
          error: error.message
        };
        
        logger.error(`Failed to delete ${blobType} blob`, {
          taskId,
          blobKey,
          error: error.message
        });
      }
    }

    logger.info('Unified task blob cleanup completed', { 
      taskId,
      cleanup,
      deletionResults,
      totalDeleted,
      totalSize,
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
        cleanup,
        deleted: deletionResults,
        summary: {
          totalDeleted,
          totalSize,
          requestedTargets: targetsToDelete,
          cleanupTime: Date.now()
        },
        message: `Task blob cleanup completed: ${totalDeleted} blobs deleted`
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