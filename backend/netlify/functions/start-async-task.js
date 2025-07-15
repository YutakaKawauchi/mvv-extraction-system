const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');

/**
 * 汎用非同期タスク開始API (Phase ε.1.3)
 * 
 * 各種長時間実行タスクを適切なBackground Functionにルーティングする
 * 統一されたインターフェースで非同期処理を開始し、タスクIDを返す
 * 
 * URL Pattern: /.netlify/functions/start-async-task
 * Method: POST
 * 
 * Supported Task Types:
 * - verify-business-idea: ビジネスアイデア検証
 * - generate-business-ideas: ビジネスアイデア生成
 * - extract-mvv: MVV抽出
 * - extract-company-info: 企業情報抽出
 * - analyze-competition: 競合分析
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
    const { 
      taskType,
      taskData,
      priority = 'medium',
      metadata = {}
    } = requestBody;

    // 入力検証
    if (!taskType || !taskData) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'taskType and taskData are required',
          supportedTypes: ['verify-business-idea', 'generate-business-ideas', 'extract-mvv', 'extract-company-info', 'analyze-competition'],
          example: {
            taskType: 'verify-business-idea',
            taskData: {
              originalIdea: { title: '...', description: '...' },
              companyData: { id: '...', name: '...' },
              verificationLevel: 'comprehensive'
            },
            priority: 'medium',
            metadata: { userId: 'user123' }
          }
        })
      };
    }

    // サポートされているタスクタイプの確認
    if (!isSupportedTaskType(taskType)) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Unsupported task type',
          taskType,
          supportedTypes: getSupportedTaskTypes()
        })
      };
    }

    // タスクIDの生成
    const taskId = generateTaskId(taskType);
    
    logger.info('Starting async task', { 
      taskId,
      taskType,
      priority,
      user: authResult.user?.username,
      hasTaskData: !!taskData,
      metadataKeys: Object.keys(metadata)
    });

    // タスクの初期化と Background Function の呼び出し
    const taskResult = await initializeAndStartTask({
      taskId,
      taskType,
      taskData,
      priority,
      metadata,
      authResult
    });

    logger.info('Async task initiated', { 
      taskId,
      taskType,
      backgroundFunctionCalled: taskResult.backgroundFunctionCalled,
      estimatedDuration: taskResult.estimatedDuration
    });

    return {
      statusCode: 202, // Accepted - 非同期処理開始
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        taskId,
        status: 'queued',
        message: 'Task has been queued for processing',
        data: {
          taskType,
          priority,
          estimatedDuration: taskResult.estimatedDuration,
          backgroundFunction: taskResult.backgroundFunction,
          pollingUrl: `/.netlify/functions/task-status?taskId=${taskId}`,
          statusCheckInterval: 2000 // 2秒間隔でのポーリング推奨
        },
        metadata: {
          taskId,
          queuedAt: Date.now(),
          expectedCompletionTime: Date.now() + taskResult.estimatedDuration
        }
      })
    };

  } catch (error) {
    logger.error('Async task initiation error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      requestBody: event.body ? JSON.parse(event.body) : null
    });
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to start async task',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

/**
 * タスクの初期化とBackground Function呼び出し
 */
async function initializeAndStartTask(options) {
  const { taskId, taskType, taskData, priority, metadata, authResult } = options;
  
  try {
    // タスクタイプに応じたBackground Function の選択
    const backgroundFunction = getBackgroundFunctionForTaskType(taskType);
    const estimatedDuration = getEstimatedDuration(taskType, taskData);
    
    // Background Function への非同期呼び出し準備
    const backgroundPayload = {
      taskId,
      ...taskData,
      priority,
      metadata: {
        ...metadata,
        userId: authResult.user?.username,
        initiatedAt: Date.now(),
        estimatedDuration
      }
    };

    // 実際のBackground Function呼び出し
    // NOTE: Netlify Functionsでは、Background Functionを直接呼び出すことはできないため、
    // HTTPリクエストとして呼び出すか、外部タスクキューシステムを使用する必要があります。
    // Phase ε.1.3の現在の実装では、模擬的なタスク開始処理を行います。
    
    const backgroundResult = await callBackgroundFunction(backgroundFunction, backgroundPayload);
    
    return {
      backgroundFunctionCalled: true,
      backgroundFunction,
      estimatedDuration,
      backgroundResult
    };
    
  } catch (error) {
    logger.error('Failed to initialize async task', {
      taskId,
      taskType,
      error: error.message
    });
    throw error;
  }
}

