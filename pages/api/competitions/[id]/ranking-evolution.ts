import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

interface RankingDataPoint {
  date: string;
  rankings: {
    userId: string;
    userName: string;
    profilePictureUrl: string | null;
    position: number;
    totalPoints: number;
  }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: competitionId } = req.query;
    if (!competitionId || typeof competitionId !== 'string') {
      return res.status(400).json({ error: 'Invalid competition ID' });
    }

    // Get all finished/live games for this competition, ordered by date.
    // Exclude placeholder-team games (consistent with classement, shooters, leaderboard).
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] },
        AND: [
          { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
          { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
        ],
      },
      orderBy: { date: 'asc' },
      select: { id: true, date: true },
    });

    if (finishedGames.length === 0) {
      return res.json({ rankingEvolution: [] });
    }

    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: {
        user: { select: { id: true, name: true, profilePictureUrl: true } },
      },
    });

    const userMap = new Map(
      competitionUsers.map(cu => [
        cu.userId,
        { name: cu.user.name, profilePictureUrl: cu.user.profilePictureUrl },
      ])
    );
    const userIds = Array.from(userMap.keys());

    // Single query for all relevant bets, then aggregate in memory.
    const allBets = await prisma.bet.findMany({
      where: {
        userId: { in: userIds },
        gameId: { in: finishedGames.map(g => g.id) },
      },
      select: { userId: true, gameId: true, points: true },
    });

    // Group bets by gameId for quick lookup.
    const betsByGame = new Map<string, { userId: string; points: number }[]>();
    allBets.forEach(bet => {
      const list = betsByGame.get(bet.gameId);
      if (list) {
        list.push({ userId: bet.userId, points: bet.points || 0 });
      } else {
        betsByGame.set(bet.gameId, [{ userId: bet.userId, points: bet.points || 0 }]);
      }
    });

    // Group games by calendar date (the "matchday" unit the chart shows).
    const gamesByDate = new Map<string, typeof finishedGames>();
    finishedGames.forEach(game => {
      const dateKey = game.date.toISOString().split('T')[0];
      const list = gamesByDate.get(dateKey);
      if (list) {
        list.push(game);
      } else {
        gamesByDate.set(dateKey, [game]);
      }
    });

    // Walk dates in chronological order, accumulating points per user.
    const sortedDates = Array.from(gamesByDate.keys()).sort();
    const userPoints = new Map<string, number>();
    userIds.forEach(userId => userPoints.set(userId, 0));

    const rankingEvolution: RankingDataPoint[] = [];

    for (const dateKey of sortedDates) {
      const gamesOnDate = gamesByDate.get(dateKey)!;
      const latestGameOnDate = gamesOnDate[gamesOnDate.length - 1];

      // Add points from every game on this date to the running total.
      gamesOnDate.forEach(game => {
        const bets = betsByGame.get(game.id);
        if (!bets) return;
        bets.forEach(bet => {
          userPoints.set(bet.userId, (userPoints.get(bet.userId) || 0) + bet.points);
        });
      });

      const rankings = Array.from(userPoints.entries())
        .map(([userId, totalPoints]) => {
          const userData = userMap.get(userId);
          return {
            userId,
            userName: userData?.name || 'Unknown',
            profilePictureUrl: userData?.profilePictureUrl || null,
            totalPoints,
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints || a.userName.localeCompare(b.userName))
        .map((user, index) => ({ ...user, position: index + 1 }));

      rankingEvolution.push({
        date: latestGameOnDate.date.toISOString(),
        rankings,
      });
    }

    // Private: response is gated by session auth; must not be cached by shared proxies.
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');

    res.json({ rankingEvolution });
  } catch (error) {
    console.error('Error fetching ranking evolution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
