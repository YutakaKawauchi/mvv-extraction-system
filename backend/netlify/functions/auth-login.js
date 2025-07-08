const { validateCredentials, extractClientInfo } = require('../../utils/auth');
const { generateJWT } = require('../../utils/jwt');
const { checkAuthRateLimit, resetAuthRateLimit } = require('../../utils/rateLimiter');
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
    logger.warn('Invalid HTTP method for login', {
      method: event.httpMethod,
      ...clientInfo
    });
    
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders(event.headers.origin),
        'Allow': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    // Rate limiting check
    const rateLimitResult = checkAuthRateLimit(event);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for login attempt', {
        ...clientInfo,
        attempts: rateLimitResult.attempts,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      });
      
      return {
        statusCode: 429,
        headers: {
          ...corsHeaders(event.headers.origin),
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': rateLimitResult.remainingAttempts.toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
        },
        body: JSON.stringify({
          success: false,
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimitResult.resetTime
        })
      };
    }

    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      logger.warn('Invalid JSON in login request', {
        ...clientInfo,
        error: parseError.message
      });
      
      return {
        statusCode: 400,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Invalid request format'
        })
      };
    }

    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      logger.warn('Missing credentials in login request', {
        ...clientInfo,
        hasUsername: !!username,
        hasPassword: !!password
      });
      
      return {
        statusCode: 400,
        headers: corsHeaders(event.headers.origin),
        body: JSON.stringify({
          success: false,
          error: 'Username and password are required'
        })
      };
    }

    // Validate credentials
    const isValid = validateCredentials(username, password);
    
    if (!isValid) {
      logger.warn('Invalid login credentials', {
        ...clientInfo,
        username: username.substring(0, 3) + '***', // Partially mask username
        processingTime: Date.now() - startTime
      });
      
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders(event.headers.origin),
          'X-RateLimit-Remaining': rateLimitResult.remainingAttempts.toString()
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid username or password'
        })
      };
    }

    // Generate JWT token
    const payload = {
      username,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = generateJWT(payload);
    const expirationDate = new Date();
    const expirationHours = parseInt(process.env.JWT_EXPIRATION?.replace('h', '')) || 24;
    expirationDate.setHours(expirationDate.getHours() + expirationHours);

    // Reset rate limit on successful login
    resetAuthRateLimit(event);

    // Log successful login
    logger.info('Successful login', {
      username,
      ...clientInfo,
      processingTime: Date.now() - startTime,
      expiresAt: expirationDate.toISOString()
    });

    return {
      statusCode: 200,
      headers: corsHeaders(event.headers.origin),
      body: JSON.stringify({
        success: true,
        data: {
          token,
          user: {
            username,
            role: 'admin'
          },
          expiresAt: expirationDate.toISOString()
        },
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    logger.error('Login error', {
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