/**
 * Background Function の呼び出し
 */
async function callBackgroundFunction(functionName, payload) {
  try {
    // Phase ε.1.4: 実際のBackground Function呼び出し実装
    const baseUrl = process.env.URL || 'http://localhost:8888';
    const functionUrl = `${baseUrl}/.netlify/functions/${functionName}`;
    
    logger.info('Calling background function', {
      functionName,
      functionUrl,
      payloadKeys: Object.keys(payload),
      taskId: payload.taskId
    });
    
    // Background Functionへの非同期HTTP呼び出し
    // Note: Netlify Background Functionsは非同期で実行されるため、
    // レスポンスはすぐに返される（実際の処理結果ではない）
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.MVP_API_SECRET,
        'X-Task-ID': payload.taskId,
        'X-Background-Function': 'true'
      },
      body: JSON.stringify(payload),
      // Background Functionなので短いタイムアウト
      signal: AbortSignal.timeout(10000) // 10秒
    });
    
    const responseData = await response.json();
    
    logger.info('Background function response received', {
      functionName,
      taskId: payload.taskId,
      status: response.status,
      success: responseData.success,
      hasData: !!responseData.data
    });
    
    if (!response.ok) {
      throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return {
      success: true,
      functionName,
      taskId: payload.taskId,
      message: 'Background function initiated successfully',
      backgroundResponse: responseData,
      realMode: true
    };
    
  } catch (error) {
    logger.error('Background function call failed', {
      functionName,
      taskId: payload.taskId,
      error: error.message,
      stack: error.stack
    });
    
    // Background Function呼び出し失敗の場合、フォールバック処理
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      // タイムアウトの場合はBackground Functionが動作中の可能性
      logger.warn('Background function call timeout - function may still be running', {
        functionName,
        taskId: payload.taskId
      });
      
      return {
        success: true,
        functionName,
        taskId: payload.taskId,
        message: 'Background function initiated (timeout, but may be running)',
        timeoutWarning: true,
        realMode: true
      };
    }
    
    throw error;
  }
}

/**
 * タスクタイプサポート確認
 */
function isSupportedTaskType(taskType) {
  return getSupportedTaskTypes().includes(taskType);
}

/**
 * サポートされているタスクタイプ一覧
 */
function getSupportedTaskTypes() {
  return [
    'verify-business-idea',
    'generate-business-ideas', 
    'extract-mvv',
    'extract-company-info',
    'analyze-competition',
    'long-running-mock'
  ];
}

/**
 * タスクタイプに対応するBackground Function名を取得
 */
function getBackgroundFunctionForTaskType(taskType) {
  const functionMap = {
    'verify-business-idea': 'verify-business-idea-background',
    'generate-business-ideas': 'generate-business-ideas-background',
    'extract-mvv': 'extract-mvv-background',
    'extract-company-info': 'extract-company-info-background',
    'analyze-competition': 'analyze-competition-background',
    'long-running-mock': 'long-running-mock'
  };
  
  return functionMap[taskType] || null;
}

/**
 * タスクタイプとデータに基づく推定実行時間（ミリ秒）
 */
