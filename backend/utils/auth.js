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

module.exports = { validateApiKey };