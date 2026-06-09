/**
 * ELO win expectancy and helpers.
 *
 * Reference: World Football Elo Ratings, https://en.wikipedia.org/wiki/World_Football_Elo_Ratings
 *
 * Win expectancy: We = 1 / (10^(-dr/400) + 1)
 *   dr = ELO_A − ELO_B + home_bonus
 *
 * In our simulation:
 *   - +100 if team is a host playing on home soil (USA, Mexico, Canada).
 *   - 0 otherwise (group stage in another host country, knockout, etc.).
 */

export const HOST_BONUS = 100;

/** Returns the expected score (win probability for a 2-outcome match) of team A vs team B. */
export function winExpectancy(eloA: number, eloB: number, homeBonusA = 0): number {
  const dr = eloA - eloB + homeBonusA;
  return 1 / (Math.pow(10, -dr / 400) + 1);
}
