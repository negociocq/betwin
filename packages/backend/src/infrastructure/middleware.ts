import express, { Express, Request, Response, NextFunction } from 'express';
import { logger, createRequestLogger } from './logger';
import { AppError } from './errors';

export function setupMiddleware(app: Express): void {
  // Trust proxy
  app.set('trust proxy', 1);

  // CORS - simplified
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Request logging
  app.use(createRequestLogger());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

export function setupErrorHandling(app: Express): void {
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Error occurred', { error: err.message, url: req.url, method: req.method });

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.name,
        code: err.code,
        message: err.message,
      });
    }

    // Unexpected error
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred',
    });
  });
}

