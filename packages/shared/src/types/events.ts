/**
 * Event types para o sistema de eventos
 */

export interface MarketUpdateEvent {
  type: 'MARKET_UPDATE';
  marketId: string;
  timestamp: string;
  data: {
    totalMatched?: number;
    totalAvailable?: number;
    inPlay?: boolean;
    status?: string;
  };
}

export interface OddsUpdateEvent {
  type: 'ODDS_UPDATE';
  marketId: string;
  selectionId: number;
  timestamp: string;
  data: {
    backOdds?: Array<{ price: number; size: number }>;
    layOdds?: Array<{ price: number; size: number }>;
    lastPriceTraded?: number;
    totalMatched?: number;
  };
}

export interface SignalGeneratedEvent {
  type: 'SIGNAL_GENERATED';
  signalId: string;
  timestamp: string;
  data: {
    marketId: string;
    selectionId: number;
    type: 'BACK' | 'LAY';
    odds: number;
    confidence: number;
    edge: number;
  };
}

export interface TradeExecutedEvent {
  type: 'TRADE_EXECUTED';
  tradeId: string;
  timestamp: string;
  data: {
    marketId: string;
    selectionId: number;
    side: 'BACK' | 'LAY';
    stake: number;
    odds: number;
    status: string;
  };
}

export interface TradeSettledEvent {
  type: 'TRADE_SETTLED';
  tradeId: string;
  timestamp: string;
  data: {
    result: 'WIN' | 'LOSS' | 'VOID';
    profitLoss: number;
    roi: number;
  };
}

export interface RiskAlertEvent {
  type: 'RISK_ALERT';
  alertId: string;
  timestamp: string;
  data: {
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    value: number;
    limit: number;
  };
}

export type SystemEvent =
  | MarketUpdateEvent
  | OddsUpdateEvent
  | SignalGeneratedEvent
  | TradeExecutedEvent
  | TradeSettledEvent
  | RiskAlertEvent;
