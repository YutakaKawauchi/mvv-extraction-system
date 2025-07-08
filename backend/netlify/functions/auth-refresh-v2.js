const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-minimum-256-bits-long';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

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

    const oldToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!oldToken) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Token is required'
        })
      };
    }

    // Verify old token (allow expired tokens for refresh)
    const decoded = jwt.verify(oldToken, JWT_SECRET, {
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client',
      ignoreExpiration: true
    });

    // Check if token is not too old (allow refresh within 30 days)
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    
    if (now - decoded.iat > maxAge) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Token too old for refresh. Please login again.'
        })
      };
    }

    // Generate new token with same payload
    const newPayload = {
      username: decoded.username,
      role: decoded.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const newToken = jwt.sign(newPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client'
    });

    // Calculate new expiration time
    const expirationDate = new Date();
    const expirationHours = parseInt(JWT_EXPIRATION.replace('h', '')) || 24;
    expirationDate.setHours(expirationDate.getHours() + expirationHours);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          token: newToken,
          expiresAt: expirationDate.toISOString()
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid token'
        })
      };
    } else {
      console.error('Token refresh error:', error);
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