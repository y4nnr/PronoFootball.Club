/**
 * Cagnotte math: compute prize amounts + per-podium payer chunks for a competition.
 *
 * Default distribution (no admin override) scales linearly with player count so that
 * the well-known N=9 split (300 / 100 / 50 with a 50€ entry) is reached, and N=3 gives
 * the natural 100 / 50 / 0 (winner takes 2× entry, 2nd breaks even, 3rd loses entry).
 *
 *   prize₁ = entryFee × (2N / 3)
 *   prize₂ = entryFee × (N + 3) / 6
 *   prize₃ = entryFee × (N − 3) / 6
 *
 * The sum is exactly N × entryFee (the pot). 1st's percentage is fixed at 66.67 %.
 * 2nd's percentage falls from 33.33 % (N=3) toward 16.67 % (N → ∞).
 * 3rd's percentage rises from 0 % (N=3) toward 16.67 % (N → ∞), hitting 11.11 % at N=9.
 *
 * Admin can override with explicit prizePctFirst/Second/Third percentages — those are
 * used as-is (admin's responsibility to keep 1st > 2nd > 3rd and the sum at 100).
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

  let p1: number, p2: number, p3: number;
  if (adminSet) {
    p1 = (pot * (input.prizePctFirst as number)) / 100;
    p2 = (pot * (input.prizePctSecond as number)) / 100;
    p3 = (pot * (input.prizePctThird as number)) / 100;
  } else if (N >= 3) {
    p1 = (F * 2 * N) / 3;
    p2 = (F * (N + 3)) / 6;
    p3 = (F * (N - 3)) / 6;
  } else {
    // Not enough players for a podium yet. Return entry-back placeholders; the widget skips
    // the prize boxes anyway for N < 3.
    p1 = F; p2 = F; p3 = F;
  }

  // Display percentages (rounded; admin override displays its own configured values)
  const displayPct = adminSet
    ? [input.prizePctFirst as number, input.prizePctSecond as number, input.prizePctThird as number]
    : (pot > 0
        ? [Math.round((p1 / pot) * 100), Math.round((p2 / pot) * 100), Math.round((p3 / pot) * 100)]
        : [0, 0, 0]);

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
