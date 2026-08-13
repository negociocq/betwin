/**
 * Betfair Client - HTTP client com rate limiting e retry logic
 * Responsável por toda a comunicação com a API oficial da Betfair
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { BETFAIR_API_ENDPOINT, RATE_LIMITS, TIMEOUTS } from '@betwin/shared/constants/betfair';
import { logger } from '../../infrastructure/logger';
import { RateLimitError, ExternalAPIError } from '../../infrastructure/errors';
import { getConfig } from '../../infrastructure/config';

const config = getConfig();

interface RateLimitState {
  requestCount: number;
  windowStart: number;
  resetAt: number;
}

export class BetfairClient {
  private client: AxiosInstance;
  private rateLimitState: RateLimitState;
  private sessionToken: string | null = null;

  constructor() {
    this.rateLimitState = {
      requestCount: 0,
      windowStart: Date.now(),
      resetAt: Date.now() + RATE_LIMITS.REQUESTS_PER_SECOND * 1000,
    };

    this.client = axios.create({
      baseURL: BETFAIR_API_ENDPOINT,
      timeout: TIMEOUTS.API_CALL_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-Application': config.BETFAIR_APP_ID,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(
            error.response.headers['retry-after'] || String(RATE_LIMITS.RETRY_DELAY_MS / 1000)
          );
          throw new RateLimitError(
            'Rate limit exceeded',
            retryAfter,
            { endpoint: error.config?.url, status: error.response.status }
          );
        }

        throw new ExternalAPIError(
          `Betfair API error: ${error.message}`,
          error.response?.status || 500,
          { endpoint: error.config?.url }
        );
      }
    );
  }

  /**
   * Check rate limits and apply backoff if necessary
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowElapsed = now - this.rateLimitState.windowStart;

    // Reset window if time has passed
    if (windowElapsed > 1000) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = now;
      this.rateLimitState.resetAt = now + 1000;
    }

    // Check if we've hit the burst limit
    if (this.rateLimitState.requestCount >= RATE_LIMITS.BURST_LIMIT) {
      const waitTime = this.rateLimitState.resetAt - now;
      if (waitTime > 0) {
        logger.warn('Rate limit burst reached, waiting...', { waitTime });
        await new Promise((resolve) => setTimeout(resolve, waitTime + 10));
      }
    }

    this.rateLimitState.requestCount++;
  }

  /**
   * Set session token for authenticated requests
   */
  setSessionToken(token: string): void {
    this.sessionToken = token;
    this.client.defaults.headers.common['X-Authentication'] = token;
  }

  /**
   * Clear session token
   */
  clearSessionToken(): void {
    this.sessionToken = null;
    delete this.client.defaults.headers.common['X-Authentication'];
  }

  /**
   * Make authenticated request with retry logic
   */
  async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    retries: number = RATE_LIMITS.RETRY_MAX_ATTEMPTS
  ): Promise<T> {
    await this.checkRateLimit();

    try {
      const response = await this.client({
        method,
        url: endpoint,
        data,
      });

      return response.data as T;
    } catch (error) {
      if (error instanceof RateLimitError && retries > 0) {
        logger.warn('Rate limited, retrying...', {
          retriesLeft: retries,
          retryAfter: error.retryAfter,
        });
        await new Promise((resolve) =>
          setTimeout(resolve, (error.retryAfter || RATE_LIMITS.RETRY_DELAY_MS / 1000) * 1000)
        );
        return this.request<T>(method, endpoint, data, retries - 1);
      }

      logger.error('Betfair API request failed', { endpoint, method, error });
      throw error;
    }
  }

  /**
   * GET request
   */
  get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.sessionToken;
  }
}

// Singleton instance
let clientInstance: BetfairClient;

export function getBetfairClient(): BetfairClient {
  if (!clientInstance) {
    clientInstance = new BetfairClient();
  }
  return clientInstance;
}
