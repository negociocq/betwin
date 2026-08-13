# 🔗 Configuração GitHub + Supabase

## 📋 Pré-requisitos

Você deve ter:
- [ ] Criado projeto "betwin" no GitHub
- [ ] Criado projeto "betwin" no Supabase
- [ ] Git instalado localmente
- [ ] Credenciais do Supabase

---

## 🚀 Passo 1: Configurar GitHub Remote

### 1.1 Obtenha a URL do seu repositório GitHub

```bash
# Vá para: https://github.com/SEU_USERNAME/betwin
# Clique em "Code" (botão verde)
# Copie a URL HTTPS ou SSH
```

### 1.2 Configure o remote

```bash
# Remover remote anterior (se existir)
git remote remove origin

# Adicionar seu remote GitHub
git remote add origin https://github.com/SEU_USERNAME/betwin.git

# Verificar
git remote -v
```

---

## 🔐 Passo 2: Configurar Supabase

### 2.1 Obtenha as credenciais do Supabase

Acesse seu projeto no Supabase Dashboard:

1. **Vá para**: `https://app.supabase.com`
2. **Selecione projeto**: `betwin`
3. **Clique em**: `Settings` → `API`

Copie:
- ✅ **Project URL**: `https://xxx-xxx-xxx.supabase.co`
- ✅ **Anon Public Key**: (chave pública, segura para frontend)
- ✅ **Service Role Key**: (chave privada, apenas backend)

### 2.2 Crie o arquivo `.env.local` no frontend

```bash
cd packages/frontend
cp .env.example .env.local
```

Edite `packages/frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_ENV=development

# Cole suas credenciais Supabase aqui
VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key-aqui
```

### 2.3 Crie o arquivo `.env` no backend

```bash
cd packages/backend
cp .env.example .env
```

Edite `packages/backend/.env`:

```env
NODE_ENV=development
PORT=3000

# Supabase (Backend)
DATABASE_URL=postgresql://postgres:sua-senha@seu-projeto-id.supabase.co:5432/postgres
SUPABASE_URL=https://seu-projeto-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key-aqui

# Outros
PAPER_TRADING_ONLY=true
LOG_LEVEL=debug
```

---

## 📊 Passo 3: Criar Tabelas no Supabase

### 3.1 Acesse o Supabase SQL Editor

1. **Dashboard** → `betwin` project
2. **SQL Editor** (lado esquerdo)
3. **New Query**

### 3.2 Execute o SQL para criar as tabelas

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
  status VARCHAR(50) NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'VALIDATED', 'REJECTED', 'EXPIRED', 'EXECUTED')),
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
  status VARCHAR(50) NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'WARNING', 'CRITICAL', 'HALTED')),
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

### 3.3 Execute o script

Copie o SQL acima, cole no editor Supabase e clique em "RUN"

---

## 🔄 Passo 4: Primeiro Push para GitHub

```bash
# No diretório raiz do projeto
cd C:\Users\Premium PC\dyad-apps\betwin

# Configurar git user (se não tiver feito)
git config user.email "seu-email@gmail.com"
git config user.name "Seu Nome"

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "feat: initial betwin project setup with frontend, backend, and supabase integration"

# Push para GitHub (branch main)
git branch -M main
git push -u origin main
```

---

## ✅ Checklist de Configuração

- [ ] GitHub remote configurado
- [ ] Supabase URL copiada
- [ ] Supabase Anon Key copiada
- [ ] Supabase Service Role Key copiada
- [ ] `.env.local` criado no frontend
- [ ] `.env` criado no backend
- [ ] Tabelas criadas no Supabase
- [ ] Primeiro commit enviado para GitHub
- [ ] Integração testada (health check)

---

## 🧪 Testar Integração

### Verificar conexão com Supabase (Frontend)

```bash
cd packages/frontend
npm run dev

# Abra DevTools (F12) e teste:
# fetch('http://localhost:5173') deve funcionar
```

### Verificar conexão com Supabase (Backend)

```bash
cd packages/backend
npm run dev

# Teste:
# curl http://localhost:3000/health
```

---

## 📞 Proximos Passos

Depois de configurar:

1. Implementar autenticação com Supabase Auth
2. Conectar API Betfair
3. Sincronizar dados em tempo real
4. Implementar paper trading

---

**Quando tiver as credenciais, me avise e vou finalizar a integração!** 🚀
