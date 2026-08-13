/**
 * Constantes de Trading
 */

// Modo de Trading (Paper vs Live)
export const TRADING_MODE = {
  PAPER: 'PAPER',
  LIVE: 'LIVE',
} as const;

// Modo padrão é sempre PAPER
export const DEFAULT_TRADING_MODE = TRADING_MODE.PAPER;

// Limites de Trading
export const TRADING_LIMITS = {
  MIN_STAKE: 0.01,
  MAX_STAKE_PAPER: 1000,
  MAX_STAKE_LIVE: 100,
  MIN_ODDS: 1.01,
  MAX_ODDS: 1000,
  MIN_PROBABILITY: 0.01,
  MAX_PROBABILITY: 0.99,
} as const;

// Slippage simulation (em Paper Trading)
export const SLIPPAGE_SIMULATION = {
  ENABLED: true,
  AVERAGE_PERCENT: 0.02, // 2% de slippage médio
  MAX_PERCENT: 0.05, // 5% máximo
  VOLATILITY_FACTOR: 1.5, // Aumenta com volatilidade
} as const;

// Paper Trading defaults
export const PAPER_TRADING_DEFAULTS = {
  INITIAL_CAPITAL: 10000,
  INITIAL_CURRENCY: 'EUR',
  COMMISSION_RATE: 0.05, // 5%
  SETTLEMENT_DELAY_MS: 3600000, // 1 hora
} as const;

// Drawdown tracking
export const DRAWDOWN_CONFIG = {
  CALCULATION_PERIOD_DAYS: 30,
  ALERT_THRESHOLD_PERCENT: 15,
  CRITICAL_THRESHOLD_PERCENT: 25,
} as const;
