# Betwin — Plataforma Quantitativa para Betfair Exchange

## Visão Geral

Betwin é uma plataforma web completa para análise quantitativa, paper trading e futura automação de operações na Betfair Exchange. A plataforma utiliza exclusivamente as APIs oficiais da Betfair, sem scraping, sem automação de navegador e sem contornar mecanismos de segurança.

## Arquitetura

### Stack Técnico

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **API Broker**: Betfair Exchange Official API
- **Real-time**: WebSocket (Socket.io)
- **Containerization**: Docker + Docker Compose

### Estrutura de Monorepo

```
betwin/
├── packages/
│   ├── shared/              # Tipos, constantes, utilitários
│   ├── backend/             # API Node.js/Express
│   └── frontend/            # Dashboard React
├── docker-compose.yml       # Local development environment
└── .github/workflows/       # CI/CD
```

## Requisitos

- Node.js 20+
- Docker & Docker Compose
- npm 10+

## Setup Local

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Backend:
```bash
cp packages/backend/.env.example packages/backend/.env.local
# Editar packages/backend/.env.local com suas credenciais Betfair
```

Frontend:
```bash
cp packages/frontend/.env.local.example packages/frontend/.env.local
```

### 3. Iniciar Containers

```bash
docker-compose up -d
```

Isso iniciará:
- PostgreSQL (porta 5432)
- Redis (porta 6379)
- Backend API (porta 3000)
- Frontend (porta 5173)

### 4. Executar Migrações

```bash
npm run migrate --workspace=@betwin/backend
```

## Desenvolvimento

### Scripts Principais

```bash
# Development (frontend + backend)
npm run dev

# Build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm run test

# Tests with coverage
npm run test -- --coverage
```

### Frontend

```bash
cd packages/frontend
npm run dev          # Vite dev server na porta 5173
npm run build        # Build para produção
npm run preview      # Preview do build
```

### Backend

```bash
cd packages/backend
npm run dev          # Nodemon + tsx
npm run build        # TypeScript compilation
npm run start        # Executar build compilado
npm run migrate      # Executar migrações
npm run seed         # Seed de dados
```

## Arquitetura Detalhada

### Backend Modules

#### `betfair/`
Integração com API oficial da Betfair Exchange.

**Responsabilidades:**
- HTTP client com rate limiting e retry logic
- Autenticação via OAuth2/SSL Certificate
- Sincronização de mercados em tempo real
- Cache com Redis
- Event emitters para atualizações

**Arquivos chave:**
- `client.ts` - HTTP client com rate limiting
- `service.ts` - Orquestra chamadas à API
- `market-sync.ts` - Sincronização de mercados

#### `analytics/`
Engine de análise de mercados e indicadores técnicos.

**Responsabilidades:**
- Indicadores técnicos (SMA, EMA, RSI, MACD, Bollinger)
- Padrões de mercado (trend, suporte/resistência, volatilidade)
- Processamento de dados em tempo real
- Cache de análises

**Arquivos chave:**
- `indicators/` - Implementação de cada indicador
- `patterns/` - Detecção de padrões
- `processor.ts` - Processa dados e calcula indicadores

#### `signals/`
Engine de geração de sinais de trading.

**Responsabilidades:**
- Estratégias base (momentum, mean-reversion, breakout)
- Combinação de múltiplas signals
- Scoring de qualidade
- Persistência em database

**Arquivos chave:**
- `engine.ts` - Orquestra geração de signals
- `strategies/` - Implementação de cada estratégia
- `combiner.ts` - Combina múltiplas signals

#### `risk/`
Gerenciador de risco.

**Responsabilidades:**
- Validadores de exposição
- Leverage limiter
- Drawdown monitor
- Position sizing
- Alertas de risco
- Kill switch

**Arquivos chave:**
- `manager.ts` - Orquestra validações
- `validators/` - Cada tipo de validação

#### `trading/`
Engine de paper trading (simulação).

**Responsabilidades:**
- Executar trades em modo PAPER
- Simular fills e slippage
- Gerenciar portfólio
- Liquidar trades
- Calcular P&L

**Arquivos chave:**
- `executor.ts` - Executa trades
- `paper-trader.ts` - Simula fills
- `portfolio.ts` - Gerencia posições

