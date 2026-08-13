# 🔐 BETWIN - Guia Completo de Setup

## ✅ O que foi feito

```
✅ Frontend: React 18 + TypeScript + Vite
✅ Backend: Serverless Functions (Vercel)
✅ Autenticação: Login/Signup com Supabase
✅ Database: Supabase PostgreSQL
✅ GitHub: Repositório vinculado (negociocq/betwin)
✅ Vercel: Integração automática com GitHub
```

---

## 📋 Status Atual do Sistema

| Item | Status | Próximas Ações |
|------|--------|----------------|
| **Frontend** | ✅ Rodando em http://localhost:5173 | Teste login/signup |
| **Backend API** | ✅ Endpoints serverless criados | Aguardando Vercel deploy |
| **GitHub** | ✅ Repositório atualizado | Commits sincronizados |
| **Vercel** | ⏳ Build em progresso | Aguarde novo deployment |
| **Supabase** | ✅ Projeto criado | **PRÓXIMO: Criar tabelas** |
| **Autenticação** | ✅ Implementada | **PRÓXIMO: Testar** |

---

## 🚀 PRÓXIMAS ETAPAS (Fazer Agora)

### 1️⃣ **Criar Tabelas no Supabase** (5 minutos)

#### Passo 1: Acessar Supabase
1. Abra: **https://app.supabase.com**
2. Selecione seu projeto **"betwin"**
3. No menu esquerdo, clique em **SQL Editor**
4. Clique em **New Query**

#### Passo 2: Executar o SQL
Cole este código completo:

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
  account_balance DECIMAL(15, 2) DEFAULT 10000,
  account_currency VARCHAR(3) DEFAULT 'EUR',
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

#### Passo 3: Executar
- Clique em **RUN** ou pressione **Ctrl+Enter**
- Você deve ver: ✅ **"Queries executed successfully"**

---

### 2️⃣ **Testar Login/Signup Localmente** (3 minutos)

#### Passo 1: Rodar o projeto localmente
```bash
cd C:\Users\Premium PC\dyad-apps\betwin
npm run dev
```

#### Passo 2: Testar o Login
1. Abra: **http://localhost:5173**
2. Você será redirecionado para `/login`
3. Clique em **"Criar conta"** para fazer signup
4. Preencha o formulário:
   - **Username**: seu_usuario
   - **Email**: seu@email.com
   - **Senha**: senha123456 (mínimo 6 caracteres)
5. Clique em **"Criar Conta"**

#### Passo 3: Verificar o Login
1. Após criar a conta, você será redirecionado para o Dashboard
2. Você verá seu email e username no canto superior direito
3. Clique no menu do usuário para ver as opções

---

### 3️⃣ **Configurar Variáveis de Ambiente no Vercel** (2 minutos)

#### Passo 1: Acessar Vercel
1. Abra: **https://vercel.com/dashboard**
2. Selecione o projeto **"betwin"**
3. Clique em **Settings**
4. No menu lateral, clique em **Environment Variables**

#### Passo 2: Adicionar Variáveis
Adicione estas 4 variáveis:

| Chave | Valor |
|-------|-------|
| `VITE_SUPABASE_URL` | `https://dqalbolenmsiwapljqjl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Cole aqui sua chave Anon do Supabase |
| `VITE_API_URL` | `https://seu-dominio.vercel.app` |
| `VITE_WS_URL` | `wss://seu-dominio.vercel.app` |

#### Como obter a Chave Anon do Supabase:
1. Acesse: **https://app.supabase.com**
2. Selecione **projeto betwin**
3. Clique em **Settings → API** (lado esquerdo)
4. Copie o valor de **"Anon public key"**
5. Cole no Vercel

---

## 📊 Status do Sistema Após Setup Completo

```
✅ Backend API: Rodando
✅ Frontend Dashboard: Rodando
✅ Database: Setup Completo (6 tabelas criadas)
✅ Autenticação: Funcionando (Login/Signup)
⏳ Autenticação Betfair: Aguardando Fase 3
```

---

## 🎯 Fluxo de Uso

```
1. Usuário acessa http://localhost:5173 (ou domínio Vercel)
   ↓
2. Sistema detecta que não está autenticado
   ↓
3. Redireciona para /login
   ↓
4. Usuário faz login ou cria nova conta
   ↓
5. Sistema valida credenciais no Supabase Auth
   ↓
6. Se válido:
   - Cria/busca perfil na tabela "users"
   - Armazena token em localStorage
   - Redireciona para Dashboard (/)
   ↓
7. Dashboard carrega dados do usuário
   ↓
8. Usuário pode navegar pelas seções (Mercados, Trading, etc)
   ↓
9. Cliquando no menu de usuário → Opção "Sair"
   ↓
10. Sistema remove token e redireciona para /login
```

---

## 🔑 Credenciais de Teste (Se Criar Manualmente)

Após criar as tabelas, você pode criar um usuário de teste:

```sql
INSERT INTO users (id, email, username, trading_mode, account_balance)
VALUES (
  uuid_generate_v4(),
  'teste@betwin.com',
  'teste',
  'PAPER',
  10000
);
```

Depois usar no login via Supabase Auth.

---

## 📱 URLs Importantes

| Serviço | URL |
|---------|-----|
| **Frontend Local** | http://localhost:5173 |
| **Backend Local** | http://localhost:3000 |
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **Supabase Dashboard** | https://app.supabase.com |
| **GitHub Repository** | https://github.com/negociocq/betwin |

---

## 🐛 Troubleshooting

### "Email já existe"
- Significa que esse email já foi usado no Supabase Auth
- Use outro email ou delete o usuário em **Supabase → Auth Users**

### "Conexão recusada" ao fazer login
- Verifique se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretas
- Teste em **http://localhost:5173** primeiro (desenvolvimento)

### "Tabelas não encontradas"
- Rode o SQL novamente no **SQL Editor do Supabase**
- Verifique se não houve erros na execução

### Frontend não conecta ao Backend
- Verifique se a URL do backend está correta em `.env.local`
- Em desenvolvimento: `VITE_API_URL=http://localhost:3000`
- Em produção (Vercel): `VITE_API_URL=https://seu-dominio.vercel.app`

---

## 🚀 Próximas Fases (After Setup)

- **Fase 3**: Integração com API Betfair (OAuth2)
- **Fase 4**: Analytics Engine (Indicadores Técnicos)
- **Fase 5**: Signal Engine (Geração de Sinais)
- **Fase 6**: Risk Manager
- **Fase 7**: Paper Trading
- **Fase 8**: Backtest Engine
- **Fase 9**: Real-time WebSocket Updates
- **Fase 10**: Dashboard Avançado

---

## ✨ Resumo

Você agora tem:
- ✅ Sistema de autenticação completo
- ✅ Frontend React rodando
- ✅ Backend serverless no Vercel
- ✅ Database PostgreSQL no Supabase
- ✅ GitHub sincronizado
- ✅ Deploy automático com Vercel

**Próximo passo importante**: Criar as tabelas no Supabase (copy & paste do SQL acima)

**Tempo total**: ~10-15 minutos

---

**Dúvidas?** Todos os endpoints estão prontos, database pronto, autenticação pronta. É só executar o SQL e testar! 🎯
