import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { computeFinalStandings } from '../../../lib/competition-completion';
import { computeDistribution, CAGNOTTE_STAKE } from '../../../lib/cagnotte-rounded';

type Row = {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  competitions: number;   // total completed comps the user participated in
  wins: number;           // 1st-place finishes
  seconds: number;
  thirds: number;
  netEur: number;         // sum of (prize_for_rank - entryFee) across all comps they played; non-podium = -entryFee
};

/**
 * Retroactive total earnings per player across every COMPLETED competition.
 *
 * Each past comp is treated as if it had used the canonical 50€ buy-in and the v2
 * rounded-€50 distribution (computeDistribution). For each participant in each comp:
 *   - 1st place: net = prize_first  - 50
 *   - 2nd place: net = (prize_second ?? 0) - 50
 *   - 3rd place: net = (prize_third  ?? 0) - 50
 *   - everyone else: net = -50
 * Sums are accumulated per user.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ rows: Row[] } | { error: string }>) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const comps = await prisma.competition.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true },
    });

    // Pull every non-admin user up front so we can attach profile pictures + names cleanly.
    const users = await prisma.user.findMany({
      where: { role: { not: 'admin' } },
      select: { id: true, name: true, profilePictureUrl: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const agg = new Map<string, Row>();
    const ensure = (userId: string): Row | null => {
      const u = userMap.get(userId);
      if (!u) return null;
      let row = agg.get(userId);
      if (!row) {
        row = {
          userId,
          userName: u.name,
          profilePictureUrl: u.profilePictureUrl ?? null,
          competitions: 0,
          wins: 0,
          seconds: 0,
          thirds: 0,
          netEur: 0,
        };
        agg.set(userId, row);
      }
      return row;
    };

    for (const c of comps) {
      const standings = await computeFinalStandings(c.id);
      if (standings.length === 0) continue;
      const dist = computeDistribution(standings.length);
      if (dist.type !== 'computed') continue;

      const prizes: [number, number | null, number | null] = [dist.first, dist.second, dist.third];

      standings.forEach((s, idx) => {
        const row = ensure(s.user.id);
        if (!row) return;
        row.competitions += 1;
        const podiumIdx = idx < 3 ? idx : -1;
        const prize = podiumIdx >= 0 ? prizes[podiumIdx] ?? 0 : 0;
        const net = prize - CAGNOTTE_STAKE;
        row.netEur += net;
        if (idx === 0) row.wins += 1;
        else if (idx === 1) row.seconds += 1;
        else if (idx === 2) row.thirds += 1;
      });
    }

    const rows = Array.from(agg.values())
      .filter(r => r.competitions > 0)
      .sort((a, b) => b.netEur - a.netEur || a.userName.localeCompare(b.userName));

    return res.status(200).json({ rows });
  } catch (e) {
    console.error('[/api/stats/total-earnings] error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
