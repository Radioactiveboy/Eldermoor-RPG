/**
 * When the market at Eldermoor trades. The stallholders set up in the morning,
 * pack up as the light starts to go in the evening and walk home, and the
 * militia tell anyone who turns up after dark that the market is shut.
 */
export const MARKET_OPENS = 7;
export const MARKET_CLOSES = 18;

/**
 * Is the market open at this hour of the day?
 * @param late hours a particular trader opens and closes after the others (negative for earlier)
 */
export function marketOpen(hour: number, late = 0): boolean {
  return hour >= MARKET_OPENS + late && hour < MARKET_CLOSES + late;
}
