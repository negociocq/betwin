# 📋 BETWIN - Resumo da Configuração GitHub + Supabase

## 🎯 Você está aqui

O projeto **Betwin** está 100% pronto no Dyad, rodando perfeitamente. Agora precisamos vincular ao GitHub e Supabase.

---

## 📝 Próximas Ações (Rápidas e Simples)

### ✅ Passo 1: Configurar Git (2 minutos)

Abra o terminal (Ctrl + `) no Dyad e execute:

```bash
cd C:\Users\Premium PC\dyad-apps\betwin

# Configure com seus dados reais
git config user.email "seu-email@gmail.com"
git config user.name "Seu Nome"

# Verifique
git config user.email
git config user.name
```

---

### ✅ Passo 2: Conectar ao GitHub (2 minutos)

```bash
# Remova remote anterior (se tiver)
git remote remove origin

# Adicione seu repositório betwin
git remote add origin https://github.com/SEU_USERNAME/betwin.git

# Exemplo real:
# git remote add origin https://github.com/joaosilva/betwin.git

# Verifique
git remote -v
```

---

### ✅ Passo 3: Configurar Supabase Credenciais (5 minutos)

#### No Dashboard Supabase:

1. Acesse: `https://app.supabase.com`
2. Selecione projeto: `betwin`
3. Vá para: **Settings** → **API**
4. Copie (você vai precisar):
   - **Project URL** (ex: `https://abc123def.supabase.co`)
   - **Anon Public Key** (chave longa começando com `eyJ...`)
   - **Service Role Key** (outra chave longa)

#### Crie arquivo: `packages/frontend/.env.local`

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_ENV=development
VITE_SUPABASE_URL=https://seu-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Crie arquivo: `packages/backend/.env`

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://seu-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:sua-senha@seu-project-id.supabase.co:5432/postgres
PAPER_TRADING_ONLY=true
JWT_SECRET=seu-jwt-secret-minimo-32-caracteres-aqui
LOG_LEVEL=debug
```

---

### ✅ Passo 4: Criar Tabelas no Supabase (3 minutos)

1. Dashboard Supabase → seu projeto `betwin`
2. Clique em **SQL Editor** (lado esquerdo)
3. Clique em **New Query**
4. **Cole TODO o SQL abaixo** (é longo, mas copia de uma vez):

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
  mode VARCHAR(50) NOT NULL DEFAULT 'PAPER',
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

5. Clique em **RUN** ou **Ctrl+Enter**
6. Você deve ver: ✅ **"Queries executed successfully"**

---

### ✅ Passo 5: Primeiro Commit no GitHub (2 minutos)

No terminal do Dyad:

```bash
cd C:\Users\Premium PC\dyad-apps\betwin

# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "feat: initial betwin project setup with frontend, backend, and supabase integration"

# Fazer push para GitHub
git branch -M main
git push -u origin main

# Se pedir credenciais, use seu GitHub token (não senha)
```

---

## 📊 Verificar Tudo Está Funcionando

### Terminal do Dyad:

```bash
# Verificar que backend e frontend ainda estão rodando
# Frontend: http://localhost:5173 ✅
# Backend: http://localhost:3000 ✅

# Se parou, reinicie:
npm run dev
```

### GitHub:

Acesse: `https://github.com/SEU_USERNAME/betwin`

Você deve ver todos os arquivos do projeto!

### Supabase:

Acesse: `https://app.supabase.com` → seu projeto `betwin`

Clique em **Table Editor** e você deve ver:
- ✅ users
- ✅ markets
- ✅ trades
- ✅ signals
- ✅ analytics_cache
- ✅ risk_monitor

---

## 🎯 Resumo do Que Você Precisa Fazer

| Ação | Tempo | Arquivo |
|------|-------|---------|
| 1. Git config | 2 min | Terminal |
| 2. GitHub remote | 2 min | Terminal |
| 3. Supabase credenciais | 5 min | 2 arquivos .env |
| 4. Criar tabelas SQL | 3 min | Supabase Dashboard |
| 5. Git commit + push | 2 min | Terminal |
| **Total** | **~15 min** | - |

---

## ✨ Depois de Tudo Configurado

Você terá:

```
✅ GitHub com código versionado
✅ Supabase com banco de dados pronto
✅ Frontend e Backend sincronizados
✅ Pronto para Fase 2 (Autenticação)
```

---

## 💡 Dica Final

**NÃO precisa fazer tudo agora!** Você pode:

- Fazer apenas os passos 1-2 (Git) agora
- Fazer 3-4 (Supabase) depois
- Fazer 5 (Push) quando tiver tudo pronto

O projeto continuará funcionando normalmente no Dyad mesmo sem estar no GitHub/Supabase!

---

**Me avisa quando terminar e continuamos com a Fase 2! 🚀**
