/**
 * Cagnotte math: compute prize amounts + per-podium payer chunks for a competition.
 *
 * Inputs
 * - participantCount (N): how many CompetitionUser rows exist
 * - entryFee: EUR each participant has paid into the pot
 * - percentages: [first, second, third] each 0-100, summing to 100 (admin override or default 67/22/11)
 *
 * Default percentages are the 6/2/1 grid (rounded to whole integers).
 *
 * Adjustment: if applying the percentages would make 3rd's prize less than the entry fee
 * (so 3rd loses money), we fall back to a "5/1/0 surplus" split — 3rd takes their entry
 * back (net 0), and the remaining pot − 3·entryFee is split 5:1 between 1st and 2nd. That
 * preserves the order 1st > 2nd > 3rd ≥ 0 net for any N ≥ 3.
 *
 * Allocation: chunks_i = round((prize_i − entryFee) / entryFee). Each loser pays entryFee
 * to exactly one podium position. If the chunk sum doesn't match N−3 due to rounding,
 * the difference is absorbed by 1st place (they keep the same prize either way; only the
 * "who pays whom" assignment shifts).
 */

export const DEFAULT_PRIZE_PCT_FIRST = 67;
export const DEFAULT_PRIZE_PCT_SECOND = 22;
export const DEFAULT_PRIZE_PCT_THIRD = 11;

export type CagnotteResult = {
  pot: number;
  entryFee: number;
  participantCount: number;
  percentages: [number, number, number];
  /** Applied (post-adjustment) gross prizes; rounded to cents in display, kept precise here. */
  prizes: [number, number, number];
  /** Net = prize − entryFee. 3rd is always ≥ 0. */
  nets: [number, number, number];
  /** Number of losers paying each podium position (settled-mode allocation). Sum = max(0, N-3). */
  chunks: [number, number, number];
  /** True when the percentages had to be adjusted because the user-configured split made 3rd lose money. */
  adjusted: boolean;
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

  const pct1 = input.prizePctFirst ?? DEFAULT_PRIZE_PCT_FIRST;
  const pct2 = input.prizePctSecond ?? DEFAULT_PRIZE_PCT_SECOND;
  const pct3 = input.prizePctThird ?? DEFAULT_PRIZE_PCT_THIRD;

  let p1 = (pot * pct1) / 100;
  let p2 = (pot * pct2) / 100;
  let p3 = (pot * pct3) / 100;
  let adjusted = false;

  // Fallback if 3rd would lose money: 3rd takes own entry back, surplus = pot - 3F split 5:1.
  if (p3 < F && N >= 3) {
    adjusted = true;
    const surplus = pot - 3 * F;
    p1 = F + (surplus * 5) / 6;
    p2 = F + (surplus * 1) / 6;
    p3 = F;
  }

  const losers = Math.max(0, N - 3);
  let c1 = Math.round((p1 - F) / F);
  let c2 = Math.round((p2 - F) / F);
  let c3 = Math.round((p3 - F) / F);
  // Clip individual chunks at >=0 (shouldn't ever go negative after the adjustment, but defensive).
  c1 = Math.max(0, c1); c2 = Math.max(0, c2); c3 = Math.max(0, c3);
  // Reconcile rounding drift by absorbing the delta into 1st.
  const drift = losers - (c1 + c2 + c3);
  c1 = Math.max(0, c1 + drift);

  return {
    pot,
    entryFee: F,
    participantCount: N,
    percentages: [pct1, pct2, pct3],
    prizes: [p1, p2, p3],
    nets: [p1 - F, p2 - F, p3 - F],
    chunks: [c1, c2, c3],
    adjusted,
  };
}
