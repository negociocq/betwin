import 'dotenv/config';
import { z } from 'zod';

// Schema for environment variables
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Betfair Configuration
  BETFAIR_APP_ID: z.string(),
  BETFAIR_CERT_PATH: z.string().optional(),
  BETFAIR_API_ENDPOINT: z.string().url().default('https://api.betfair.com/exchange'),

  // JWT Configuration
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),

  // Paper Trading
  PAPER_TRADING_ONLY: z.string().transform((v) => v === 'true').default('true'),
  PAPER_TRADING_INITIAL_CAPITAL: z.coerce.number().default(10000),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Monitoring
  PROMETHEUS_PORT: z.coerce.number().default(9090),

  // API Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export type Config = z.infer<typeof EnvSchema>;

let config: Config;

export function getConfig(): Config {
  if (!config) {
    const parsed = EnvSchema.safeParse(process.env);

    if (!parsed.success) {
      console.error('Invalid environment variables:', parsed.error.format());
      process.exit(1);
    }

    config = parsed.data;
  }

  return config;
}

export function validateConfig(): void {
  getConfig();
  console.log('✓ Environment variables validated');
}
