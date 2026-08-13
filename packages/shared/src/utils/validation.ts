import { z } from 'zod';

/**
 * Validadores compartilhados
 */

// Odds validation
export const OddsSchema = z.number().min(1.01).max(1000);

// Stake validation
export const StakeSchema = z.number().positive();

// Probability validation
export const ProbabilitySchema = z.number().min(0).max(1);

// Edge validation
export const EdgeSchema = z.number().min(-1).max(1);

// Market ID validation
export const MarketIdSchema = z.string().regex(/^\d+\.\d+$/);

// Selection ID validation
export const SelectionIdSchema = z.number().positive().int();

// UUID validation
export const UUIDSchema = z.string().uuid();

// Email validation
export const EmailSchema = z.string().email();

// Trade data validation
export const TradeDataSchema = z.object({
  marketId: MarketIdSchema,
  selectionId: SelectionIdSchema,
  side: z.enum(['BACK', 'LAY']),
  stake: StakeSchema,
  odds: OddsSchema,
});

// Signal data validation
export const SignalDataSchema = z.object({
  marketId: MarketIdSchema,
  selectionId: SelectionIdSchema,
  type: z.enum(['BACK', 'LAY']),
  odds: OddsSchema,
  estimatedProbability: ProbabilitySchema,
  impliedProbability: ProbabilitySchema,
  edge: EdgeSchema,
  expectedValue: z.number(),
  confidence: z.number().min(0).max(100),
  suggestedStake: StakeSchema,
});
