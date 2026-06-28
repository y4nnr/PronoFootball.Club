import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';
import { computeFinalStandings } from '../../../lib/competition-completion';
import { computeDistribution } from '../../../lib/cagnotte-rounded';

type CareerEntry = {
  competitionId: string;
  competitionName: string;
  competitionLogo: string | null;
  sportType: string;
  startDate: string;
  endDate: string;
  status: string;
  position: number;
  totalPoints: number;
  exactScores: number;
  shooters: number;
  totalPredictions: number;
  participantCount: number;
  entryFee: number;
  prize: number; // 0 if non-podium or non-money comp; in € otherwise
  net: number;
  isPodium: boolean;
};

type Distinction = {
  category: string;
  label: string;
  value: string;
  rank: number;
};

type Profile = {
  user: { id: string; name: string; profilePictureUrl: string | null; createdAt: string };
  career: CareerEntry[];
  palmares: {
    wins: number; seconds: number; thirds: number;
    competitionsPlayed: number;
    totalPoints: number; totalPredictions: number;
    exactScores: number; shooters: number;
  };
  financial: { totalEarned: number; totalSpent: number; netEur: number; moneyComps: number };
  distinctions: Distinction[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Profile | { error: string }>) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const playerId = req.query.id;
  if (typeof playerId !== 'string') return res.status(400).json({ error: 'Invalid id' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: playerId },
      select: { id: true, name: true, profilePictureUrl: true, role: true, createdAt: true },
    });
    if (!user || user.role === 'admin') {
      return res.status(404).json({ error: 'Player not found' });
    }

    // All competitions this user is/was a member of
    const memberships = await prisma.competitionUser.findMany({
      where: { userId: playerId },
      include: {
        competition: {
          select: { id: true, name: true, logo: true, sportType: true, status: true, startDate: true, endDate: true, entryFee: true },
        },
      },
    });

    const career: CareerEntry[] = [];
    let wins = 0, seconds = 0, thirds = 0;
    let totalEarned = 0, totalSpent = 0;
    let moneyComps = 0;
    let totalPoints = 0, totalPredictions = 0, exactScores = 0, shootersTotal = 0;

    for (const m of memberships) {
      const c = m.competition;
      const standings = await computeFinalStandings(c.id);
      const own = standings.find(s => s.user.id === playerId);
      if (!own) continue;
      const N = standings.length;
      const dist = computeDistribution(N);
      const isMoney = c.entryFee > 0 && c.status === 'COMPLETED' && dist.type === 'computed';
      let prize = 0;
      if (isMoney && dist.type === 'computed') {
        if (own.position === 1) prize = dist.first;
        else if (own.position === 2) prize = dist.second ?? 0;
        else if (own.position === 3) prize = dist.third ?? 0;
      }
      const stake = isMoney ? c.entryFee : 0;

      // Per-comp basic stats lifted from standings (already aggregated by lib/classement).
      const bets = await prisma.bet.count({
        where: { userId: playerId, game: { competitionId: c.id, status: 'FINISHED' } },
      });
      career.push({
        competitionId: c.id,
        competitionName: c.name,
        competitionLogo: c.logo,
        sportType: String(c.sportType),
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
        status: c.status,
        position: own.position,
        totalPoints: own.totalPoints,
        exactScores: own.exactScores,
        shooters: own.shooters,
        totalPredictions: bets,
        participantCount: N,
        entryFee: c.entryFee,
        prize,
        net: prize - stake,
        isPodium: own.position <= 3,
      });

      if (c.status === 'COMPLETED') {
        if (own.position === 1) wins++;
        else if (own.position === 2) seconds++;
        else if (own.position === 3) thirds++;
      }
      if (isMoney) {
        moneyComps++;
        totalSpent += stake;
        totalEarned += prize;
      }
      totalPoints += own.totalPoints;
      totalPredictions += bets;
      exactScores += own.exactScores;
      shootersTotal += own.shooters;
    }

    career.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const palmares = {
      wins, seconds, thirds,
      competitionsPlayed: career.length,
      totalPoints, totalPredictions, exactScores, shooters: shootersTotal,
    };
    const financial = { totalEarned, totalSpent, netEur: totalEarned - totalSpent, moneyComps };

    // Distinctions — categories where this player is in the top 3 globally.
    const distinctions: Distinction[] = [];
    const allUsers = await prisma.user.findMany({
      where: { role: { not: 'admin' } },
      select: { id: true, name: true, stats: true },
    });
    const rankInList = <T>(list: Array<{ userId: string; value: number }>, userId: string): number | null => {
      const sorted = [...list].sort((a, b) => b.value - a.value);
      const idx = sorted.findIndex(x => x.userId === userId);
      return idx >= 0 ? idx + 1 : null;
    };
    const totalPointsList = allUsers.map(u => ({ userId: u.id, value: u.stats?.totalPoints ?? 0 }));
    const winsList = allUsers.map(u => ({ userId: u.id, value: u.stats?.wins ?? 0 }));
    const streakList = allUsers.map(u => ({ userId: u.id, value: u.stats?.longestStreak ?? 0 }));
    const accuracyList = allUsers.map(u => ({ userId: u.id, value: u.stats?.accuracy ?? 0 }));

    const candidates: Array<{ category: string; label: string; list: typeof totalPointsList; value: number }> = [
      { category: 'totalPoints', label: 'Total points',  list: totalPointsList, value: totalPointsList.find(x => x.userId === playerId)?.value ?? 0 },
      { category: 'wins',        label: 'Victoires',      list: winsList,        value: winsList.find(x => x.userId === playerId)?.value ?? 0 },
      { category: 'longestStreak', label: 'Plus longue série', list: streakList, value: streakList.find(x => x.userId === playerId)?.value ?? 0 },
      { category: 'accuracy',    label: 'Précision',      list: accuracyList,    value: accuracyList.find(x => x.userId === playerId)?.value ?? 0 },
    ];
    for (const c of candidates) {
      const r = rankInList(c.list, playerId);
      if (r !== null && r <= 3 && c.value > 0) {
        distinctions.push({
          category: c.category,
          label: c.label,
          value: c.category === 'accuracy' ? `${(c.value * 100).toFixed(1)}%` : String(c.value),
          rank: r,
        });
      }
    }

    // Compare against /api/stats financial ranking — only count among money comps
    // (since the rest of the app shows that ranking).
    distinctions.sort((a, b) => a.rank - b.rank);

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        profilePictureUrl: user.profilePictureUrl ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      career,
      palmares,
      financial,
      distinctions,
    });
  } catch (e) {
    console.error('[/api/players/[id]] error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
