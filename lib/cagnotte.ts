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
  /** Which gating version produced this result (1 = legacy %, 2 = rounded-€50). */
  version: 1 | 2;
};

export function computeCagnotte(input: {
  participantCount: number;
  entryFee: number;
  prizePctFirst: number | null;
  prizePctSecond: number | null;
  prizePctThird: number | null;
  /** Competition.cagnotteVersion — 1 = legacy percentage display, 2 = rounded-€50 distribution. Defaults to 2. */
  version?: 1 | 2;
}): CagnotteResult {
  const N = Math.max(0, input.participantCount);
  const F = Math.max(0, input.entryFee);
  const pot = N * F;
  const version = input.version ?? 2;

  const adminSet =
    input.prizePctFirst != null && input.prizePctSecond != null && input.prizePctThird != null;

  let p1: number, p2: number, p3: number;
  let displayPct: [number, number, number];
  let chunks: [number, number, number];

  if (adminSet) {
    // Admin override beats version routing — fixed percentages, classic chunk math.
    p1 = (pot * (input.prizePctFirst as number)) / 100;
    p2 = (pot * (input.prizePctSecond as number)) / 100;
    p3 = (pot * (input.prizePctThird as number)) / 100;
    displayPct = [input.prizePctFirst as number, input.prizePctSecond as number, input.prizePctThird as number];
    chunks = chunksFromPrizes(p1, p2, p3, F, N);
  } else if (version === 1) {
    // Legacy default split: 2/3, 2/9, 1/9.
    p1 = (pot * 6) / 9;
    p2 = (pot * 2) / 9;
    p3 = (pot * 1) / 9;
    displayPct = [67, 22, 11];
    chunks = chunksFromPrizes(p1, p2, p3, F, N);
  } else {
    // v2: rounded-€50 distribution.
    const { computeDistribution, computePaymentGraph } = require('./cagnotte-rounded') as typeof import('./cagnotte-rounded');
    const dist = computeDistribution(N);
    if (dist.type !== 'computed') {
      // Insufficient participants — return an empty result; widget will show "need ≥ 2 joueurs".
      p1 = 0; p2 = 0; p3 = 0;
      displayPct = [0, 0, 0];
      chunks = [0, 0, 0];
    } else {
      p1 = dist.first;
      p2 = dist.second ?? 0;
      p3 = dist.third ?? 0;
      // Percentages displayed are derived from the rounded prizes (no longer the rigid 67/22/11 grid).
      displayPct = pot > 0
        ? [Math.round(p1 / pot * 100), Math.round(p2 / pot * 100), Math.round(p3 / pot * 100)]
        : [0, 0, 0];
      // Re-use the rounded-distribution payment graph builder so chunk counts stay deterministic
      // and consistent with the canonical assignment (worst loser → 1st first, etc.).
      const fakeStandings = Array.from({ length: N }, (_, i) => ({ userId: 'p' + i, name: 'p' + i, rank: i + 1 }));
      const graph = computePaymentGraph(dist, fakeStandings);
      const winnerIds = [fakeStandings[0]?.userId, fakeStandings[1]?.userId, fakeStandings[2]?.userId];
      chunks = [
        graph.filter(e => e.to.userId === winnerIds[0]).length,
        graph.filter(e => e.to.userId === winnerIds[1]).length,
        graph.filter(e => e.to.userId === winnerIds[2]).length,
      ] as [number, number, number];
    }
  }

  return {
    pot,
    entryFee: F,
    participantCount: N,
    percentages: displayPct,
    prizes: [p1, p2, p3],
    nets: [p1 - F, p2 - F, p3 - F],
    chunks,
    customSplit: adminSet,
    version,
  };
}

/** Legacy chunk math (used by v1 + admin-override branches). */
function chunksFromPrizes(p1: number, p2: number, p3: number, F: number, N: number): [number, number, number] {
  const losers = Math.max(0, N - 3);
  let c1 = Math.max(0, Math.round((p1 - F) / F));
  let c2 = Math.max(0, Math.round((p2 - F) / F));
  let c3 = Math.max(0, Math.round((p3 - F) / F));
  const drift = losers - (c1 + c2 + c3);
  c1 = Math.max(0, c1 + drift);
  return [c1, c2, c3];
}
