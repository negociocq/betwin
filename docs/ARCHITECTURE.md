## Tipos Compartilhados

Todos os tipos TypeScript são centralizados em `packages/shared/src/types/` para máxima reutilização entre backend e frontend.

### Betfair Types (`betfair.ts`)

```typescript
// Market types
export type MarketType = 'WIN' | 'PLACE' | 'EACH_WAY' | 'MATCH_ODDS' | ...
export type MarketStatus = 'OPEN' | 'SUSPENDED' | 'CLOSED'
export type RunnerStatus = 'ACTIVE' | 'REMOVED' | 'HIDDEN' | 'PLACED'
export type BetSide = 'BACK' | 'LAY'

// Main entities
export interface MarketBook { /* ... */ }
export interface RunnerBook { /* ... */ }
export interface MarketCatalog { /* ... */ }
```

### Trading Types (`trading.ts`)

```typescript
export type TradeMode = 'PAPER' | 'LIVE'
export type TradeStatus = 'PENDING' | 'OPEN' | 'CLOSED' | ...

export interface Trade {
  id: UUID
  marketId: string
  selectionId: number
  side: BetSide
  stake: number
  odds: number
  status: TradeStatus
  mode: TradeMode
  // ...
}
```

### Analytics Types (`analytics.ts`)

```typescript
export type SignalStatus = 'GENERATED' | 'VALIDATED' | 'REJECTED' | ...
export type SignalSource = 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT' | ...

export interface Signal {
  id: UUID
  estimatedProbability: number
  impliedProbability: number
  edge: number
  expectedValue: number
  confidence: number
  // ...
}
```

### Risk Types (`risk.ts`)

```typescript
export type RiskStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'HALTED'

export interface RiskLimitsConfig {
  maxExposurePerMarket: number
  maxExposureTotal: number
  maxDailyLoss: number
  maxDrawdown: number
  // ...
}
```

## Constantes

### Betfair (`constants/betfair.ts`)

```typescript
export const BETFAIR_API_ENDPOINT = 'https://api.betfair.com/exchange'
export const RATE_LIMITS = {
  REQUESTS_PER_SECOND: 10,
  REQUESTS_PER_HOUR: 100000,
  BURST_LIMIT: 20,
  RETRY_DELAY_MS: 500,
  RETRY_MAX_ATTEMPTS: 3,
}
export const TIMEOUTS = {
  API_CALL_MS: 30000,
  MARKET_SYNC_MS: 5000,
}
```

### Trading (`constants/trading.ts`)

```typescript
export const TRADING_MODE = {
  PAPER: 'PAPER',
  LIVE: 'LIVE',
}
export const DEFAULT_TRADING_MODE = TRADING_MODE.PAPER // Sempre PAPER por padrão!

export const TRADING_LIMITS = {
  MIN_STAKE: 0.01,
  MAX_STAKE_PAPER: 1000,
  MAX_STAKE_LIVE: 100,
  MIN_ODDS: 1.01,
  MAX_ODDS: 1000,
}
```

### Risk (`constants/risk.ts`)

```typescript
export const RISK_DEFAULTS = {
  MAX_EXPOSURE_PERCENT: 25,
  MAX_DAILY_LOSS_PERCENT: 10,
  MAX_WEEKLY_LOSS_PERCENT: 20,
  MAX_POSITIONS: 10,
  MIN_CONFIDENCE_PERCENT: 60,
  MIN_EDGE_PERCENT: 2,
  MIN_EV_PERCENT: 5,
}

export const KILL_SWITCH_CONFIG = {
  ENABLED: true,
  TRIGGERS: {
    DAILY_LOSS_EXCEEDED: true,
    DRAWDOWN_EXCEEDED: true,
    POSITION_LIMIT_EXCEEDED: true,
    EXPOSURE_EXCEEDED: true,
  },
}
```

## Utilitários

### Odds (`utils/odds.ts`)

