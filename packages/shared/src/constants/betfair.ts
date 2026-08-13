/**
 * Constantes da API Betfair
 */

export const BETFAIR_API_ENDPOINT = 'https://api.betfair.com/exchange';
export const BETFAIR_IDENTITY_ENDPOINT = 'https://identitysso.betfair.com/api';

// Endpoints principais
export const BETFAIR_ENDPOINTS = {
  LIST_MARKET_CATALOGUE: '/betting/rest/v1/en/eventTypes',
  LIST_MARKET_BOOK: '/betting/rest/v1/en/marketBooks',
  GET_ACCOUNT_FUNDS: '/account/rest/v1/en/accountFunds',
  GET_ACCOUNT_DETAILS: '/account/rest/v1/en/accountDetails',
  PLACE_ORDERS: '/betting/rest/v1/en/orders/place',
  CANCEL_ORDERS: '/betting/rest/v1/en/orders/cancel',
  UPDATE_ORDERS: '/betting/rest/v1/en/orders/update',
  REPLACE_ORDERS: '/betting/rest/v1/en/orders/replace',
  GET_CURRENT_ORDERS: '/betting/rest/v1/en/orders',
  GET_CLEARED_ORDERS: '/betting/rest/v1/en/clearedOrders',
} as const;

// Rate Limits
export const RATE_LIMITS = {
  REQUESTS_PER_SECOND: 10,
  REQUESTS_PER_HOUR: 100000,
  BURST_LIMIT: 20, // máximo burst
  RETRY_DELAY_MS: 500,
  RETRY_MAX_ATTEMPTS: 3,
} as const;

// Timeouts
export const TIMEOUTS = {
  API_CALL_MS: 30000,
  MARKET_SYNC_MS: 5000,
  HEARTBEAT_MS: 30000,
} as const;

// Default Market Filter
export const DEFAULT_MARKET_FILTER = {
  turnInPlayEnabled: true,
  persistenceType: 'LAPSE',
  marketTime: {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
} as const;

// Comissão padrão
export const DEFAULT_COMMISSION_RATE = 0.05; // 5%
