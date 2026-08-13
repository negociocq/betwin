# 🔗 BETWIN - Configuração GitHub + Supabase

## ✅ O que você precisa fazer agora

### 1️⃣ Configure o Git Local

```bash
cd C:\Users\Premium PC\dyad-apps\betwin

# Configure com seus dados
git config user.email "seu-email@gmail.com"
git config user.name "Seu Nome Completo"

# Verifique
git config --global user.email
git config --global user.name
```

### 2️⃣ Configure o Remote do GitHub

```bash
# Remova o remote anterior (se existir)
git remote remove origin

# Adicione seu repositório
git remote add origin https://github.com/SEU_USERNAME/betwin.git

# Verifique
git remote -v
```

Você deve ver:
```
origin  https://github.com/SEU_USERNAME/betwin.git (fetch)
origin  https://github.com/SEU_USERNAME/betwin.git (push)
```

---

## 🔐 3️⃣ Configure as Credenciais do Supabase

### No seu projeto Supabase (`betwin`):

1. Vá para **Settings** → **API**
2. Copie:
   - **Project URL** (ex: `https://xxx-xxx-xxx.supabase.co`)
   - **Anon Public Key** (chave pública - segura para frontend)
   - **Service Role Key** (chave privada - apenas backend)

### Crie o `.env.local` do Frontend

```bash
cd C:\Users\Premium PC\dyad-apps\betwin\packages\frontend

# Edite manualmente ou execute:
# (Substitua XXX pelos seus valores)
```

Arquivo: `packages/frontend/.env.local`
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_ENV=development
VITE_SUPABASE_URL=https://seu-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Crie o `.env` do Backend

```bash
cd C:\Users\Premium PC\dyad-apps\betwin\packages\backend
```

Arquivo: `packages/backend/.env`
```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://seu-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
DATABASE_URL=postgresql://postgres:sua-senha@seu-project-id.supabase.co:5432/postgres
PAPER_TRADING_ONLY=true
JWT_SECRET=seu-jwt-secret-minimo-32-caracteres-aqui
LOG_LEVEL=debug
```

---

## 📊 4️⃣ Crie as Tabelas no Supabase

### Acesse o Supabase Dashboard

1. Vá para: `https://app.supabase.com`
2. Selecione projeto: `betwin`
3. Clique em: **SQL Editor**
4. Clique em: **New Query**

### Cole este SQL completo

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  betfair_session_token TEXT,
  betfair_app_id VARCHAR(255),
  trading_mode VARCHAR(50) NOT NULL DEFAULT 'PAPER',
  account_balance DECIMAL(15, 2) DEFAULT 0,
  account_currency VARCHAR(3),
  account_timezone VARCHAR(100),
  settings JSONB DEFAULT '{}',
  risk_config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Markets table
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
  market_time TIMESTAMP,
  suspend_time TIMESTAMP,
  settled_time TIMESTAMP,
  catalog_data JSONB,
  book_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);

CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_updated_at ON markets(updated_at DESC);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(50) NOT NULL,
  selection_id BIGINT NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('BACK', 'LAY')),
  stake DECIMAL(15, 2) NOT NULL,
  odds DECIMAL(10, 4) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  mode VARCHAR(50) NOT NULL DEFAULT 'PAPER' CHECK (mode IN ('PAPER', 'LIVE')),
  executed_price DECIMAL(10, 4),
  executed_stake DECIMAL(15, 2),
  slippage DECIMAL(10, 4),
  commission DECIMAL(15, 2) DEFAULT 0,
  signal_id UUID,
  strategy_id UUID,
  result VARCHAR(50),
  profit_loss DECIMAL(15, 2),
  roi DECIMAL(10, 4),
  betfair_order_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP,
  settled_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_mode ON trades(mode);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);

-- Signals table
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  market_id VARCHAR(50) NOT NULL,
  selection_id BIGINT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('BACK', 'LAY')),
  odds DECIMAL(10, 4) NOT NULL,
  estimated_probability DECIMAL(5, 4) NOT NULL,
  implied_probability DECIMAL(5, 4) NOT NULL,
  edge DECIMAL(5, 4) NOT NULL,
  expected_value DECIMAL(15, 2) NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  liquidity_score INTEGER,
  spread DECIMAL(10, 4),
  volatility DECIMAL(10, 4),
  source VARCHAR(50) NOT NULL,
  strategy_id UUID,
  suggested_stake DECIMAL(15, 2) NOT NULL,
  risk_reward DECIMAL(10, 4),
  status VARCHAR(50) NOT NULL DEFAULT 'GENERATED',
  reason TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  executed_at TIMESTAMP,
  expired_at TIMESTAMP
);

CREATE INDEX idx_signals_user_id ON signals(user_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_generated_at ON signals(generated_at DESC);

-- Analytics cache table
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id VARCHAR(50) NOT NULL,
  selection_id BIGINT NOT NULL,
  indicator_type VARCHAR(50) NOT NULL,
  indicator_name VARCHAR(255) NOT NULL,
  period INTEGER,
  values JSONB NOT NULL,
  last_value DECIMAL(15, 6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(market_id, selection_id, indicator_type, period)
);

CREATE INDEX idx_analytics_market ON analytics_cache(market_id);
CREATE INDEX idx_analytics_updated_at ON analytics_cache(updated_at DESC);

-- Risk monitor table
CREATE TABLE IF NOT EXISTS risk_monitor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
  current_exposure DECIMAL(15, 2) DEFAULT 0,
  exposure_percent DECIMAL(5, 2) DEFAULT 0,
  current_daily_loss DECIMAL(15, 2) DEFAULT 0,
  daily_loss_percent DECIMAL(5, 2) DEFAULT 0,
  current_drawdown DECIMAL(15, 2) DEFAULT 0,
  drawdown_percent DECIMAL(5, 2) DEFAULT 0,
  active_positions INTEGER DEFAULT 0,
  overall_risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_monitor_user_id ON risk_monitor(user_id);
```

### Execute
- Clique em **RUN** ou pressione **Ctrl+Enter**
- Você deve ver ✅ "Queries executed successfully"

---

## 🚀 5️⃣ Primeiro Push para GitHub

```bash
cd C:\Users\Premium PC\dyad-apps\betwin

# Adicionar arquivos
git add .

# Commit inicial
git commit -m "feat: initial betwin project setup with frontend, backend, and supabase integration"

# Enviar para GitHub
git branch -M main
git push -u origin main
```

---

## ✅ Checklist Final

- [ ] Git configurado com email e nome
- [ ] GitHub remote adicionado
- [ ] `.env.local` criado no frontend
- [ ] `.env` criado no backend
- [ ] Tabelas criadas no Supabase
- [ ] Primeiro push enviado para GitHub
- [ ] `npm run dev` funciona

---

## 🎯 Próximas Etapas

Depois de tudo configurado:

```bash
# Terminal 1: Backend
cd packages/backend
npm run dev

# Terminal 2: Frontend
cd packages/frontend
npm run dev

# Abra no navegador
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

---

**Quando tiver tudo configurado, me avise e continuamos com a Fase 2!** 🚀
