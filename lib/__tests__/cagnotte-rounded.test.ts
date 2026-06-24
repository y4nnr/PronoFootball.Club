import {
  computeDistribution,
  computePaymentGraph,
  settlementFor,
  CAGNOTTE_STAKE,
} from '../cagnotte-rounded';

describe('computeDistribution', () => {
  it('returns insufficient for N=0 and N=1', () => {
    expect(computeDistribution(0)).toEqual({ type: 'insufficient' });
    expect(computeDistribution(1)).toEqual({ type: 'insufficient' });
  });

  // Worked-example table from the brief — every row must match exactly.
  const worked: Array<[number, number | null, number | null, number | null]> = [
    [2,  100,  null, null],
    [3,  100,  50,   null],
    [4,  150,  50,   null],
    [5,  150,  100,  null],
    [6,  150,  100,  50],
    [7,  200,  100,  50],
    [8,  250,  100,  50],
    [9,  300,  100,  50],
    [10, 350,  100,  50],
    [11, 400,  100,  50],
    [12, 400,  150,  50],
    [15, 550,  150,  50],
    [20, 750,  200,  50],
    [30, 1100, 350,  50],
    [50, 1900, 550,  50],
  ];

  it.each(worked)('N=%i → first=%p, second=%p, third=%p', (n, first, second, third) => {
    const r = computeDistribution(n);
    expect(r.type).toBe('computed');
    if (r.type !== 'computed') return;
    expect(r.first).toBe(first);
    expect(r.second).toBe(second);
    expect(r.third).toBe(third);
    // Pot conservation
    const tiers = r.first + (r.second ?? 0) + (r.third ?? 0);
    expect(tiers).toBe(n * CAGNOTTE_STAKE);
  });

  it('enforces hierarchy 1st > 2nd > 3rd by construction', () => {
    for (let n = 2; n <= 100; n++) {
      const r = computeDistribution(n);
      if (r.type !== 'computed') continue;
      if (r.second !== null) expect(r.first).toBeGreaterThan(r.second);
      if (r.second !== null && r.third !== null) expect(r.second).toBeGreaterThan(r.third);
      if (r.third !== null) expect(r.third).toBeGreaterThan(0);
    }
  });
});

