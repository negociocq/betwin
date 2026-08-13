import { query } from './pool';
import { logger } from '../../infrastructure/logger';

/**
 * Run all migrations
 */
export async function migrate(): Promise<void> {
  logger.info('Starting database migrations...');

  try {
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        betfair_session_token TEXT,
        betfair_app_id VARCHAR(255),
        trading_mode VARCHAR(50) NOT NULL DEFAULT 'PAPER',

        -- Account info
        account_balance DECIMAL(15, 2) DEFAULT 0,
        account_currency VARCHAR(3),
        account_timezone VARCHAR(100),

        -- Settings
        settings JSONB DEFAULT '{}',
        risk_config JSONB DEFAULT '{}',

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    logger.info('✓ Users table created');

    // Create markets table
    await query(`
      CREATE TABLE IF NOT EXISTS markets (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(500),
        event_type_id VARCHAR(50),
        market_type VARCHAR(50),
        status VARCHAR(50),
        in_play BOOLEAN DEFAULT FALSE,
        total_matched DECIMAL(20, 2) DEFAULT 0,
        total_available DECIMAL(20, 2) DEFAULT 0,
        number_of_runners INTEGER,
        number_of_active_runners INTEGER,
        bet_delay INTEGER,
        is_market_data_delayed BOOLEAN DEFAULT FALSE,

        -- Market times
        market_time TIMESTAMP,
        suspend_time TIMESTAMP,
        settled_time TIMESTAMP,

        -- Data
        catalog_data JSONB,
        book_data JSONB,

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        synced_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
      CREATE INDEX IF NOT EXISTS idx_markets_updated_at ON markets(updated_at DESC);
    `);
    logger.info('✓ Markets table created');

    // Create trades (paper and future live)
    await query(`
      CREATE TABLE IF NOT EXISTS trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        market_id VARCHAR(50) NOT NULL,
        selection_id BIGINT NOT NULL,
        side VARCHAR(10) NOT NULL CHECK (side IN ('BACK', 'LAY')),
        stake DECIMAL(15, 2) NOT NULL,
        odds DECIMAL(10, 4) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        mode VARCHAR(50) NOT NULL DEFAULT 'PAPER' CHECK (mode IN ('PAPER', 'LIVE')),

        -- Execution details
        executed_price DECIMAL(10, 4),
        executed_stake DECIMAL(15, 2),
        slippage DECIMAL(10, 4),
        commission DECIMAL(15, 2) DEFAULT 0,

        -- Signal info
        signal_id UUID,
        strategy_id UUID,

        -- Settlement
        result VARCHAR(50),
        profit_loss DECIMAL(15, 2),
        roi DECIMAL(10, 4),

        -- Betfair info
        betfair_order_id VARCHAR(255),

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP,
        settled_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
      CREATE INDEX IF NOT EXISTS idx_trades_mode ON trades(mode);
      CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
    `);
    logger.info('✓ Trades table created');

    // Create signals
    await query(`
      CREATE TABLE IF NOT EXISTS signals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        market_id VARCHAR(50) NOT NULL,
        selection_id BIGINT NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('BACK', 'LAY')),
        odds DECIMAL(10, 4) NOT NULL,

        -- Analytics
        estimated_probability DECIMAL(5, 4) NOT NULL,
        implied_probability DECIMAL(5, 4) NOT NULL,
        edge DECIMAL(5, 4) NOT NULL,
        expected_value DECIMAL(15, 2) NOT NULL,
        confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

        -- Market data
        liquidity_score INTEGER,
        spread DECIMAL(10, 4),
        volatility DECIMAL(10, 4),

        -- Source
        source VARCHAR(50) NOT NULL,
        strategy_id UUID,

        -- Suggestion
        suggested_stake DECIMAL(15, 2) NOT NULL,
        risk_reward DECIMAL(10, 4),

        -- Status
        status VARCHAR(50) NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'VALIDATED', 'REJECTED', 'EXPIRED', 'EXECUTED')),
        reason TEXT,

        -- Timestamps
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP,
        executed_at TIMESTAMP,
        expired_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);
      CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
      CREATE INDEX IF NOT EXISTS idx_signals_generated_at ON signals(generated_at DESC);
    `);
    logger.info('✓ Signals table created');

    // Create analytics cache
    await query(`
      CREATE TABLE IF NOT EXISTS analytics_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        market_id VARCHAR(50) NOT NULL,
        selection_id BIGINT NOT NULL,
        indicator_type VARCHAR(50) NOT NULL,
        indicator_name VARCHAR(255) NOT NULL,
        period INTEGER,
        values JSONB NOT NULL,
        last_value DECIMAL(15, 6),

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(market_id, selection_id, indicator_type, period)
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_market ON analytics_cache(market_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_updated_at ON analytics_cache(updated_at DESC);
    `);
    logger.info('✓ Analytics cache table created');

    // Create risk monitor
    await query(`
      CREATE TABLE IF NOT EXISTS risk_monitor (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'WARNING', 'CRITICAL', 'HALTED')),

        -- Current metrics
        current_exposure DECIMAL(15, 2) DEFAULT 0,
        exposure_percent DECIMAL(5, 2) DEFAULT 0,
        current_daily_loss DECIMAL(15, 2) DEFAULT 0,
        daily_loss_percent DECIMAL(5, 2) DEFAULT 0,
        current_drawdown DECIMAL(15, 2) DEFAULT 0,
        drawdown_percent DECIMAL(5, 2) DEFAULT 0,

        active_positions INTEGER DEFAULT 0,
        overall_risk_score INTEGER DEFAULT 0,

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_risk_monitor_user_id ON risk_monitor(user_id);
    `);
    logger.info('✓ Risk monitor table created');

    logger.info('✓ All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  }
}
