import { z } from 'zod';

/**
 * Tipos para Analytics e Sinais
 */

// Signal Status
export const SignalStatusEnum = z.enum(['GENERATED', 'VALIDATED', 'REJECTED', 'EXPIRED', 'EXECUTED']);
export type SignalStatus = z.infer<typeof SignalStatusEnum>;

// Signal Source
export const SignalSourceEnum = z.enum(['MOMENTUM', 'MEAN_REVERSION', 'BREAKOUT', 'CUSTOM']);
export type SignalSource = z.infer<typeof SignalSourceEnum>;

// Signal
export const SignalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  marketId: z.string(),
  selectionId: z.number(),
  type: z.enum(['BACK', 'LAY']),
  odds: z.number().positive(),

  // Analytics
  estimatedProbability: z.number().min(0).max(1),
  impliedProbability: z.number().min(0).max(1),
  edge: z.number().min(-1).max(1),
  expectedValue: z.number(),
  confidence: z.number().min(0).max(100),

  // Market data
  liquidityScore: z.number().min(0).max(100).optional(),
  spread: z.number().optional(),
  volatility: z.number().optional(),

  // Source
  source: SignalSourceEnum,
  strategyId: z.string().uuid().optional(),

  // Suggestion
  suggestedStake: z.number().positive(),
  riskReward: z.number().optional(),

  // Status
  status: SignalStatusEnum,
  reason: z.string().optional(),

  // Timestamps
  generatedAt: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  executedAt: z.string().datetime().optional(),
  expiredAt: z.string().datetime().optional(),
});
export type Signal = z.infer<typeof SignalSchema>;

// Indicator
export const IndicatorValueSchema = z.object({
  value: z.number(),
  timestamp: z.string().datetime(),
});
export type IndicatorValue = z.infer<typeof IndicatorValueSchema>;

export const IndicatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['SMA', 'EMA', 'RSI', 'MACD', 'BOLLINGER', 'ATR', 'CUSTOM']),
  marketId: z.string(),
  selectionId: z.number(),
  period: z.number().positive().optional(),
  values: z.array(IndicatorValueSchema),
  lastValue: z.number(),
  updatedAt: z.string().datetime(),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

// Market Pattern
export const PatternTypeEnum = z.enum(['TREND_UP', 'TREND_DOWN', 'CONSOLIDATION', 'REVERSAL', 'BREAKOUT']);
export type PatternType = z.infer<typeof PatternTypeEnum>;

export const MarketPatternSchema = z.object({
  id: z.string().uuid(),
  marketId: z.string(),
  selectionId: z.number(),
  type: PatternTypeEnum,
  strength: z.number().min(0).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  description: z.string(),
});
export type MarketPattern = z.infer<typeof MarketPatternSchema>;
