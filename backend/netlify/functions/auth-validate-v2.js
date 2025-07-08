const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-minimum-256-bits-long';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
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
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Authorization header required'
        })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Token is required'
        })
      };
    }

    // Validate token
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client'
    });

    // Calculate expiration time
    const expirationDate = new Date(decoded.exp * 1000);

    return {
      statusCode: 200,
      headers: corsHeaders,
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
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Token has expired'
        })
      };
    } else if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid token'
        })
      };
    } else {
      console.error('Token validation error:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      };
    }
  }
};