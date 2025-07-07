const { handleCors } = require('../../utils/cors');

exports.handler = async (event, context) => {
  // Handle CORS
  const corsResult = handleCors(event);
  if (corsResult.statusCode) {
    return corsResult;
  }

  try {
    const response = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      }
    };

    return {
      statusCode: 200,
      headers: {
        ...corsResult.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Health check error:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsResult.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Health check failed'
      })
    };
  }
};