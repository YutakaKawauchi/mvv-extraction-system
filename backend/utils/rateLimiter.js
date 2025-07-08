const { logger } = require('./logger');

// Enhanced in-memory rate limiter
const requests = new Map();
const authAttempts = new Map();

const rateLimiter = (
  clientId, 
  maxRequests = 100, 
  windowMs = 15 * 60 * 1000 // 15 minutes
) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get or create request history for this client
  if (!requests.has(clientId)) {
    requests.set(clientId, []);
  }
  
  const clientRequests = requests.get(clientId);
  
  // Remove old requests outside the window
  const validRequests = clientRequests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (validRequests.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: windowStart + windowMs
    };
  }
  
  // Add current request
  validRequests.push(now);
  requests.set(clientId, validRequests);
  
  return {
    allowed: true,
    remaining: maxRequests - validRequests.length,
    resetTime: windowStart + windowMs
  };
};

const getRateLimitHeaders = (result) => {
  return {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
  };
};

// Authentication-specific rate limiting
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_AUTH_ATTEMPTS = parseInt(process.env.LOGIN_RATE_LIMIT) || 5;

const cleanupExpiredEntries = () => {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, data] of authAttempts.entries()) {
    if (now - data.firstAttempt > RATE_LIMIT_WINDOW) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => authAttempts.delete(key));
  
  if (expiredKeys.length > 0) {
    logger.debug('Cleaned up expired auth rate limit entries', { 
      count: expiredKeys.length 
    });
  }
};

const getRateLimitKey = (event) => {
  // Use IP address as the key
  const clientIP = event.headers['x-forwarded-for'] || 
                  event.headers['x-real-ip'] || 
                  event.connection?.remoteAddress || 
                  'unknown';
  
  return `auth_limit:${clientIP}`;
};

const checkAuthRateLimit = (event) => {
  cleanupExpiredEntries();
  
  const key = getRateLimitKey(event);
  const now = Date.now();
  
  if (!authAttempts.has(key)) {
    authAttempts.set(key, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    
    logger.debug('Auth rate limit: First attempt', { 
      key: key.replace(/[\d.]+/, '***'),
      attempts: 1,
      maxAttempts: MAX_AUTH_ATTEMPTS
    });
    
    return {
      allowed: true,
      attempts: 1,
      remainingAttempts: MAX_AUTH_ATTEMPTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }
  
  const data = authAttempts.get(key);
  
  // Check if the window has expired
  if (now - data.firstAttempt > RATE_LIMIT_WINDOW) {
    // Reset the counter
    authAttempts.set(key, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now
    });
    
    logger.debug('Auth rate limit: Window expired, reset', { 
      key: key.replace(/[\d.]+/, '***'),
      attempts: 1,
      maxAttempts: MAX_AUTH_ATTEMPTS
    });
    
    return {
      allowed: true,
      attempts: 1,
      remainingAttempts: MAX_AUTH_ATTEMPTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }
  
  // Increment attempts
  data.attempts++;
  data.lastAttempt = now;
  authAttempts.set(key, data);
  
  const allowed = data.attempts <= MAX_AUTH_ATTEMPTS;
  
  logger[allowed ? 'debug' : 'warn']('Auth rate limit check', {
    key: key.replace(/[\d.]+/, '***'),
    attempts: data.attempts,
    maxAttempts: MAX_AUTH_ATTEMPTS,
    allowed,
    resetTime: data.firstAttempt + RATE_LIMIT_WINDOW
  });
  
  return {
    allowed,
    attempts: data.attempts,
    remainingAttempts: Math.max(0, MAX_AUTH_ATTEMPTS - data.attempts),
    resetTime: data.firstAttempt + RATE_LIMIT_WINDOW
  };
};

const resetAuthRateLimit = (event) => {
  const key = getRateLimitKey(event);
  const deleted = authAttempts.delete(key);
  
  if (deleted) {
    logger.info('Auth rate limit reset', { 
      key: key.replace(/[\d.]+/, '***')
    });
  }
  
  return deleted;
};

module.exports = { 
  rateLimiter, 
  getRateLimitHeaders, 
  checkAuthRateLimit, 
  resetAuthRateLimit 
};