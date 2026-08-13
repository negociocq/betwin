import { z } from 'zod';

/**
 * Tipos da API Betfair Exchange
 * Basados en documentação oficial: https://docs.betfair.com/display/1smk3HbT1cOeKh6P0DT/Exchange+Stream+API
 */

// Market Types
export const MarketTypeEnum = z.enum(['WIN', 'PLACE', 'EACH_WAY', 'MATCH_ODDS', 'OVER_UNDER', 'SCORE_CORRECT', 'GOALS_OVER_UNDER', 'CORNERS_OVER_UNDER']);
export type MarketType = z.infer<typeof MarketTypeEnum>;

// Status Types
export const MarketStatusEnum = z.enum(['OPEN', 'SUSPENDED', 'CLOSED']);
export type MarketStatus = z.infer<typeof MarketStatusEnum>;

export const RunnerStatusEnum = z.enum(['ACTIVE', 'REMOVED', 'HIDDEN', 'PLACED']);
export type RunnerStatus = z.infer<typeof RunnerStatusEnum>;

// Bet Side
export const BetSideEnum = z.enum(['BACK', 'LAY']);
export type BetSide = z.infer<typeof BetSideEnum>;

// Order Status
export const OrderStatusEnum = z.enum(['PENDING', 'EXECUTABLE', 'EXECUTED', 'CANCELLED', 'REJECTED']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

// Market Filter
export const MarketFilterSchema = z.object({
  eventTypeIds: z.array(z.string()).optional(),
  eventIds: z.array(z.string()).optional(),
  competitionIds: z.array(z.string()).optional(),
  marketIds: z.array(z.string()).optional(),
  venues: z.array(z.string()).optional(),
  bspMarket: z.boolean().optional(),
  bettingType: z.enum(['ODDS', 'LINE', 'RANGE', 'FIXED_ODDS']).optional(),
  turnInPlayEnabled: z.boolean().optional(),
  persistenceType: z.enum(['LAPSE', 'PERSIST', 'MARKET_ON_CLOSE']).optional(),
  marketTime: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
  suspendTime: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
  settledTime: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).optional(),
  withOrders: z.array(z.enum(['BACKED', 'LAYED', 'BACKED_AND_LAYED'])).optional(),
});
export type MarketFilter = z.infer<typeof MarketFilterSchema>;

// Market Book
export const RunnerCatalogSchema = z.object({
  selectionId: z.number(),
  runnerName: z.string(),
  handicap: z.number().default(0),
  metadata: z.record(z.string()).optional(),
});
export type RunnerCatalog = z.infer<typeof RunnerCatalogSchema>;

export const MarketCatalogSchema = z.object({
  marketId: z.string(),
  marketName: z.string(),
  marketTime: z.string().datetime(),
  suspension: z.string().datetime().optional(),
  bettingType: z.string(),
  turnInPlayEnabled: z.boolean(),
  persistenceType: z.string(),
  marketType: MarketTypeEnum,
  regulator: z.string().optional(),
  marketBaseRate: z.number().optional(),
  discountAllowed: z.boolean().optional(),
  runners: z.array(RunnerCatalogSchema),
  numberOfWinners: z.number().optional(),
  bspMarket: z.boolean().optional(),
  bspReconciled: z.boolean().optional(),
  complete: z.boolean().optional(),
  inPlay: z.boolean().optional(),
  numberOfRunners: z.number().optional(),
  numberOfActiveRunners: z.number().optional(),
  betDelay: z.number().optional(),
  status: MarketStatusEnum,
  runners: z.array(RunnerCatalogSchema),
  regulators: z.array(z.string()).optional(),
  countryCode: z.string().optional(),
  discountAllowed: z.boolean().optional(),
  timezone: z.string().optional(),
  openDate: z.string().datetime().optional(),
  version: z.number().optional(),
  priceLadderDefinition: z.object({
    type: z.enum(['CLASSIC', 'LADDER', 'NONE']),
  }).optional(),
});
export type MarketCatalog = z.infer<typeof MarketCatalogSchema>;

