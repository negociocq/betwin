#!/usr/bin/env node

/**
 * Betwin - Supabase Database Setup
 * Este script cria as tabelas no Supabase usando a API
 */

const https = require('https');

const SUPABASE_URL = 'https://dqalbolenmsiwapljqjl.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

// SQL para criar as tabelas (executado em pequenos pedaços)
const sqlCommands = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',

  // Users table
  `CREATE TABLE IF NOT EXISTS users (
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
  );`,

  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
  'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);',

  // Markets table
  `CREATE TABLE IF NOT EXISTS markets (
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
  );`,

  'CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);',
  'CREATE INDEX IF NOT EXISTS idx_markets_updated_at ON markets(updated_at DESC);',

  // Trades table
  `CREATE TABLE IF NOT EXISTS trades (
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
  );`,

  'CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);',
  'CREATE INDEX IF NOT EXISTS idx_trades_mode ON trades(mode);',
  'CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);',

  // Signals table
  `CREATE TABLE IF NOT EXISTS signals (
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
  );`,

  'CREATE INDEX IF NOT EXISTS idx_signals_user_id ON signals(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);',
  'CREATE INDEX IF NOT EXISTS idx_signals_generated_at ON signals(generated_at DESC);',

  // Analytics cache table
  `CREATE TABLE IF NOT EXISTS analytics_cache (
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
  );`,

  'CREATE INDEX IF NOT EXISTS idx_analytics_market ON analytics_cache(market_id);',
  'CREATE INDEX IF NOT EXISTS idx_analytics_updated_at ON analytics_cache(updated_at DESC);',

  // Risk monitor table
  `CREATE TABLE IF NOT EXISTS risk_monitor (
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
  );`,

  'CREATE INDEX IF NOT EXISTS idx_risk_monitor_user_id ON risk_monitor(user_id);',
];

console.log('🚀 Betwin - Supabase Database Setup');
console.log('=====================================\n');

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'dqalbolenmsiwapljqjl.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function setupDatabase() {
  console.log('📝 Verificando credenciais...');

  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'your-service-role-key') {
    console.error('❌ Erro: SUPABASE_SERVICE_ROLE_KEY não configurada');
    console.log('\nPara configurar:');
    console.log('1. Abra: https://app.supabase.com');
    console.log('2. Projeto: betwin');
    console.log('3. Settings → API');
    console.log('4. Copie "Service role secret"');
    console.log('5. Execute: set SUPABASE_SERVICE_ROLE_KEY=sua_chave');
    process.exit(1);
  }

  console.log('✅ Credenciais encontradas\n');
  console.log(`📊 Total de comandos SQL: ${sqlCommands.length}\n`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < sqlCommands.length; i++) {
    const sql = sqlCommands[i];
    const preview = sql.substring(0, 50) + (sql.length > 50 ? '...' : '');

    process.stdout.write(`[${i + 1}/${sqlCommands.length}] ${preview}`);

    try {
      await executeSQL(sql);
      console.log(' ✅');
      successful++;
    } catch (error) {
      console.log(` ❌ ${error.message}`);
      failed++;
    }
  }

  console.log('\n=====================================');
  console.log(`✅ Executados com sucesso: ${successful}`);
  console.log(`❌ Falhados: ${failed}`);
  console.log('=====================================\n');

  if (failed === 0) {
    console.log('🎉 Banco de dados criado com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('1. Recarregue http://localhost:5173');
    console.log('2. Tente criar sua conta novamente');
    console.log('3. Deve funcionar sem erros!');
  } else {
    console.log('⚠️ Alguns comandos falharam. Verifique os erros acima.');
  }
}

setupDatabase().catch(console.error);
