import pg from 'pg';
import { getConfig } from './config';
import { logger } from './logger';
import { DatabaseError } from './errors';

const config = getConfig();

// Create pool
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Error handling
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err });
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow database query', { text, duration });
    }
    return result;
  } catch (err) {
    logger.error('Database query error', { text, error: err });
    throw new DatabaseError('Database query failed', { text });
  }
}

export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transaction error', { error: err });
    throw new DatabaseError('Transaction failed');
  } finally {
    client.release();
  }
}

export async function getConnection() {
  try {
    return await pool.connect();
  } catch (err) {
    logger.error('Failed to get database connection', { error: err });
    throw new DatabaseError('Failed to get database connection');
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    return !!result.rows[0];
  } catch (err) {
    logger.error('Database health check failed', { error: err });
    return false;
  }
}

export async function close(): Promise<void> {
  await pool.end();
}