```typescript
// Conversão
probabilityToOdds(0.50) // → 2.00
oddsToImpliedProbability(2.00) // → 0.50

// Edge e EV
calculateEdge(0.60, 0.50) // → 0.10 (10%)
calculateEV(10, 2.00, 0.60, 'BACK') // → EV value

// Formatação
formatOdds(2.5) // → "2.50"
formatProbability(0.50) // → "50.00%"
formatCurrency(1000, 'EUR') // → "€1.000,00"
```

### Validação (`utils/validation.ts`)

Schemas Zod para validar entrada:

```typescript
const OddsSchema = z.number().min(1.01).max(1000)
const StakeSchema = z.number().positive()
const ProbabilitySchema = z.number().min(0).max(1)
const TradeDataSchema = z.object({ /* ... */ })
const SignalDataSchema = z.object({ /* ... */ })
```

## Status Paper Trading

**CRÍTICO**: O modo PAPER TRADING é **OBRIGATÓRIO por padrão**. A variável de ambiente `PAPER_TRADING_ONLY=true` deve ser SET em desenvolvimento e produção.

### Fluxo de Proteção

```
1. Backend inicia com PAPER_TRADING_ONLY=true
2. Qualquer tentativa de trade LIVE é automaticamente rejeitada
3. Executora valida modo antes de cada operação
4. Logs registram cada tentativa de ativação LIVE
5. RiskManager rejeita trades se não estiver em PAPER
```

### Para Futuro LIVE (Quando implementado)

O usuário precisará:

1. Navegar para Settings → Advanced
2. Clicar "Unlock Live Trading"
3. Sistema mostra:
   - Aviso de risco
   - Prompt de confirmação
   - Verificação de RiskManager
   - Verificação de limites
4. Re-confirmar com senha
5. Auditoria registra timestamp + user + IP

**Mesmo assim**, constante `PAPER_TRADING_ONLY` pode ser usada para lock global.

## CI/CD

### GitHub Actions Workflow

`.github/workflows/ci.yml` executa:

1. **Test**: Unit + Integration tests
2. **Lint**: ESLint em todos os packages
3. **Type Check**: TypeScript strict mode
4. **Build**: Compilação de todos os packages
5. **Coverage**: Upload para Codecov

Runs on: `push` (main, develop) e `pull_request` (main, develop)

## Environment Variables

### Backend (.env)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

BETFAIR_APP_ID=...
BETFAIR_CERT_PATH=...

JWT_SECRET=... (min 32 chars)

PAPER_TRADING_ONLY=true (ALWAYS!)
PAPER_TRADING_INITIAL_CAPITAL=10000

LOG_LEVEL=debug
PROMETHEUS_PORT=9090

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_ENV=development
```

## Docker

### Local Development

```bash
docker-compose up -d
```

Containers:
- `postgres` - PostgreSQL 16
- `redis` - Redis 7
- `backend` - Node.js API
- `frontend` - Vite dev server

### Volumes

- `postgres_data` - Database persistence
- `redis_data` - Cache persistence
- `./packages/backend/src` - Hot reload backend
- `./packages/frontend/src` - Hot reload frontend

## Banco de Dados

### Migrações

Executadas em `modules/database/migrations.ts`:

1. **users** - Contas de usuário
2. **markets** - Mercados da Betfair
3. **trades** - Trades simulados (Paper) e reais (Live)
4. **signals** - Sinais gerados
5. **analytics_cache** - Cache de indicadores
6. **risk_monitor** - Monitoramento de risco

Cada migração:
- Cria tabelas com índices
- Adiciona constraints apropriados
- Define tipos corretos (UUID, DECIMAL, JSONB)

### Connection Pool

`pool.ts` gerencia pool PostgreSQL:

```typescript
const pool = new pg.Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

Métodos:
- `query(text, params)` - Execute query
- `transaction(callback)` - Run in transaction
- `getConnection()` - Get client
- `checkHealth()` - Health check
- `close()` - Close all connections
