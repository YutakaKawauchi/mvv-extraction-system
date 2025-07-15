const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
  return origins.split(',').map(origin => origin.trim());
};

const corsHeaders = (origin) => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Task-ID, X-Request-ID, X-Background-Function, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
};

const handleCors = (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = corsHeaders(origin);
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  return null; // Return null for non-preflight requests
};

module.exports = { handleCors, corsHeaders };