function getEstimatedDuration(taskType, taskData) {
  const baseDurations = {
    'verify-business-idea': 120000,     // 2分
    'generate-business-ideas': 180000,  // 3分
    'extract-mvv': 30000,              // 30秒
    'extract-company-info': 45000,     // 45秒
    'analyze-competition': 90000,      // 1.5分
    'long-running-mock': 300000        // 5分（デフォルト）
  };
  
  let baseDuration = baseDurations[taskType] || 60000; // デフォルト1分
  
  // long-running-mockの場合はtaskDataのdurationを優先
  if (taskType === 'long-running-mock' && taskData.duration) {
    baseDuration = taskData.duration;
  }
  
  // タスクデータに基づく時間調整
  if (taskType === 'verify-business-idea') {
    const verificationLevel = taskData.verificationLevel || 'comprehensive';
    switch (verificationLevel) {
      case 'basic':
        baseDuration = 60000;  // 1分
        break;
      case 'expert':
        baseDuration = 300000; // 5分
        break;
      default: // comprehensive
        baseDuration = 120000; // 2分
    }
  }
  
  if (taskType === 'generate-business-ideas') {
    const ideaCount = taskData.ideaCount || 1;
    baseDuration = Math.max(60000, baseDuration * Math.log(ideaCount + 1));
  }
  
  return baseDuration;
}

/**
 * 一意なタスクID生成
 */
function generateTaskId(taskType) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const typePrefix = taskType.split('-')[0]; // 'verify', 'generate', 'extract', etc.
  
  return `async_${timestamp}_${typePrefix}_${random}`;
}

/**
 * タスク優先度検証
 */
function validatePriority(priority) {
  const validPriorities = ['low', 'medium', 'high'];
  return validPriorities.includes(priority);
}

/**
 * タスクデータ検証（タスクタイプ別）
 */
function validateTaskData(taskType, taskData) {
  switch (taskType) {
    case 'verify-business-idea':
      return validateVerificationTaskData(taskData);
    case 'generate-business-ideas':
      return validateGenerationTaskData(taskData);
    case 'extract-mvv':
      return validateExtractionTaskData(taskData);
    case 'extract-company-info':
      return validateCompanyInfoTaskData(taskData);
    case 'analyze-competition':
      return validateCompetitionTaskData(taskData);
    default:
      return { valid: false, error: 'Unknown task type' };
  }
}

/**
 * ビジネスアイデア検証タスクデータ検証
 */
function validateVerificationTaskData(taskData) {
  const { originalIdea, companyData } = taskData;
  
  if (!originalIdea || !companyData) {
    return { 
      valid: false, 
      error: 'originalIdea and companyData are required for verification tasks' 
    };
  }
  
  if (!originalIdea.title || !companyData.name) {
    return { 
      valid: false, 
      error: 'originalIdea.title and companyData.name are required' 
    };
  }
  
  return { valid: true };
}

/**
 * ビジネスアイデア生成タスクデータ検証
 */
function validateGenerationTaskData(taskData) {
  const { companyData } = taskData;
  
  if (!companyData || !companyData.name) {
    return { 
      valid: false, 
      error: 'companyData with name is required for generation tasks' 
    };
  }
  
  return { valid: true };
}

/**
 * MVV抽出タスクデータ検証
 */
function validateExtractionTaskData(taskData) {
  const { companyId, companyName } = taskData;
  
  if (!companyId || !companyName) {
    return { 
      valid: false, 
      error: 'companyId and companyName are required for extraction tasks' 
    };
  }
  
  return { valid: true };
}

/**
 * 企業情報抽出タスクデータ検証
 */
function validateCompanyInfoTaskData(taskData) {
  const { companyId, companyName } = taskData;
  
  if (!companyId || !companyName) {
    return { 
      valid: false, 
      error: 'companyId and companyName are required for company info tasks' 
    };
  }
  
  return { valid: true };
}

/**
 * 競合分析タスクデータ検証
 */
function validateCompetitionTaskData(taskData) {
  const { companyData, targetMarket } = taskData;
  
  if (!companyData || !targetMarket) {
    return { 
      valid: false, 
      error: 'companyData and targetMarket are required for competition analysis tasks' 
    };
  }
  
  return { valid: true };
}