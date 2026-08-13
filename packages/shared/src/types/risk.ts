import { z } from 'zod';

/**
 * Tipos para Gestão de Risco
 */

// Risk Status
export const RiskStatusEnum = z.enum(['NORMAL', 'WARNING', 'CRITICAL', 'HALTED']);
export type RiskStatus = z.infer<typeof RiskStatusEnum>;

// Risk Alert Type
export const RiskAlertTypeEnum = z.enum([
  'HIGH_EXPOSURE',
  'DAILY_LOSS_LIMIT',
  'DRAWDOWN_LIMIT',
  'MAX_POSITIONS',
  'LEVERAGE_EXCEEDED',
  'VOLATILITY_SPIKE',
]);
export type RiskAlertType = z.infer<typeof RiskAlertTypeEnum>;

// Risk Alert
export const RiskAlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: RiskAlertTypeEnum,
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  message: z.string(),
  value: z.number(),
  limit: z.number(),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedBy: z.string().uuid().optional(),
});
export type RiskAlert = z.infer<typeof RiskAlertSchema>;

// Risk Limits Config
export const RiskLimitsConfigSchema = z.object({
  userId: z.string().uuid(),

  // Exposure limits
  maxExposurePerMarket: z.number().positive(),
  maxExposureTotal: z.number().positive(),
  maxExposurePerSelection: z.number().positive(),

  // Loss limits
  maxDailyLoss: z.number().positive(),
  maxWeeklyLoss: z.number().positive(),
  maxDrawdown: z.number().positive(),

  // Position limits
  maxPositions: z.number().positive().int(),
  maxPositionsPerMarket: z.number().positive().int(),

  // Stake limits
  minStake: z.number().positive(),
  maxStake: z.number().positive(),
  maxStakePerMarket: z.number().positive(),

  // Odds limits
  minOdds: z.number().positive(),
  maxOdds: z.number().positive(),

  // Leverage
  maxLeverage: z.number().positive(),

  // Liquidity
  minLiquidity: z.number().nonnegative(),

  // Signal
  minConfidence: z.number().min(0).max(100),
  minEdge: z.number(),
  minEV: z.number(),

  // Status
  enabled: z.boolean().default(true),
  updatedAt: z.string().datetime(),
});
export type RiskLimitsConfig = z.infer<typeof RiskLimitsConfigSchema>;

// Risk Monitor
export const RiskMonitorSchema = z.object({
  userId: z.string().uuid(),
  status: RiskStatusEnum,

  // Current metrics
  currentExposure: z.number().nonnegative(),
  exposurePercent: z.number().min(0).max(100),

  currentDailyLoss: z.number(),
  dailyLossPercent: z.number().min(0).max(100),

  currentDrawdown: z.number(),
  drawdownPercent: z.number().min(0).max(100),

  activePositions: z.number().nonnegative(),

  // Risk score
  overallRiskScore: z.number().min(0).max(100),

  // Alerts
  activeAlerts: z.array(RiskAlertSchema).optional(),

  updatedAt: z.string().datetime(),
});
export type RiskMonitor = z.infer<typeof RiskMonitorSchema>;