#### `database/`
Camada de persistência.

**Responsabilidades:**
- Connection pool PostgreSQL
- Repositories para cada entidade
- Migrations versionadas
- Transações

**Arquivos chave:**
- `pool.ts` - Connection pool
- `repositories/` - Data access layer
- `migrations.ts` - Schema management

### Frontend Components

#### `common/`
Componentes genéricos reutilizáveis.

#### `dashboard/`
Dashboard principal com visão geral.

#### `markets/`
Browser de mercados e odds em tempo real.

#### `trading/`
Interface para executar e gerenciar trades.

#### `analytics/`
Visualização de análises e indicadores.

#### `signals/`
Visão de sinais gerados.

#### `risk/`
Dashboard de risco e limites.

#### `backtest/`
Interface para backtesting.

## Segurança

### Princípios

- ✅ Paper trading bloqueado por padrão
- ✅ Credenciais Betfair somente no backend
- ✅ Tokens de sessão com rotação automática
- ✅ Nenhuma automação de navegador
- ✅ Validação de entrada com Zod
- ✅ Rate limiting respeitando quotas Betfair
- ✅ Trilha de auditoria imutável
- ✅ CORS restrito ao frontend

### Modo LIVE (Bloqueado)

Para habilitar operações reais (futuro):

1. Usuário confirma explicitamente
2. Sistema mostra aviso de risco
3. Exige confirmação adicional
4. Verifica RiskManager ativo
5. Verifica limites configurados
6. Registra auditoria

**Constante de bloqueio:** `PAPER_TRADING_ONLY=true` (variável de ambiente)

## Cálculos Quantitativos

### Probabilidade Implícita

```
P_implícita = 1 / odds
```

### Edge

```
Edge = P_estimada - P_implícita
```

### Expected Value (EV)

**Para BACK:**
```
EV = (P_estimada × (stake × (odds - 1))) - ((1 - P_estimada) × stake)
```

**Para LAY:**
```
EV = ((1 - P_estimada) × stake) - (P_estimada × (stake × (odds - 1)))
```

### ROI

```
ROI = (Profit / Stake) × 100%
```

### Profit Factor

```
PF = Total Wins / Total Losses
```

## Monitoring

### Logs

- Winston/Pino para logging estruturado
- Níveis: DEBUG, INFO, WARN, ERROR
- Logs sem credenciais ou tokens sensíveis

### Métricas

- Prometheus para coleta de métricas
- Endpoints: /metrics (porta padrão 9090)

### Health Checks

- `/health` - Status geral
- Database health
- Redis health
- API Betfair connectivity

## Testes

### Unit Tests

```bash
npm run test
```

Cobertura esperada: 80%+

### Integration Tests

- Auth flow
- Betfair API integration
- Database operations

### E2E Tests (Futuro)

- Full flow signal → trade
- Playwright/Cypress

## Deployment

### Produção (Futuro)

- Docker images para backend e frontend
- Kubernetes manifests
- CI/CD pipeline com tests automáticos

## Roadmap

### Fase 1 (Completa)
- [x] Setup monorepo
- [x] TypeScript, linting, testes
- [x] Docker + docker-compose
- [x] Tipos e constantes compartilhadas
- [x] Database schema
- [x] Betfair client com rate limiting

### Fase 2-10 (Próximas)
- [ ] Autenticação Betfair
- [ ] Coleta de mercados/odds
- [ ] Analytics engine
- [ ] Signal engine
- [ ] Risk manager
- [ ] Paper trading
- [ ] Dashboard frontend
- [ ] Backtest engine
- [ ] Monitoring

## Documentação Adicional

- `docs/api.md` - Documentação de API
- `docs/analysis.md` - Cálculos de análise detalhados
- `docs/backtesting.md` - Guia de backtesting
- `docs/security.md` - Guia de segurança

## Contribuindo

1. Criar branch: `git checkout -b feature/my-feature`
2. Commit: `git commit -am 'Add feature'`
3. Push: `git push origin feature/my-feature`
4. Pull Request

## Licença

Proprietary - Betwin Platform

## Suporte

Para issues ou dúvidas, abrir uma issue no repositório.
