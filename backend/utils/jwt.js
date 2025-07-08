const jwt = require('jsonwebtoken');
const { logger } = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

const generateJWT = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client'
    });
    
    logger.info('JWT token generated', { 
      user: payload.username,
      expiresIn: JWT_EXPIRATION 
    });
    
    return token;
  } catch (error) {
    logger.error('JWT generation failed', { error: error.message });
    throw new Error('Token generation failed');
  }
};

const validateJWT = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client'
    });
    
    logger.info('JWT token validated', { 
      user: decoded.username,
      exp: new Date(decoded.exp * 1000).toISOString()
    });
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('JWT token expired', { 
        expiredAt: error.expiredAt,
        now: new Date()
      });
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('JWT token invalid', { error: error.message });
    } else {
      logger.error('JWT validation error', { error: error.message });
    }
    
    return null;
  }
};

const refreshJWT = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mvv-extraction-system',
      audience: 'mvv-client',
      ignoreExpiration: true
    });
    
    // Check if token is not too old (allow refresh within 30 days)
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    
    if (now - decoded.iat > maxAge) {
      logger.warn('JWT token too old for refresh', { 
        user: decoded.username,
        issuedAt: new Date(decoded.iat * 1000).toISOString()
      });
      return null;
    }
    
    // Generate new token with same payload
    const newPayload = {
      username: decoded.username,
      role: decoded.role
    };
    
    const newToken = generateJWT(newPayload);
    
    logger.info('JWT token refreshed', { 
      user: decoded.username,
      oldExp: new Date(decoded.exp * 1000).toISOString()
    });
    
    return newToken;
  } catch (error) {
    logger.error('JWT refresh failed', { error: error.message });
    return null;
  }
};

const getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    logger.error('JWT decode failed', { error: error.message });
    return null;
  }
};

module.exports = {
  generateJWT,
  validateJWT,
  refreshJWT,
  getTokenExpiration
};