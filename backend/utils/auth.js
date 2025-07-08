const { validateJWT } = require('./jwt');
const { logger } = require('./logger');

const validateApiKey = (event) => {
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  const expectedKey = process.env.MVP_API_SECRET;
  
  if (!expectedKey) {
    console.error('MVP_API_SECRET environment variable not set');
    return {
      valid: false,
      error: 'Server configuration error'
    };
  }
  
  if (!apiKey) {
    return {
      valid: false,
      error: 'API key is required'
    };
  }
  
  if (apiKey !== expectedKey) {
    return {
      valid: false,
      error: 'Invalid API key'
    };
  }
  
  return { valid: true };
};

const validateCredentials = (username, password) => {
  const expectedUsername = process.env.AUTH_USERNAME;
  const expectedPassword = process.env.AUTH_PASSWORD;
  
  if (!expectedUsername || !expectedPassword) {
    logger.error('Authentication environment variables not set');
    return false;
  }
  
  return username === expectedUsername && password === expectedPassword;
};

const validateApiAccess = (event) => {
  // Check for API key (existing MVV functions)
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (apiKey && apiKey === process.env.MVP_API_SECRET) {
    return { 
      valid: true, 
      type: 'api_key',
      user: { username: 'api', role: 'api' }
    };
  }

  // Check for JWT token (new auth system)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = validateJWT(token);
    if (decoded) {
      return { 
        valid: true, 
        type: 'jwt', 
        user: decoded 
      };
    }
  }

  return { 
    valid: false,
    error: 'Authentication required'
  };
};

const extractClientInfo = (event) => {
  const clientIP = event.headers['x-forwarded-for'] || 
                  event.headers['x-real-ip'] || 
                  event.connection?.remoteAddress || 
                  'unknown';
  
  const userAgent = event.headers['user-agent'] || 'unknown';
  
  return {
    ip: clientIP,
    userAgent: userAgent.substring(0, 200) // Limit length for logging
  };
};

module.exports = { 
  validateApiKey, 
  validateCredentials, 
  validateApiAccess,
  extractClientInfo 
};