import pino from 'pino';

/**
 * Centralized logging utility
 * 
 * Features:
 * - Structured logging with Pino
 * - Pretty printing in development, JSON in production
 * - Automatic filtering of sensitive data
 * - Log levels: debug, info, warn, error
 */

// Determine if we're in development
const isDevelopment = process.env.NODE_ENV === 'development';

// Create base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'hashedPassword',
      'token',
      'apiKey',
      'secret',
      'email', // Can be redacted in specific contexts
      'authorization',
      'cookie',
    ],
    remove: true,
  },
};

// Create the logger
const logger = isDevelopment
  ? pino(
      loggerConfig,
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      })
    )
  : pino(loggerConfig);

/**
 * Sanitize data before logging to prevent sensitive information leakage
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'hashedPassword',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
  ];

  const sanitized = { ...data };
  
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (sanitized[key] && typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Logger interface with sanitization
 */
export const log = {
  /**
   * Debug level - detailed information for debugging
   * Only shown in development
   */
  debug: (message: string, data?: any) => {
    logger.debug(sanitizeData({ message, ...data }));
  },

  /**
   * Info level - general informational messages
   */
  info: (message: string, data?: any) => {
    logger.info(sanitizeData({ message, ...data }));
  },

  /**
   * Warn level - warning messages
   */
  warn: (message: string, data?: any) => {
    logger.warn(sanitizeData({ message, ...data }));
  },

  /**
   * Error level - error messages
   */
  error: (message: string, error?: Error | any, data?: any) => {
    const errorData: any = {
      message,
      ...sanitizeData(data),
    };

    if (error instanceof Error) {
      errorData.error = {
        name: error.name,
        message: error.message,
        stack: isDevelopment ? error.stack : undefined,
      };
    } else if (error) {
      errorData.error = sanitizeData(error);
    }

    logger.error(errorData);
  },

  /**
   * Create a child logger with context
   * Useful for adding context to all logs in a module
   */
  child: (bindings: Record<string, any>) => {
    return logger.child(sanitizeData(bindings));
  },
};

export default log;