// Price Data
export const PriceSizeSchema = z.object({
  price: z.number().positive(),
  size: z.number().nonnegative(),
});
export type PriceSize = z.infer<typeof PriceSizeSchema>;

export const ExchangePricesSchema = z.object({
  availableToBack: z.array(PriceSizeSchema).optional(),
  availableToLay: z.array(PriceSizeSchema).optional(),
  tradedVolume: z.array(PriceSizeSchema).optional(),
});
export type ExchangePrices = z.infer<typeof ExchangePricesSchema>;

export const RunnerBookSchema = z.object({
  status: RunnerStatusEnum.optional(),
  ex: ExchangePricesSchema.optional(),
  exBest: ExchangePricesSchema.optional(),
  adjustmentFactor: z.number().optional(),
  lastPriceTraded: z.number().optional(),
  totalMatched: z.number().optional(),
  totalAvailable: z.number().optional(),
  matchesByStrategy: z.record(z.number()).optional(),
  runnerContext: z.object({
    position: z.number().optional(),
    trainersName: z.string().optional(),
    runnersVenue: z.string().optional(),
  }).optional(),
  selectionId: z.number(),
  handicap: z.number().default(0),
});
export type RunnerBook = z.infer<typeof RunnerBookSchema>;

export const MarketBookSchema = z.object({
  marketId: z.string(),
  isMarketDataDelayed: z.boolean().optional(),
  status: MarketStatusEnum.optional(),
  betDelay: z.number().optional(),
  bspReconciled: z.boolean().optional(),
  complete: z.boolean().optional(),
  inPlay: z.boolean().optional(),
  numberOfWinners: z.number().optional(),
  numberOfRunners: z.number().optional(),
  numberOfActiveRunners: z.number().optional(),
  totalMatched: z.number().optional(),
  totalAvailable: z.number().optional(),
  crossMatching: z.boolean().optional(),
  runnersVoidable: z.boolean().optional(),
  numberOfPendingBets: z.number().optional(),
  betCount: z.number().optional(),
  commissionRange: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  persistenceType: z.string().optional(),
  persistenceEligibilityTimeout: z.number().optional(),
  runners: z.array(RunnerBookSchema),
  regulators: z.array(z.string()).optional(),
  countryCode: z.string().optional(),
  discountAllowed: z.boolean().optional(),
  timezone: z.string().optional(),
  openDate: z.string().datetime().optional(),
  version: z.number().optional(),
  priceLadderDefinition: z.object({
    type: z.enum(['CLASSIC', 'LADDER', 'NONE']),
  }).optional(),
});
export type MarketBook = z.infer<typeof MarketBookSchema>;

// Account
export const AccountFundsSchema = z.object({
  discountRate: z.number(),
  pointsBalance: z.number(),
  wallet: z.enum(['UK', 'IRISH', 'AUSTRALIAN']).optional(),
});
export type AccountFunds = z.infer<typeof AccountFundsSchema>;

export const AccountDetailsSchema = z.object({
  currencyCode: z.string(),
  discountRate: z.number(),
  pointsBalance: z.number(),
  timezone: z.string(),
  locale: z.string(),
  region: z.string(),
  hasGccWallet: z.boolean(),
  walletName: z.string().optional(),
});
export type AccountDetails = z.infer<typeof AccountDetailsSchema>;

// Order Data
export const BetSchema = z.object({
  betId: z.string(),
  placedDate: z.number(),
  persistenceType: z.string(),
  orderType: z.string(),
  side: BetSideEnum,
  price: z.number(),
  status: z.enum(['PENDING', 'SETTLED', 'VOIDED', 'LAPSED', 'CANCELLED']),
  betCount: z.number(),
  cash: z.number(),
  matchedDate: z.number().optional(),
  averagePriceMatched: z.number().optional(),
  sizeSettled: z.number().optional(),
  profit: z.number().optional(),
  sizeCancelled: z.number().optional(),
});
export type Bet = z.infer<typeof BetSchema>;

export const CurrentOrdersSchema = z.object({
  moreAvailable: z.boolean(),
  orders: z.array(BetSchema),
});
export type CurrentOrders = z.infer<typeof CurrentOrdersSchema>;
