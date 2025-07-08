const { validateJWT } = require('../../utils/jwt');
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
    logger.warn('Invalid HTTP method for token validation', {
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
      logger.warn('Missing or invalid Authorization header', {
        ...clientInfo,
        hasAuthHeader: !!authHeader,
        authHeaderStart: authHeader ? authHeader.substring(0, 10) : null
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

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      logger.warn('Empty token in Authorization header', {
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

    // Validate token
    const decoded = validateJWT(token);
    
    if (!decoded) {
      logger.warn('Invalid or expired token', {
        ...clientInfo,
        tokenLength: token.length,
        processingTime: Date.now() - startTime
      });
      
      return {
        statusCode: 401,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Invalid or expired token'
        })
      };
    }

    // Calculate expiration time
    const expirationDate = new Date(decoded.exp * 1000);

    logger.debug('Token validation successful', {
      username: decoded.username,
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
          valid: true,
          user: {
            username: decoded.username,
            role: decoded.role
          },
          expiresAt: expirationDate.toISOString(),
          issuedAt: new Date(decoded.iat * 1000).toISOString()
        },
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    logger.error('Token validation error', {
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