-- BETWIN DATABASE SETUP
-- Execute cada comando um por um no Supabase SQL Editor

-- ===== PASSO 1: Habilitar UUID =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== PASSO 2: Criar tabela USERS =====
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  betfair_session_token TEXT,
  betfair_app_id VARCHAR(255),
  trading_mode VARCHAR(50) NOT NULL DEFAULT 'PAPER',
  account_balance NUMERIC(15, 2) DEFAULT 10000,
  account_currency VARCHAR(3) DEFAULT 'EUR',
  account_timezone VARCHAR(100),
  settings JSONB DEFAULT '{}',
  risk_config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- ===== PASSO 3: Criar índices USERS =====
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ===== PASSO 4: Criar tabela MARKETS =====
CREATE TABLE markets (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(500),
  event_type_id VARCHAR(50),
  market_type VARCHAR(50),
  status VARCHAR(50),
  in_play BOOLEAN DEFAULT FALSE,
  total_matched NUMERIC(20, 2) DEFAULT 0,
  total_available NUMERIC(20, 2) DEFAULT 0,
  number_of_runners INTEGER,
  number_of_active_runners INTEGER,
  bet_delay INTEGER,
  is_market_data_delayed BOOLEAN DEFAULT FALSE,
  market_time TIMESTAMP,
  suspend_time TIMESTAMP,
  settled_time TIMESTAMP,
  catalog_data JSONB,
  book_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);

-- ===== PASSO 5: Criar índices MARKETS =====
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_updated_at ON markets(updated_at DESC);

-- ===== PASSO 6: Criar tabela TRADES =====
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(50) NOT NULL,
  selection_id BIGINT NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('BACK', 'LAY')),
  stake NUMERIC(15, 2) NOT NULL,
  odds NUMERIC(10, 4) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  mode VARCHAR(50) NOT NULL DEFAULT 'PAPER' CHECK (mode IN ('PAPER', 'LIVE')),
  executed_price NUMERIC(10, 4),
  executed_stake NUMERIC(15, 2),
  slippage NUMERIC(10, 4),
  commission NUMERIC(15, 2) DEFAULT 0,
  signal_id UUID,
  strategy_id UUID,
  result VARCHAR(50),
  profit_loss NUMERIC(15, 2),
  roi NUMERIC(10, 4),
  betfair_order_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP,
  settled_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== PASSO 7: Criar índices TRADES =====
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_mode ON trades(mode);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);

-- ===== PASSO 8: Criar tabela SIGNALS =====
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(50) NOT NULL,
  selection_id BIGINT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('BACK', 'LAY')),
  odds NUMERIC(10, 4) NOT NULL,
  estimated_probability NUMERIC(5, 4) NOT NULL,
  implied_probability NUMERIC(5, 4) NOT NULL,
  edge NUMERIC(5, 4) NOT NULL,
  expected_value NUMERIC(15, 2) NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  liquidity_score INTEGER,
  spread NUMERIC(10, 4),
  volatility NUMERIC(10, 4),
  source VARCHAR(50) NOT NULL,
  strategy_id UUID,
  suggested_stake NUMERIC(15, 2) NOT NULL,
  risk_reward NUMERIC(10, 4),
  status VARCHAR(50) NOT NULL DEFAULT 'GENERATED',
  reason TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  executed_at TIMESTAMP,
  expired_at TIMESTAMP
);

-- ===== PASSO 9: Criar índices SIGNALS =====
CREATE INDEX idx_signals_user_id ON signals(user_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_generated_at ON signals(generated_at DESC);

-- ===== PASSO 10: Criar tabela ANALYTICS_CACHE =====
CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id VARCHAR(50) NOT NULL,
  selection_id BIGINT NOT NULL,
  indicator_type VARCHAR(50) NOT NULL,
  indicator_name VARCHAR(255) NOT NULL,
  period INTEGER,
  values JSONB NOT NULL,
  last_value NUMERIC(15, 6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(market_id, selection_id, indicator_type, period)
);

-- ===== PASSO 11: Criar índices ANALYTICS_CACHE =====
CREATE INDEX idx_analytics_market ON analytics_cache(market_id);
CREATE INDEX idx_analytics_updated_at ON analytics_cache(updated_at DESC);

-- ===== PASSO 12: Criar tabela RISK_MONITOR =====
CREATE TABLE risk_monitor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
  current_exposure NUMERIC(15, 2) DEFAULT 0,
  exposure_percent NUMERIC(5, 2) DEFAULT 0,
  current_daily_loss NUMERIC(15, 2) DEFAULT 0,
  daily_loss_percent NUMERIC(5, 2) DEFAULT 0,
  current_drawdown NUMERIC(15, 2) DEFAULT 0,
  drawdown_percent NUMERIC(5, 2) DEFAULT 0,
  active_positions INTEGER DEFAULT 0,
  overall_risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== PASSO 13: Criar índices RISK_MONITOR =====
CREATE INDEX idx_risk_monitor_user_id ON risk_monitor(user_id);

-- ===== PRONTO! =====
-- Se você chegou aqui sem erros, todas as tabelas foram criadas com sucesso!
SELECT 'Betwin Database Setup Completo!' as status;
