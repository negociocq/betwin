/**
 * Custom error classes
 */

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super('VALIDATION_ERROR', 400, message, context);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super('AUTH_REQUIRED', 401, message, context);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Authorization required', context?: Record<string, any>) {
    super('AUTH_FORBIDDEN', 403, message, context);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, any>) {
    super('NOT_FOUND', 404, `${resource} not found`, context);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super('CONFLICT', 409, message, context);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number, context?: Record<string, any>) {
    super('RATE_LIMIT', 429, message, context);
    this.retryAfter = retryAfter;
    this.name = 'RateLimitError';
  }

  retryAfter?: number;
}

export class ExternalAPIError extends AppError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, any>) {
    super('API_ERROR', statusCode, message, context);
    this.name = 'ExternalAPIError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super('DATABASE_ERROR', 500, message, context);
    this.name = 'DatabaseError';
  }
}

export class RiskManagerError extends AppError {
  constructor(code: string, message: string, context?: Record<string, any>) {
    super(code, 400, message, context);
    this.name = 'RiskManagerError';
  }
}