describe('computePaymentGraph', () => {
  const mkUser = (id: string, rank: number) => ({ userId: id, name: id, rank });

  it('returns no entries when distribution is insufficient', () => {
    const standings = [mkUser('a', 1)];
    expect(computePaymentGraph({ type: 'insufficient' }, standings)).toEqual([]);
  });

  it('N=2: rank-2 pays the whole 50€ to rank-1', () => {
    const dist = computeDistribution(2);
    const standings = [mkUser('A', 1), mkUser('B', 2)];
    const graph = computePaymentGraph(dist, standings);
    expect(graph).toHaveLength(1);
    expect(graph[0]).toEqual({ from: { userId: 'B', name: 'B' }, to: { userId: 'A', name: 'A' }, amount: 50 });
  });

  it('N=3: rank-3 pays 50€ to rank-1; rank-2 keeps their stake (breakeven)', () => {
    const dist = computeDistribution(3);
    const standings = [mkUser('A', 1), mkUser('B', 2), mkUser('C', 3)];
    const graph = computePaymentGraph(dist, standings);
    expect(graph).toHaveLength(1);
    expect(graph[0]).toEqual({ from: { userId: 'C', name: 'C' }, to: { userId: 'A', name: 'A' }, amount: 50 });
  });

  it('N=4: ranks 3 and 4 pay 50€ each to rank-1; rank-2 breakeven', () => {
    const dist = computeDistribution(4);
    const standings = [mkUser('A', 1), mkUser('B', 2), mkUser('C', 3), mkUser('D', 4)];
    const graph = computePaymentGraph(dist, standings);
    expect(graph).toHaveLength(2);
    // Worst-ranked first: D, then C
    expect(graph[0].from.userId).toBe('D');
    expect(graph[1].from.userId).toBe('C');
    graph.forEach(e => { expect(e.to.userId).toBe('A'); expect(e.amount).toBe(50); });
  });

  it('N=9 (canonical CL): 5 losers pay 1st (250 net), 1 pays 2nd (50 net), 3rd breakeven', () => {
    const dist = computeDistribution(9);
    const standings = Array.from({ length: 9 }, (_, i) => mkUser(String.fromCharCode(65 + i), i + 1));
    const graph = computePaymentGraph(dist, standings);
    expect(graph).toHaveLength(6);
    const paidTo1st = graph.filter(e => e.to.userId === 'A').length;
    const paidTo2nd = graph.filter(e => e.to.userId === 'B').length;
    const paidTo3rd = graph.filter(e => e.to.userId === 'C').length;
    expect(paidTo1st).toBe(5);
    expect(paidTo2nd).toBe(1);
    expect(paidTo3rd).toBe(0);
    // Worst (rank 9 = I) goes to 1st first
    expect(graph[0]).toEqual(expect.objectContaining({ from: { userId: 'I', name: 'I' }, to: { userId: 'A', name: 'A' } }));
    // Best-ranked loser (rank 4 = D) pays 2nd
    expect(graph[5]).toEqual(expect.objectContaining({ from: { userId: 'D', name: 'D' }, to: { userId: 'B', name: 'B' } }));
  });

  it('N=12: 6 losers fund 1st (350 net) and 2nd (100 net), 3rd breakeven', () => {
    const dist = computeDistribution(12);
    const standings = Array.from({ length: 12 }, (_, i) => mkUser('p' + (i + 1), i + 1));
    const graph = computePaymentGraph(dist, standings);
    expect(graph).toHaveLength(7 + 2); // 7 × 50 = 350 to 1st, 2 × 50 = 100 to 2nd
    expect(graph.filter(e => e.to.userId === 'p1').length).toBe(7);
    expect(graph.filter(e => e.to.userId === 'p2').length).toBe(2);
    expect(graph.filter(e => e.to.userId === 'p3').length).toBe(0);
  });

  it('every transaction is exactly 50€ (no fractional cheques)', () => {
    for (const n of [2, 3, 4, 5, 6, 9, 10, 12, 20, 50]) {
      const dist = computeDistribution(n);
      const standings = Array.from({ length: n }, (_, i) => mkUser('u' + i, i + 1));
      const graph = computePaymentGraph(dist, standings);
      graph.forEach(e => expect(e.amount).toBe(50));
    }
  });

  it('total transferred equals sum of net winnings', () => {
    for (const n of [2, 3, 4, 5, 6, 9, 15, 30]) {
      const dist = computeDistribution(n);
      if (dist.type !== 'computed') continue;
      const standings = Array.from({ length: n }, (_, i) => mkUser('u' + i, i + 1));
      const graph = computePaymentGraph(dist, standings);
      const transferred = graph.reduce((s, e) => s + e.amount, 0);
      const winnerNet = (dist.first - 50)
        + (dist.second !== null ? Math.max(0, dist.second - 50) : 0)
        + (dist.third !== null ? Math.max(0, dist.third - 50) : 0);
      expect(transferred).toBe(winnerNet);
    }
  });

  it('is deterministic across multiple invocations', () => {
    const dist = computeDistribution(10);
    const standings = Array.from({ length: 10 }, (_, i) => mkUser('u' + i, i + 1));
    const a = computePaymentGraph(dist, standings);
    const b = computePaymentGraph(dist, standings);
    expect(a).toEqual(b);
  });

  it('respects standings even when caller passes them out of order', () => {
    const dist = computeDistribution(6);
    // Pass standings shuffled
    const standings = [
      mkUser('C', 3), mkUser('A', 1), mkUser('F', 6),
      mkUser('B', 2), mkUser('D', 4), mkUser('E', 5),
    ];
    const graph = computePaymentGraph(dist, standings);
    // For N=6 → 150/100/50 → 1st needs 100 (2 payers), 2nd needs 50 (1 payer), 3rd breakeven (0)
    expect(graph.filter(e => e.to.userId === 'A').length).toBe(2);
    expect(graph.filter(e => e.to.userId === 'B').length).toBe(1);
    expect(graph.filter(e => e.to.userId === 'C').length).toBe(0);
    // Worst-ranked loser (F, rank 6) pays 1st
    expect(graph[0].from.userId).toBe('F');
  });
});

describe('settlementFor', () => {
  it('returns breakeven for podium players whose prize equals stake', () => {
    const dist = computeDistribution(9); // 300 / 100 / 50 — 3rd is breakeven
    const standings = Array.from({ length: 9 }, (_, i) => mkUser(String.fromCharCode(65 + i), i + 1));
    const graph = computePaymentGraph(dist, standings);
    expect(settlementFor('C', dist, standings, graph)).toEqual({ kind: 'breakeven' });
  });

  it('returns payer with counterparty for a loser', () => {
    const dist = computeDistribution(9);
    const standings = Array.from({ length: 9 }, (_, i) => mkUser(String.fromCharCode(65 + i), i + 1));
    const graph = computePaymentGraph(dist, standings);
    const s = settlementFor('I', dist, standings, graph); // rank 9 → pays 1st
    expect(s.kind).toBe('payer');
    if (s.kind !== 'payer') return;
    expect(s.counterparty.userId).toBe('A');
    expect(s.amount).toBe(50);
  });

  it('returns receiver with list of counterparties for the 1st place', () => {
    const dist = computeDistribution(9);
    const standings = Array.from({ length: 9 }, (_, i) => mkUser(String.fromCharCode(65 + i), i + 1));
    const graph = computePaymentGraph(dist, standings);
    const s = settlementFor('A', dist, standings, graph);
    expect(s.kind).toBe('receiver');
    if (s.kind !== 'receiver') return;
    expect(s.counterparties).toHaveLength(5);
    expect(s.amount).toBe(50);
  });
});

const mkUser = (id: string, rank: number) => ({ userId: id, name: id, rank });
