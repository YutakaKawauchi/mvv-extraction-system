const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-key-for-testing-minimum-256-bits-long';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

const validateCredentials = (username, password) => {
  const expectedUsername = process.env.AUTH_USERNAME || 'admin';
  const expectedPassword = process.env.AUTH_PASSWORD || 'test123';
  
  return username === expectedUsername && password === expectedPassword;
};

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
    const body = JSON.parse(event.body || '{}');
    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Username and password are required'
        })
      };
    }

    // Validate credentials
    if (!validateCredentials(username, password)) {
      return {
        statusCode: 401,
        headers: corsHeaders,
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

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client'
    });

    const expirationDate = new Date();
    const expirationHours = parseInt(JWT_EXPIRATION.replace('h', '')) || 24;
    expirationDate.setHours(expirationDate.getHours() + expirationHours);

    return {
      statusCode: 200,
      headers: corsHeaders,
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
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};