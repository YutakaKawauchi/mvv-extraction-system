const fs = require('fs');
const path = require('path');

const isDevelopment = process.env.NODE_ENV === 'development';

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const getCurrentLevel = () => {
  return isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
};

// Color codes for console output
const COLORS = {
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  GREEN: '\x1b[32m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

const formatTimestamp = () => {
  return new Date().toISOString();
};

// File logging configuration
const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 30; // Keep 30 days of logs

// Ensure log directory exists
const ensureLogDirectory = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

// Get log file path for current date
const getLogFilePath = (date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `app-${dateStr}.log`);
};

// Rotate log files if needed
const rotateLogsIfNeeded = () => {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(file => file.startsWith('app-') && file.endsWith('.log'))
      .sort()
      .reverse();

    // Remove old files
    if (files.length > MAX_FILES) {
      files.slice(MAX_FILES).forEach(file => {
        try {
          fs.unlinkSync(path.join(LOG_DIR, file));
        } catch (err) {
          console.error('Failed to delete old log file:', file, err.message);
        }
      });
    }

    // Check current file size
    const currentFile = getLogFilePath();
    if (fs.existsSync(currentFile)) {
      const stats = fs.statSync(currentFile);
      if (stats.size > MAX_FILE_SIZE) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = currentFile.replace('.log', `-${timestamp}.log`);
        fs.renameSync(currentFile, backupPath);
      }
    }
  } catch (err) {
    console.error('Log rotation failed:', err.message);
  }
};

// Write to log file
const writeToFile = (logEntry) => {
  if (!isDevelopment && process.env.NODE_ENV !== 'production') {
    return; // Only log to file in development or production
  }

  try {
    ensureLogDirectory();
    rotateLogsIfNeeded();
    
    const logFilePath = getLogFilePath();
    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Async write to avoid blocking
    fs.appendFile(logFilePath, logLine, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err.message);
      }
    });
  } catch (err) {
    console.error('File logging error:', err.message);
  }
};

const maskSensitiveData = (data) => {
  if (typeof data !== 'object' || data === null) return data;
  
  const masked = { ...data };
  
  // Mask API keys and sensitive fields
  const sensitiveFields = [
    'apikey', 'api_key', 'authorization', 'password', 'token', 
    'secret', 'key', 'openai_api_key', 'perplexity_api_key'
  ];
  
  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '***MASKED***';
    }
  }
  
  // Mask headers with sensitive info
  if (masked.headers) {
    Object.keys(masked.headers).forEach(key => {
      if (key.toLowerCase().includes('authorization') || 
          key.toLowerCase().includes('key')) {
        masked.headers[key] = '***MASKED***';
      }
    });
  }
  
  return masked;
};

const logWithLevel = (level, message, data = null, color = COLORS.RESET) => {
  if (level > getCurrentLevel()) return;
  
  const timestamp = formatTimestamp();
  const levelName = Object.keys(LOG_LEVELS)[level];
  const maskedData = data ? maskSensitiveData(data) : null;
  
  const logEntry = {
    timestamp,
    level: levelName,
    message,
    ...(maskedData && { data: maskedData })
  };
  
  // Console output
  if (isDevelopment) {
    // Colorful console output for development
    console.log(
      `${color}[${timestamp}] ${levelName}:${COLORS.RESET} ${message}`,
      maskedData ? `\n${JSON.stringify(maskedData, null, 2)}` : ''
    );
  } else {
    // Structured JSON for production
    console.log(JSON.stringify(logEntry));
  }
  
  // File output (async, non-blocking)
  writeToFile(logEntry);
};

const logger = {
  error: (message, data) => {
    logWithLevel(LOG_LEVELS.ERROR, message, data, COLORS.RED);
  },
  
  warn: (message, data) => {
    logWithLevel(LOG_LEVELS.WARN, message, data, COLORS.YELLOW);
  },
  
  info: (message, data) => {
    logWithLevel(LOG_LEVELS.INFO, message, data, COLORS.GREEN);
  },
  
  debug: (message, data) => {
    logWithLevel(LOG_LEVELS.DEBUG, message, data, COLORS.BLUE);
  },
  
  // API specific logging
  apiRequest: (method, url, headers, body) => {
    if (!isDevelopment) return;
    
    logger.debug(`API Request: ${method} ${url}`, {
      headers: maskSensitiveData(headers),
      body: body
    });
  },
  
  apiResponse: (status, data, processingTime) => {
    if (status >= 400) {
      logger.error(`API Response Error: ${status}`, { data, processingTime });
    } else if (isDevelopment) {
      logger.debug(`API Response: ${status}`, { data, processingTime });
    } else {
      logger.info(`API Response: ${status}`, { processingTime });
    }
  },
  
  perplexityCall: (companyName, query, response, timing) => {
    if (isDevelopment) {
      logger.debug(`Perplexity API Call for ${companyName}`, {
        query: query.substring(0, 100) + '...',
        responseLength: response?.length || 0,
        timing
      });
    } else {
      logger.info(`Perplexity API Call completed`, {
        company: companyName,
        success: !!response,
        timing
      });
    }
  }
};

module.exports = { logger };