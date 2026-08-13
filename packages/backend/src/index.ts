import express from 'express';
import { getConfig, validateConfig } from './infrastructure/config';
import { setupMiddleware, setupErrorHandling } from './infrastructure/middleware';
import { logger } from './infrastructure/logger';
import { checkHealth } from './modules/database/pool';

// Validate config on startup
validateConfig();

const config = getConfig();
const app = express();

// Setup middleware
setupMiddleware(app);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await checkHealth();

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// Basic API routes (placeholder)
app.get('/api/markets', (req, res) => {
  res.json({ message: 'Markets endpoint - coming soon' });
});

app.get('/api/signals', (req, res) => {
  res.json({ message: 'Signals endpoint - coming soon' });
});

app.get('/api/trades', (req, res) => {
  res.json({ message: 'Trades endpoint - coming soon' });
});

// Setup error handling
setupErrorHandling(app);

// Start server
const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`✓ Server started on port ${PORT}`);
  logger.info(`✓ Environment: ${config.NODE_ENV}`);
  logger.info(`✓ Paper Trading: ${config.PAPER_TRADING_ONLY ? 'ENABLED' : 'DISABLED'}`);
  logger.info(`✓ Health check: http://localhost:${PORT}/health`);
});

export default app;
