/**
 * Structured Logging Utility for API Routes
 * 
 * Provides consistent, structured logging across all API endpoints
 * with correlation IDs, request tracking, and performance metrics
 */

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  startTime?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: LogContext;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private context: LogContext = {};

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  getContext(): LogContext {
    return this.context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): StructuredLogger {
    return new StructuredLogger({ ...this.context, ...additionalContext });
  }

  /**
   * Generate a unique request ID
   */
  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract request context from NextRequest
   */
  static fromRequest(request: Request, additionalContext: LogContext = {}): LogContext {
    const url = new URL(request.url);
    
    return {
      requestId: StructuredLogger.generateRequestId(),
      method: request.method,
      url: url.pathname + url.search,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      ...additionalContext,
    };
  }

  /**
   * Core logging method
   */
  private log(level: LogEntry['level'], message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
    };

    // Add duration if startTime is available
    if (this.context.startTime) {
      entry.duration = Date.now() - this.context.startTime;
    }

    // Output structured log
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context: this.context,
      metadata,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Add duration if startTime is available
    if (this.context.startTime) {
      entry.duration = Date.now() - this.context.startTime;
    }

    console.log(JSON.stringify(entry));
  }

  /**
   * Log API request start
   */
  logRequest(request: Request, additionalContext: LogContext = {}): StructuredLogger {
    const context = StructuredLogger.fromRequest(request, {
      startTime: Date.now(),
      ...additionalContext,
    });

    const logger = new StructuredLogger(context);
    logger.info('Request started', {
      method: request.method,
      url: request.url,
    });

    return logger;
  }

  /**
   * Log API request completion
   */
  logResponse(status: number, responseBody?: any): void {
    this.info('Request completed', {
      statusCode: status,
      responseSize: responseBody ? JSON.stringify(responseBody).length : 0,
    });
  }

  /**
   * Log API request error
   */
  logApiError(error: any, status: number = 500): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    this.error('Request failed', errorObj, {
      statusCode: status,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, metrics: Record<string, number>): void {
    this.info(`Performance: ${operation}`, {
      operation,
      metrics,
    });
  }

  /**
   * Log security events
   */
  logSecurity(event: string, details: Record<string, any>): void {
    this.warn(`Security: ${event}`, {
      securityEvent: event,
      ...details,
    });
  }

  /**
   * Log business events
   */
  logBusiness(event: string, details: Record<string, any>): void {
    this.info(`Business: ${event}`, {
      businessEvent: event,
      ...details,
    });
  }
}

/**
 * Middleware helper for Next.js API routes
 */
export function withStructuredLogger(
  handler: (req: Request, logger: StructuredLogger) => Promise<Response>,
  additionalContext: LogContext = {}
) {
  return async (request: Request): Promise<Response> => {
    const logger = StructuredLogger.fromRequest(request, additionalContext);
    const structuredLogger = new StructuredLogger(logger);

    try {
      const response = await handler(request, structuredLogger);
      
      structuredLogger.logResponse(response.status);
      
      return response;
    } catch (error: any) {
      structuredLogger.logApiError(error);
      
      // Return appropriate error response
      if (error.name === 'ValidationError') {
        return new Response(
          JSON.stringify({ ok: false, error: error.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      if (error.name === 'UnauthorizedError') {
        return new Response(
          JSON.stringify({ ok: false, error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Internal server error',
          requestId: logger.requestId,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Create a logger for API routes
 */
export function createLogger(context: LogContext = {}): StructuredLogger {
  return new StructuredLogger(context);
}

/**
 * Default logger instance
 */
export const logger = new StructuredLogger();

export default StructuredLogger;
