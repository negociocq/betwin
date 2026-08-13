/**
 * Utilitários para conversão e cálculos de odds
 */

/**
 * Converte probabilidade para odds decimal
 * odds = 1 / probability
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error('Probability must be between 0 and 1 (exclusive)');
  }
  return 1 / probability;
}

/**
 * Converte odds decimal para probabilidade implícita
 * probability = 1 / odds
 */
export function oddsToImpliedProbability(odds: number): number {
  if (odds < 1.01) {
    throw new Error('Odds must be at least 1.01');
  }
  return 1 / odds;
}

/**
 * Calcula o edge em relação à odd
 * edge = estimated_probability - implied_probability
 */
export function calculateEdge(estimatedProbability: number, impliedProbability: number): number {
  return estimatedProbability - impliedProbability;
}

/**
 * Calcula o Expected Value (EV) simplificado
 * Para BACK: EV = (probability * (stake * (odds - 1))) - (1 - probability) * stake
 * Para LAY: EV = (1 - probability) * stake - probability * (stake * (odds - 1))
 */
export function calculateEV(
  stake: number,
  odds: number,
  estimatedProbability: number,
  side: 'BACK' | 'LAY'
): number {
  if (side === 'BACK') {
    const win = estimatedProbability * (stake * (odds - 1));
    const loss = (1 - estimatedProbability) * stake;
    return win - loss;
  } else {
    // LAY
    const win = (1 - estimatedProbability) * stake;
    const loss = estimatedProbability * (stake * (odds - 1));
    return win - loss;
  }
}

/**
 * Calcula o retorno potencial de uma aposta
 * Para BACK: retorno = stake * odds
 * Para LAY: retorno = -stake * (odds - 1) (se perder) ou stake (se ganhar)
 */
export function calculatePotentialReturn(stake: number, odds: number, side: 'BACK' | 'LAY'): number {
  if (side === 'BACK') {
    return stake * (odds - 1);
  } else {
    return stake * (odds - 1);
  }
}

/**
 * Calcula o ROI (Return on Investment) em percentual
 */
export function calculateROI(profit: number, stake: number): number {
  if (stake === 0) return 0;
  return (profit / stake) * 100;
}

/**
 * Calcula o Profit Factor (total wins / total losses)
 * Usado para avaliar a rentabilidade de uma estratégia
 */
export function calculateProfitFactor(totalWins: number, totalLosses: number): number {
  if (totalLosses === 0) return totalWins > 0 ? Infinity : 0;
  return totalWins / totalLosses;
}

/**
 * Calcula a taxa de acerto
 */
export function calculateWinRate(wins: number, totalTrades: number): number {
  if (totalTrades === 0) return 0;
  return wins / totalTrades;
}

/**
 * Formata odds para display
 */
export function formatOdds(odds: number, decimals: number = 2): string {
  return odds.toFixed(decimals);
}

/**
 * Formata probabilidade para percentual
 */
export function formatProbability(probability: number, decimals: number = 2): string {
  return `${(probability * 100).toFixed(decimals)}%`;
}

/**
 * Formata moeda
 */
export function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}
