import { z } from 'zod';

/**
 * Tipos para Paper Trading e Trading em geral
 */

export const TradeModeEnum = z.enum(['PAPER', 'LIVE']);
export type TradeMode = z.infer<typeof TradeModeEnum>;

// Position State
export const PositionStateEnum = z.enum(['OPEN', 'PENDING_CLOSE', 'CLOSED', 'PENDING_OPEN']);
export type PositionState = z.infer<typeof PositionStateEnum>;

// Trade Status
export const TradeStatusEnum = z.enum(['PENDING', 'OPEN', 'PARTIALLY_CLOSED', 'CLOSED', 'CANCELLED', 'ERROR']);
export type TradeStatus = z.infer<typeof TradeStatusEnum>;

// Trade Entity
export const TradeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  marketId: z.string(),
  selectionId: z.number(),
  side: z.enum(['BACK', 'LAY']),
  stake: z.number().positive(),
  odds: z.number().positive(),
  status: TradeStatusEnum,
  mode: TradeModeEnum,
  signalId: z.string().uuid().optional(),
  strategyId: z.string().uuid().optional(),

  // Execution details
  executedPrice: z.number().positive().optional(),
  executedStake: z.number().nonnegative().optional(),
  slippage: z.number().optional(),
  commission: z.number().nonnegative().default(0),

  // Settlement
  result: z.enum(['WIN', 'LOSS', 'VOID', 'PARTIAL']).optional(),
  profitLoss: z.number().optional(),
  roi: z.number().optional(),

  // Timestamps
  createdAt: z.string().datetime(),
  executedAt: z.string().datetime().optional(),
  settledAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
});
export type Trade = z.infer<typeof TradeSchema>;

// Portfolio
export const PortfolioSchema = z.object({
  userId: z.string().uuid(),
  totalCapital: z.number().nonnegative(),
  availableBalance: z.number(),
  usedBalance: z.number().nonnegative(),
  totalProfit: z.number(),
  totalLoss: z.number(),
  netProfit: z.number(),
  roi: z.number(),
  profitFactor: z.number(),
  winRate: z.number(),
  totalTrades: z.number().nonnegative(),
  winningTrades: z.number().nonnegative(),
  losingTrades: z.number().nonnegative(),
  averageWin: z.number().optional(),
  averageLoss: z.number().optional(),
  maxDrawdown: z.number().optional(),
  updatedAt: z.string().datetime(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

// Order
export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  marketId: z.string(),
  selectionId: z.number(),
  side: z.enum(['BACK', 'LAY']),
  stake: z.number().positive(),
  odds: z.number().positive(),
  status: z.enum(['PENDING', 'PLACED', 'EXECUTED', 'CANCELLED', 'REJECTED']),
  betfairOrderId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;
