/**
 * Cagnotte v2: rounded-€50 distribution.
 *
 * Every player pays a €50 stake; pot = N × 50. The pot is redistributed in clean
 * multiples of €50 so that each non-prize player owes exactly one €50 cheque.
 *
 * Small-pot cases (hand-tuned):
 *   N = 0 or 1 → `insufficient` (no pot to distribute)
 *   N = 2 → 100 /  – /  – (1st takes the whole pot, 2nd is a full loser)
 *   N = 3 → 100 / 50 /  – (1st +50, 2nd breaks even, 3rd loses)
 *   N = 4 → 150 / 50 /  – (1st +100, 2nd breaks even, no 3rd-place prize)
 *   N = 5 → 150 /100 /  – (1st +100, 2nd +50, no 3rd-place prize)
 *
 * General rule (N ≥ 6):
 *   third  = 50
 *   second = max( round_nearest_50(pot × 0.22), 100 )
 *   first  = pot − second − third
 *
 * Rounding: standard nearest, halves UP. e.g. 125 → 150, 175 → 200.
 *
 * The hierarchy 1st > 2nd > 3rd holds by construction; we assert it anyway.
 */

const STAKE = 50;
const UNIT = 50;

export type Distribution =
  | { type: 'insufficient' }
  | { type: 'computed'; first: number; second: number | null; third: number | null };

export type PaymentGraphEntry = {
  from: { userId: string; name: string };
  to: { userId: string; name: string };
  amount: number;
};

export type Settlement =
  | { kind: 'payer'; counterparty: { userId: string; name: string }; amount: number }
  | { kind: 'receiver'; counterparties: Array<{ userId: string; name: string }>; amount: number }
  | { kind: 'breakeven' };

/** Round n to the nearest multiple of UNIT (50). Halves round UP. */
function roundToNearestUnit(n: number): number {
  return Math.floor((n + UNIT / 2) / UNIT) * UNIT;
}

export function computeDistribution(nPlayers: number): Distribution {
  if (!Number.isFinite(nPlayers) || nPlayers < 2) return { type: 'insufficient' };

  const pot = nPlayers * STAKE;

  let first: number;
  let second: number | null;
  let third: number | null;

  switch (nPlayers) {
    case 2: first = 100; second = null; third = null; break;
    case 3: first = 100; second = 50;   third = null; break;
    case 4: first = 150; second = 50;   third = null; break;
    case 5: first = 150; second = 100;  third = null; break;
    default: {
      third = STAKE;
      second = Math.max(roundToNearestUnit(pot * 0.22), 100);
      first = pot - second - third;
    }
  }

  // Sanity: hierarchy must hold for every defined tier.
  if (second !== null && !(first > second)) {
    throw new Error(`Cagnotte invariant broken (N=${nPlayers}): first (${first}) must exceed second (${second})`);
  }
  if (third !== null && second !== null && !(second > third)) {
    throw new Error(`Cagnotte invariant broken (N=${nPlayers}): second (${second}) must exceed third (${third})`);
  }
  if (third !== null && !(third > 0)) {
    throw new Error(`Cagnotte invariant broken (N=${nPlayers}): third (${third}) must be > 0`);
  }
  if (first <= 0) {
    throw new Error(`Cagnotte invariant broken (N=${nPlayers}): first (${first}) must be > 0`);
  }

  // Pot conservation
  const tiers = [first, second ?? 0, third ?? 0].reduce((a, b) => a + b, 0);
  if (tiers !== pot) {
    throw new Error(`Cagnotte invariant broken (N=${nPlayers}): tiers (${tiers}) must equal pot (${pot})`);
  }

  return { type: 'computed', first, second, third };
}

/**
 * Build the loser→winner cheque graph from the final standings.
 *
 * Properties:
 *   - Every entry is exactly STAKE (€50).
 *   - Each loser owes exactly one cheque.
 *   - Players whose prize equals STAKE (breakeven) have no entry — they keep their own stake.
 *   - Deterministic: worst-ranked loser fills 1st's gap first, then 2nd's gap.
 *
 * `finalStandings` must be sorted best-to-worst (rank ascending). Caller is responsible
 * for tie-breaking — lib/classement.ts already guarantees strict ordering.
 */
export function computePaymentGraph(
  distribution: Distribution,
  finalStandings: Array<{ userId: string; name: string; rank: number }>
): PaymentGraphEntry[] {
  if (distribution.type !== 'computed') return [];
  if (finalStandings.length < 2) return [];

  // Defensive: ensure the standings are sorted best→worst.
  const sorted = [...finalStandings].sort((a, b) => a.rank - b.rank);

  const { first, second, third } = distribution;
  const winners: Array<{ user: { userId: string; name: string }; net: number }> = [];
  if (sorted[0]) winners.push({ user: sorted[0], net: first - STAKE });
  if (sorted[1] && second !== null) winners.push({ user: sorted[1], net: second - STAKE });
  if (sorted[2] && third !== null)  winners.push({ user: sorted[2], net: third  - STAKE });

  // Losers are everyone not on a podium tier. With first|second=null we may have fewer
  // prize slots than 3; the rest are losers (incl. the rank-2 player in the N=2 case).
  const winnerCount = winners.length;
  const losers = sorted.slice(winnerCount); // ranks (winnerCount+1) .. last

  // Deterministic order: worst-ranked loser pays first.
  const queue = [...losers].sort((a, b) => b.rank - a.rank);

  const entries: PaymentGraphEntry[] = [];
  // Fill winners by tier order: 1st first, then 2nd, then 3rd. (3rd's net is always 0 → skipped.)
  for (const w of winners) {
    let remaining = w.net;
    while (remaining > 0) {
      const payer = queue.shift();
      if (!payer) {
        throw new Error('Cagnotte settlement broken: not enough losers to cover winners');
      }
      entries.push({
        from: { userId: payer.userId, name: payer.name },
        to: { userId: w.user.userId, name: w.user.name },
        amount: STAKE,
      });
      remaining -= STAKE;
    }
  }

  if (queue.length !== 0) {
    throw new Error(`Cagnotte settlement broken: ${queue.length} loser(s) left unassigned`);
  }
  // Total transferred must equal sum of winner nets (which equals N − winnerCount loser stakes).
  return entries;
}

/**
 * Per-player view of the settlement: one of payer / receiver / breakeven.
 * Convenient for rendering ("Tu dois 50€ à X" / "Tu reçois 50€ de [list]" / "Tu récupères ta mise").
 */
export function settlementFor(
  userId: string,
  distribution: Distribution,
  finalStandings: Array<{ userId: string; name: string; rank: number }>,
  graph: PaymentGraphEntry[]
): Settlement {
  if (distribution.type !== 'computed') return { kind: 'breakeven' };

  const own = finalStandings.find(s => s.userId === userId);
  if (!own) return { kind: 'breakeven' };

  // Payer?
  const sent = graph.find(e => e.from.userId === userId);
  if (sent) return { kind: 'payer', counterparty: sent.to, amount: sent.amount };

  // Receiver?
  const received = graph.filter(e => e.to.userId === userId);
  if (received.length > 0) {
    return {
      kind: 'receiver',
      counterparties: received.map(e => e.from),
      amount: STAKE,
    };
  }

  // Otherwise breakeven (a podium tier whose prize == STAKE).
  return { kind: 'breakeven' };
}

export const CAGNOTTE_STAKE = STAKE;
export const CAGNOTTE_UNIT = UNIT;
