const { refreshJWT, getTokenExpiration } = require('../../utils/jwt');
const { extractClientInfo } = require('../../utils/auth');
const { corsHeaders } = require('../../utils/cors');
const { logger } = require('../../utils/logger');

exports.handler = async (event, context) => {
  const startTime = Date.now();
  const clientInfo = extractClientInfo(event);
  
  // CORS preflight handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(event.headers.origin),
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    logger.warn('Invalid HTTP method for token refresh', {
      method: event.httpMethod,
      ...clientInfo
    });
    
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Allow': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    // Extract token from Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid Authorization header for refresh', {
        ...clientInfo,
        hasAuthHeader: !!authHeader
      });
      
      return {
        statusCode: 401,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Authorization header required'
        })
      };
    }

    const oldToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!oldToken) {
      logger.warn('Empty token in Authorization header for refresh', {
        ...clientInfo
      });
      
      return {
        statusCode: 401,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Token is required'
        })
      };
    }

    // Attempt to refresh token
    const newToken = refreshJWT(oldToken);
    
    if (!newToken) {
      logger.warn('Token refresh failed', {
        ...clientInfo,
        tokenLength: oldToken.length,
        processingTime: Date.now() - startTime
      });
      
      return {
        statusCode: 401,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Unable to refresh token. Please login again.'
        })
      };
    }

    // Get new expiration time
    const expirationDate = getTokenExpiration(newToken);

    if (!expirationDate) {
      logger.error('Unable to determine expiration for refreshed token', {
        ...clientInfo,
        processingTime: Date.now() - startTime
      });
      
      return {
        statusCode: 500,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Token refresh error'
        })
      };
    }

    logger.info('Token refresh successful', {
      ...clientInfo,
      expiresAt: expirationDate.toISOString(),
      processingTime: Date.now() - startTime
    });

    return {
      statusCode: 200,
      headers: corsHeaders(event.headers.origin),
      body: JSON.stringify({
        success: true,
        data: {
          token: newToken,
          expiresAt: expirationDate.toISOString()
        },
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    logger.error('Token refresh error', {
      ...clientInfo,
      error: error.message,
      stack: error.stack,
      processingTime: Date.now() - startTime
    });

    return {
      statusCode: 500,
      headers: corsHeaders(event.headers.origin),
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};