/**
 * Cagnotte math: compute prize amounts + per-podium payer chunks for a competition.
 *
 * Default split (no admin override) is fixed across every competition for consistency:
 *   1st = 2/3 of the pot  (≈ 66.67 %)
 *   2nd = 2/9 of the pot  (≈ 22.22 %)
 *   3rd = 1/9 of the pot  (≈ 11.11 %)
 *
 * Same ratios as the canonical N=9 / 50 € CL split (300 / 100 / 50). For smaller
 * pots the 3rd place can end up below entryFee (a "perte nette" is then displayed
 * on the card); for larger pots all three positions are net-positive.
 *
 * Admin can override with explicit prizePctFirst/Second/Third percentages — those
 * are used as-is (admin's responsibility to keep 1st > 2nd > 3rd and the sum at 100).
 *
 * Allocation (settled-mode chunks): how many losers pay each podium = round((prize − entry) / entry).
 * Rounding drift is absorbed by 1st place.
 */

export type CagnotteResult = {
  pot: number;
  entryFee: number;
  participantCount: number;
  percentages: [number, number, number]; // rounded for display
  prizes: [number, number, number];
  nets: [number, number, number];
  chunks: [number, number, number];
  /** True when admin override was used (otherwise the dynamic default formula). */
  customSplit: boolean;
};

export function computeCagnotte(input: {
  participantCount: number;
  entryFee: number;
  prizePctFirst: number | null;
  prizePctSecond: number | null;
  prizePctThird: number | null;
}): CagnotteResult {
  const N = Math.max(0, input.participantCount);
  const F = Math.max(0, input.entryFee);
  const pot = N * F;

  const adminSet =
    input.prizePctFirst != null && input.prizePctSecond != null && input.prizePctThird != null;

  // Default split: 2/3, 2/9, 1/9 (== 6/9, 2/9, 1/9). Use rational arithmetic to avoid drift.
  let p1: number, p2: number, p3: number;
  if (adminSet) {
    p1 = (pot * (input.prizePctFirst as number)) / 100;
    p2 = (pot * (input.prizePctSecond as number)) / 100;
    p3 = (pot * (input.prizePctThird as number)) / 100;
  } else {
    p1 = (pot * 6) / 9;
    p2 = (pot * 2) / 9;
    p3 = (pot * 1) / 9;
  }

  // Display percentages: rounded to nearest integer for the chip on each podium card.
  const displayPct = adminSet
    ? [input.prizePctFirst as number, input.prizePctSecond as number, input.prizePctThird as number]
    : [67, 22, 11];

  // Chunk allocation (losers paying each podium). Negative net → 0 chunks for that podium.
  const losers = Math.max(0, N - 3);
  let c1 = Math.round((p1 - F) / F);
  let c2 = Math.round((p2 - F) / F);
  let c3 = Math.round((p3 - F) / F);
  c1 = Math.max(0, c1); c2 = Math.max(0, c2); c3 = Math.max(0, c3);
  const drift = losers - (c1 + c2 + c3);
  c1 = Math.max(0, c1 + drift);

  return {
    pot,
    entryFee: F,
    participantCount: N,
    percentages: [displayPct[0], displayPct[1], displayPct[2]] as [number, number, number],
    prizes: [p1, p2, p3],
    nets: [p1 - F, p2 - F, p3 - F],
    chunks: [c1, c2, c3],
    customSplit: adminSet,
  };
}
