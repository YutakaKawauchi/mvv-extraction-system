const { getStore, connectLambda, listStores } = require('@netlify/blobs');
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * Generic Bulk Blob Cleanup API (管理者用)
 * 
 * 指定されたNetlify Blobsストア内の全ブロブまたは条件に基づくブロブを一括削除
 * テスト失敗や開発中に残ったごみブロブのクリーンアップ用
 * 
 * URL Pattern: /.netlify/functions/cleanup-all-blobs
 * Method: DELETE
 * Body: {
 *   store: string,                          // 必須: ストア名（例: 'async-task-results'）
 *   mode: 'all' | 'orphaned' | 'pattern',  // 削除モード
 *   pattern?: string,                       // パターンマッチ（mode='pattern'時）
 *   dryRun?: boolean,                       // true: 削除リストのみ表示
 *   maxAge?: number                         // 最大年齢（秒、mode='orphaned'時）
 * }
 * 
 * 使用例:
 * 1. 全削除: {"store": "async-task-results", "mode": "all", "dryRun": true}
 * 2. 孤立したブロブ削除: {"store": "cache-store", "mode": "orphaned", "maxAge": 3600}
 * 3. パターンマッチ: {"store": "temp-data", "mode": "pattern", "pattern": "test_.*"}
 * 4. ストア一覧: {"action": "list-stores"}
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
        usage: 'DELETE with body: {"mode": "all", "dryRun": true}'
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
      action,
      store,
      mode = 'orphaned',
      pattern,
      dryRun = false,
      maxAge = 24 * 60 * 60  // デフォルト24時間
    } = requestBody;

    // 特別なアクション: ストア一覧取得
    if (action === 'list-stores') {
      try {
        // 実際の利用可能なストアの一覧を取得
        const { stores: actualStores } = await listStores();
        logger.info('Found actual stores', { stores: actualStores });
        
        // 既知のストアと実際のストアをマージ
        const knownStores = [
          'async-task-results',
          'cache-store', 
          'temp-data',
          'user-uploads',
          'session-data'
        ];
        
        // 実際のストアと既知のストアを統合
        const allStoreNames = [...new Set([...actualStores, ...knownStores])];
        
        const storeInfo = [];
        for (const storeName of allStoreNames) {
          try {
            const testStore = getStore(storeName);
            let blobCount = 0;
            let totalSize = 0;
            let storeExists = actualStores.includes(storeName);
            
            if (storeExists) {
              // ストアが存在する場合のみ、ブロブをカウント
              try {
                const { blobs } = await testStore.list();
                blobCount = blobs.length;
                
                // サイズ計算（最大1000個まで）
                for (let i = 0; i < Math.min(blobs.length, 1000); i++) {
                  try {
                    const data = await testStore.get(blobs[i].key);
                    if (data) totalSize += data.length;
                  } catch (e) {
                    logger.warn('Failed to get blob data for size calculation', { 
                      store: storeName, 
                      key: blobs[i].key, 
                      error: e.message 
                    });
                  }
                }
              } catch (listError) {
                logger.warn('Failed to list blobs, but store exists', { 
                  store: storeName, 
                  error: listError.message 
                });
                blobCount = 0;
                totalSize = 0;
              }
            }
            
            storeInfo.push({
              name: storeName,
              exists: storeExists,
              blobCount,
              totalSize,
              estimatedSize: blobCount >= 1000 ? `${totalSize}+ (limited scan)` : totalSize,
              isKnownStore: knownStores.includes(storeName),
              isActualStore: actualStores.includes(storeName)
            });
            
          } catch (error) {
            logger.warn('Failed to access store', { 
              store: storeName, 
              error: error.message 
            });
            storeInfo.push({
              name: storeName,
              exists: false,
              blobCount: 0,
              totalSize: 0,
              error: error.message,
              isKnownStore: knownStores.includes(storeName),
              isActualStore: actualStores.includes(storeName)
            });
          }
        }
        
        return {
          statusCode: 200,
          headers: {
            ...corsHeadersObj,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            action: 'list-stores',
            stores: storeInfo,
            actualStores,
            knownStores,
            note: 'Includes both actual stores from listStores() and known stores.'
          })
        };
      } catch (error) {
        logger.error('Store listing error', { error: error.message });
        return {
          statusCode: 500,
          headers: {
            ...corsHeadersObj,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            error: 'Failed to list stores',
            message: error.message
          })
        };
      }
    }

    // 通常の削除処理では store パラメータが必須
    if (!store) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'store parameter is required',
          examples: {
            cleanup: '{"store": "async-task-results", "mode": "all", "dryRun": true}',
            listStores: '{"action": "list-stores"}'
          },
          commonStores: ['async-task-results', 'cache-store', 'temp-data', 'user-uploads']
        })
      };
    }

    // モード検証
    const validModes = ['all', 'orphaned', 'pattern'];
    if (!validModes.includes(mode)) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: `Invalid mode: ${mode}`,
          validModes,
          examples: {
            all: '{"store": "async-task-results", "mode": "all", "dryRun": true}',
            orphaned: '{"store": "async-task-results", "mode": "orphaned", "maxAge": 3600}',
            pattern: '{"store": "async-task-results", "mode": "pattern", "pattern": "async_1752.*"}'
          }
        })
      };
    }

    if (mode === 'pattern' && !pattern) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'pattern is required when mode is "pattern"',
          example: '{"store": "async-task-results", "mode": "pattern", "pattern": "async_1752.*"}'
        })
      };
    }

    logger.info('Generic bulk blob cleanup request', { 
      store,
      mode,
      pattern,
      dryRun,
      maxAge,
      user: authResult.user?.username
    });

    // 指定されたNetlify Blobsストアを初期化
    let targetStore;
    try {
      targetStore = getStore(store);
    } catch (error) {
      logger.error('Failed to access store', { store, error: error.message });
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: `Failed to access store: ${store}`,
          message: error.message,
          suggestion: 'Use {"action": "list-stores"} to see available stores'
        })
      };
    }
    
    // 全ブロブのリストを取得
    const allBlobs = [];
    try {
      const { blobs } = await targetStore.list();
      
      for (const blob of blobs) {
        allBlobs.push({ 
          key: blob.key, 
          metadata: blob.metadata,
          createdAt: blob.metadata?.created || Date.now() - (maxAge * 1000) // フォールバック
        });
      }
    } catch (listError) {
      logger.error('Failed to list blobs in store', {
        store,
        error: listError.message
      });
      return {
        statusCode: 500,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: `Failed to list blobs in store: ${store}`,
          message: listError.message
        })
      };
    }

    logger.info('Retrieved blob list', {
      store,
      totalBlobs: allBlobs.length,
      mode
    });

    // 削除対象を決定
    let blobsToDelete = [];
    
    switch (mode) {
      case 'all':
        blobsToDelete = allBlobs;
        break;
        
      case 'orphaned':
        // 指定時間より古いブロブを孤立とみなす
        const cutoffTime = Date.now() - (maxAge * 1000);
        blobsToDelete = allBlobs.filter(blob => blob.createdAt < cutoffTime);
        break;
        
      case 'pattern':
        // パターンマッチング
        const regex = new RegExp(pattern);
        blobsToDelete = allBlobs.filter(blob => regex.test(blob.key));
        break;
    }

    logger.info('Identified blobs for deletion', {
      mode,
      totalCandidates: allBlobs.length,
      toDelete: blobsToDelete.length,
      dryRun
    });

    // Dry run の場合はリストのみ返す
    if (dryRun) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          dryRun: true,
          store,
          mode,
          pattern,
          maxAge,
          totalBlobs: allBlobs.length,
          blobsToDelete: blobsToDelete.length,
          deletionList: blobsToDelete.map(blob => ({
            key: blob.key,
            createdAt: new Date(blob.createdAt).toISOString(),
            ageInHours: Math.floor((Date.now() - blob.createdAt) / (1000 * 60 * 60))
          })),
          message: `Would delete ${blobsToDelete.length} out of ${allBlobs.length} blobs from store '${store}'`
        })
      };
    }

    // 実際の削除実行
    const deletionResults = [];
    let deletedCount = 0;
    let totalSizeDeleted = 0;

    for (const blob of blobsToDelete) {
      try {
        // ブロブサイズを取得（削除前）
        const blobData = await targetStore.get(blob.key);
        const blobSize = blobData ? blobData.length : 0;
        
        // 削除実行
        await targetStore.delete(blob.key);
        
        // 削除確認
        const verifyDeleted = await targetStore.get(blob.key);
        const deleted = !verifyDeleted;
        
        deletionResults.push({
          key: blob.key,
          deleted,
          size: blobSize,
          createdAt: new Date(blob.createdAt).toISOString()
        });
        
        if (deleted) {
          deletedCount++;
          totalSizeDeleted += blobSize;
        }
        
        logger.info('Blob deletion result', {
          key: blob.key,
          deleted,
          size: blobSize
        });
        
      } catch (error) {
        deletionResults.push({
          key: blob.key,
          deleted: false,
          size: 0,
          error: error.message,
          createdAt: new Date(blob.createdAt).toISOString()
        });
        
        logger.error('Failed to delete blob', {
          key: blob.key,
          error: error.message
        });
      }
    }

    logger.info('Generic bulk blob cleanup completed', { 
      store,
      mode,
      pattern,
      totalBlobs: allBlobs.length,
      candidatesForDeletion: blobsToDelete.length,
      actuallyDeleted: deletedCount,
      totalSizeDeleted,
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
        store,
        mode,
        pattern,
        maxAge,
        summary: {
          totalBlobs: allBlobs.length,
          candidatesForDeletion: blobsToDelete.length,
          actuallyDeleted: deletedCount,
          totalSizeDeleted,
          cleanupTime: Date.now()
        },
        deletionResults,
        message: `Successfully deleted ${deletedCount} out of ${blobsToDelete.length} candidate blobs from store '${store}'`
      })
    };

  } catch (error) {
    logger.error('Bulk blob cleanup error', {
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
        error: 'Failed to perform bulk blob cleanup',
        message: error.message
      })
    };
  }
};