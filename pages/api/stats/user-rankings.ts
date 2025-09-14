import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all non-admin users with their stats and bets
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      include: {
        stats: true,
        bets: {
          include: {
            game: true
          }
        }
      }
    });

    // Calculate stats for each user
    const usersWithStats = users.map(user => {
      let stats = user.stats;
      
      if (!stats) {
        // Only count bets from finished games for accurate averages
        const finishedGameBets = user.bets.filter((bet: any) => 
          bet.game && (bet.game.status === 'FINISHED' || bet.game.status === 'LIVE')
        );
        const totalBets = finishedGameBets.length;
        const totalPoints = finishedGameBets.reduce((sum: number, bet: any) => sum + bet.points, 0);
        // Calculate accuracy as percentage of correct predictions (1+ points) - only from finished games
        const correctPredictions = finishedGameBets.filter((bet: any) => bet.points > 0).length;
        const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;
        
        stats = {
          id: user.id,
          updatedAt: new Date(),
          userId: user.id,
          totalPredictions: totalBets,
          totalPoints,
          accuracy: Math.round(accuracy * 100) / 100,
          wins: 0,
          longestStreak: 0,
          exactScoreStreak: 0
        };
      }

      const averagePoints = stats && stats.totalPredictions > 0 
        ? parseFloat((stats.totalPoints / stats.totalPredictions).toFixed(3))
        : 0;

      return {
        id: user.id,
        name: user.name,
        totalPoints: stats?.totalPoints || 0,
        totalPredictions: stats?.totalPredictions || 0,
        averagePoints,
        accuracy: stats?.accuracy || 0,
        wins: stats?.wins || 0,
        longestStreak: stats?.longestStreak || 0,
        exactScoreStreak: stats?.exactScoreStreak || 0
      };
    });

    // Sort by different criteria to get rankings
    const pointsRanking = [...usersWithStats]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((user, index) => ({ ...user, pointsRank: index + 1 }));

    const averageRanking = [...usersWithStats]
      .filter(user => user.totalPredictions >= 5) // Minimum 5 games for average ranking
      .sort((a, b) => b.averagePoints - a.averagePoints)
      .map((user, index) => ({ ...user, averageRank: index + 1 }));

    const predictionsRanking = [...usersWithStats]
      .sort((a, b) => b.totalPredictions - a.totalPredictions)
      .map((user, index) => ({ ...user, predictionsRank: index + 1 }));

    const winsRanking = [...usersWithStats]
      .sort((a, b) => b.wins - a.wins)
      .map((user, index) => ({ ...user, winsRank: index + 1 }));

    const longestStreakRanking = [...usersWithStats]
      .sort((a, b) => b.longestStreak - a.longestStreak)
      .map((user, index) => ({ ...user, longestStreakRank: index + 1 }));

    const exactScoreStreakRanking = [...usersWithStats]
      .sort((a, b) => b.exactScoreStreak - a.exactScoreStreak)
      .map((user, index) => ({ ...user, exactScoreStreakRank: index + 1 }));

    // Find current user's rankings
    const currentUserId = session.user.id;
    
    const currentUserPointsRank = pointsRanking.find(user => user.id === currentUserId)?.pointsRank || 0;
    const currentUserAverageRank = averageRanking.find(user => user.id === currentUserId)?.averageRank || 0;
    const currentUserPredictionsRank = predictionsRanking.find(user => user.id === currentUserId)?.predictionsRank || 0;
    const currentUserWinsRank = winsRanking.find(user => user.id === currentUserId)?.winsRank || 0;
    const currentUserLongestStreakRank = longestStreakRanking.find(user => user.id === currentUserId)?.longestStreakRank || 0;
    const currentUserExactScoreStreakRank = exactScoreStreakRanking.find(user => user.id === currentUserId)?.exactScoreStreakRank || 0;

    res.status(200).json({
      pointsRank: currentUserPointsRank,
      averageRank: currentUserAverageRank,
      predictionsRank: currentUserPredictionsRank,
      winsRank: currentUserWinsRank,
      longestStreakRank: currentUserLongestStreakRank,
      exactScoreStreakRank: currentUserExactScoreStreakRank,
      totalUsers: usersWithStats.length
    });

  } catch (error) {
    console.error('Error fetching user rankings:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
