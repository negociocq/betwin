# Betwin — Plataforma de Análise Quantitativa para Betfair Exchange

Plataforma web completa para análise, paper trading e futura automação de operações na Betfair Exchange usando exclusivamente as APIs oficiais.

## Status

🚧 Em desenvolvimento — Primeira entrega (sem operações LIVE)

## Arquitetura

```
betwin/
├── packages/
│   ├── backend/          # Node.js/TypeScript - API e lógica de negócios
│   ├── frontend/         # React/TypeScript - Dashboard
│   └── shared/           # Tipos e utilitários compartilhados
├── docs/                 # Documentação
└── scripts/              # Scripts de setup e utilitários
```

## Stack Técnico

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Supabase)
- **API Externa**: Betfair Exchange Official API
- **Autenticação**: Betfair SSL Certificate + Session Token
- **Real-time**: WebSocket para atualizações de mercado

## Módulos Principais

### Backend (`packages/backend/src/modules/`)

- **betfair**: Camada de integração com API oficial
- **analytics**: Análise de probabilidades, edge, EV
- **strategies**: Motor de estratégias e registro
- **signals**: Engine para geração de sinais
- **risk**: Gestão de risco e limites
- **trading**: Paper trading e simulação
- **backtest**: Engine de backtesting
- **monitoring**: Auditoria, logs estruturados e métricas

### Frontend (`packages/frontend/src/`)

- Dashboard com visão geral
- Mercados e odds em tempo real
- Oportunidades (sinais)
- Histórico de operações
- Gestão de risco
- Configurações
- Modo PAPER/LIVE (bloqueado)

## Requisitos de Segurança

✅ Credenciais Betfair somente no backend
✅ Tokens de sessão gerenciados de forma segura
✅ Nenhuma automação de navegador ou scraping
✅ Sem tentativa de contornar autenticação/limites
✅ Sanitização de entradas
✅ Rate limiting
✅ Trilha de auditoria imutável

## Modo PAPER vs LIVE

- **PAPER** (padrão): Simulação com saldo virtual
- **LIVE** (bloqueado): Desbloqueado apenas com confirmação explícita do usuário + RiskManager ativo + limites configurados

## Primeira Entrega

- [x] Setup de monorepo
- [ ] Backend: Integração Betfair
- [ ] Backend: Autenticação
- [ ] Backend: Coleta de mercados/odds
- [ ] Backend: Database schema
- [ ] Backend: Analisador
- [ ] Backend: SignalEngine
- [ ] Backend: RiskManager
- [ ] Backend: PaperTrader
- [ ] Frontend: Dashboard base
- [ ] Frontend: Páginas principais
- [ ] Logging e métricas
- [ ] Testes
- [ ] Build e deploy

## Executando

```bash
# Setup
npm install

# Development
npm run dev

# Build
npm run build

# Tests
npm run test

# Lint
npm run lint

# Type check
npm run type-check
```

## Documentação

Veja `docs/` para:
- Integração Betfair
- Cálculos de análise
- Arquitetura detalhada
- API de paper trading
- Guia de backtesting

## ⚠️ Aviso Legal

Esta plataforma é para fins educacionais e de research. O usuário é responsável por:
- Conformidade com termos de serviço da Betfair
- Gestão de risco
- Decisões de trading

Nenhuma garantia de lucro. Trading envolve risco de perda total.
