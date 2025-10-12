import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

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

    // Verify user is part of this competition
    const competitionUser = await prisma.competitionUser.findFirst({
      where: {
        competitionId,
        userId: session.user.id,
      },
    });

    if (!competitionUser) {
      return res.status(403).json({ error: 'Not part of this competition' });
    }

    // Get all finished games for this competition, ordered by date
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        status: true,
      },
    });

    if (finishedGames.length === 0) {
      return res.json({ rankingEvolution: [] });
    }

    // Get all competition users (minimal data)
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    // Create a map for quick user lookup to avoid repeated database queries
    const userMap = new Map();
    competitionUsers.forEach(cu => {
      userMap.set(cu.userId, {
        name: cu.user.name,
        profilePictureUrl: cu.user.profilePictureUrl
      });
    });

    const userIds = competitionUsers.map(cu => cu.userId);

    // Group games by date (matchday) - only unique dates
    const gamesByDate = new Map<string, typeof finishedGames>();
    finishedGames.forEach(game => {
      const dateKey = game.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!gamesByDate.has(dateKey)) {
        gamesByDate.set(dateKey, []);
      }
      gamesByDate.get(dateKey)!.push(game);
    });

    // Calculate rankings for each unique matchday (limit to last 20 matchdays for performance)
    const rankingEvolution: RankingDataPoint[] = [];
    const sortedDates = Array.from(gamesByDate.keys()).sort();
    const limitedDates = sortedDates.slice(-20); // Only last 20 matchdays

    for (const dateKey of limitedDates) {
      const gamesOnDate = gamesByDate.get(dateKey)!;
      // Use the latest game on this date as the reference point
      const latestGameOnDate = gamesOnDate[gamesOnDate.length - 1];
      
      // Get all bets up to this date (inclusive) - optimized query
      const betsUpToDate = await prisma.bet.findMany({
        where: {
          game: {
            competitionId,
            date: { lte: latestGameOnDate.date },
            status: { in: ['FINISHED', 'LIVE'] },
          },
          userId: { in: userIds },
        },
        select: {
          userId: true,
          points: true,
        },
        // Add index hint for better performance
        orderBy: { userId: 'asc' },
      });

      // Calculate total points for each user up to this date
      const userPoints = new Map<string, number>();
      userIds.forEach(userId => userPoints.set(userId, 0));
      
      betsUpToDate.forEach(bet => {
        const currentPoints = userPoints.get(bet.userId) || 0;
        userPoints.set(bet.userId, currentPoints + (bet.points || 0));
      });

      // Create ranking data (optimized)
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
        .sort((a, b) => b.totalPoints - a.totalPoints) // Sort by points descending
        .map((user, index) => ({
          ...user,
          position: index + 1,
        }));

      rankingEvolution.push({
        date: latestGameOnDate.date.toISOString(),
        rankings,
      });
    }

    res.json({ rankingEvolution });

  } catch (error) {
    console.error('Error fetching ranking evolution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
