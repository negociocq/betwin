/**
 * Constantes de Risco
 */

// Risk Manager defaults
export const RISK_DEFAULTS = {
  MAX_EXPOSURE_PERCENT: 25, // 25% do capital
  MAX_DAILY_LOSS_PERCENT: 10, // 10% do capital por dia
  MAX_WEEKLY_LOSS_PERCENT: 20, // 20% por semana
  MAX_POSITIONS: 10,
  MAX_LEVERAGE: 5,
  MIN_CONFIDENCE_PERCENT: 60,
  MIN_EDGE_PERCENT: 2, // 2% de edge mínimo
  MIN_EV_PERCENT: 5, // 5% de EV mínimo
} as const;

// Limites de Exposição
export const EXPOSURE_LIMITS = {
  PER_MARKET: 0.10, // 10% do capital por mercado
  PER_SELECTION: 0.05, // 5% por seleção
  TOTAL: 0.25, // 25% total
} as const;

// Risk Alert Severity
export const RISK_ALERT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;

// Risk Status
export const RISK_STATUS = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  HALTED: 'HALTED',
} as const;

// Kill Switch (Parada automática)
export const KILL_SWITCH_CONFIG = {
  ENABLED: true,
  TRIGGERS: {
    DAILY_LOSS_EXCEEDED: true,
    DRAWDOWN_EXCEEDED: true,
    POSITION_LIMIT_EXCEEDED: true,
    EXPOSURE_EXCEEDED: true,
  },
} as const;
