// Simple in-memory rate limiter
const requests = new Map();

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

module.exports = { rateLimiter, getRateLimitHeaders };