/**
 * API Function Template with Complete CORS Implementation
 * 
 * Copy this template for all new Netlify Functions to ensure proper CORS handling.
 * This template follows the exact pattern used in extract-mvv.js and other working functions.
 * 
 * Usage:
 * 1. Copy this file to netlify/functions/your-function-name.js
 * 2. Replace TODO comments with your specific logic
 * 3. Update function description and validation logic
 * 4. Test thoroughly with both local and production environments
 */

// TODO: Add your specific imports here
const { handleCors, corsHeaders } = require('../../utils/cors');
const { validateApiAccess } = require('../../utils/auth');
const { logger } = require('../../utils/logger');
// const { rateLimiter } = require('../../utils/rateLimiter'); // If needed

/**
 * TODO: Replace with your function description
 * 
 * Example API Function
 * 
 * Features:
 * - Complete CORS implementation (preflight + response headers)
 * - API authentication (API key or JWT)
 * - Error handling with proper HTTP status codes
 * - Request logging for debugging
 */
exports.handler = async (event, context) => {
  const requestStartTime = Date.now();
  
  // TODO: Add request logging if needed
  logger.apiRequest(event.httpMethod, event.path, event.headers, event.body);
  
  // 1. Handle CORS preflight - MUST BE FIRST
  const corsResult = handleCors(event);
  if (corsResult) return corsResult;

  // 2. Get CORS headers for ALL responses
  const corsHeadersObj = corsHeaders(event.headers.origin || event.headers.Origin);

  // 3. Method validation with CORS headers
  if (event.httpMethod !== 'POST') { // TODO: Change method if needed
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
    // 4. Validate API access (API key or JWT token)
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

    // 5. Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        })
      };
    }

    // 6. TODO: Add your specific validation logic here
    if (!requestData.requiredField) { // Replace with actual validation
      return {
        statusCode: 400,
        headers: {
          ...corsHeadersObj,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'requiredField is required'
        })
      };
    }

    // 7. TODO: Add your main function logic here
    const result = await yourMainLogic(requestData);

    // 8. Success response with CORS headers
    const processingTime = Date.now() - requestStartTime;
    
    logger.info('API call completed successfully', {
      processingTime,
      // TODO: Add relevant metrics
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: result,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    // 9. Error response with CORS headers
    const processingTime = Date.now() - requestStartTime;
    
    logger.error('API call failed', {
      error: error.message,
      processingTime,
      stack: error.stack
    });

    return {
      statusCode: 500,
      headers: {
        ...corsHeadersObj,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        // Only include details in development
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      })
    };
  }
};

// TODO: Implement your main logic function
async function yourMainLogic(requestData) {
  // Replace this with your actual implementation
  return {
    message: 'Template function executed successfully',
    receivedData: requestData
  };
}

/**
 * CORS Implementation Checklist:
 * 
 * ✅ Import handleCors and corsHeaders from ../../utils/cors
 * ✅ Call handleCors(event) as FIRST line in handler
 * ✅ Get corsHeadersObj with both origin headers
 * ✅ Apply ...corsHeadersObj to EVERY response
 * ✅ Include 'Content-Type': 'application/json' in all headers
 * 
 * Common Mistakes to Avoid:
 * ❌ Missing handleCors() call
 * ❌ Missing CORS headers in some responses
 * ❌ Not using spread operator ...corsHeadersObj
 * ❌ Forgetting origin fallback
 * ❌ Using static corsHeaders instead of corsHeaders(origin)
 */