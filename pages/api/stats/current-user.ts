import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

// Helper function to calculate streaks
function calculateStreaks(bets: any[]) {
  if (bets.length === 0) {
    return { longestStreak: 0, exactScoreStreak: 0 };
  }

  // Sort bets by game date to ensure chronological order
  const sortedBets = [...bets].sort((a, b) => new Date(a.game.date).getTime() - new Date(b.game.date).getTime());
  
  let longestStreak = 0;
  let currentStreak = 0;
  let exactScoreStreak = 0;
  let currentExactStreak = 0;

  for (const bet of sortedBets) {
    if (bet.points > 0) {
      // Points streak
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }

    if (bet.points === 3) {
      // Exact score streak
      currentExactStreak++;
      exactScoreStreak = Math.max(exactScoreStreak, currentExactStreak);
    } else {
      currentExactStreak = 0;
    }
  }

  return { longestStreak, exactScoreStreak };
}

// Define Bet interface for type safety
interface Bet {
  points: number;
  game: {
    status: string;
    date: Date | string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  bets: Bet[];
  stats?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get sportType filter from query parameter (optional: 'FOOTBALL', 'RUGBY', or 'ALL')
    const sportType = req.query.sportType as 'FOOTBALL' | 'RUGBY' | 'ALL' | undefined;

    // Get current user with their stats and bets
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        stats: true,
        bets: {
          include: {
            game: {
              include: {
                competition: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Helper function to filter bets by sport type
    const filterBetsBySport = (bets: any[]) => {
      if (!sportType || sportType === 'ALL') return bets;
      return bets.filter((bet: any) => bet.game.competition.sportType === sportType);
    };

    let calculatedStats;
    
    if (!user.stats) {
      // Only count bets from finished games for accurate averages
      const finishedGameBets = user.bets.filter((bet: Bet) => 
        bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
      );
      // Filter by sport type
      const filteredFinishedBets = filterBetsBySport(finishedGameBets);
      const totalBets = filteredFinishedBets.length;
      const totalPoints = filteredFinishedBets.reduce((sum: number, bet: Bet) => sum + bet.points, 0);
      // Calculate accuracy as percentage of correct predictions (1+ points) - only from finished games
      const correctPredictions = filteredFinishedBets.filter((bet: Bet) => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;
      
      // Calculate actual competition wins (consistent with leaderboard API) - only completed competitions
      // Filter by sport type if specified
      const competitions = await prisma.competition.findMany({
        where: { 
          winnerId: user.id,
          status: 'COMPLETED',
          ...(sportType && sportType !== 'ALL' ? { sportType } : {})
        }
      });
      const wins = competitions.length;
      
      // Calculate exact scores (3 points) - only from competitions starting August 2025 onwards
      const exactScores = filteredFinishedBets.filter((bet: Bet) => 
        bet.points === 3 && 
        new Date(bet.game.competition.startDate) >= new Date('2025-08-01')
      ).length;

      // Calculate correct outcomes (1 point) - only from competitions starting August 2025 onwards
      const correctOutcomes = filteredFinishedBets.filter((bet: Bet) => 
        bet.points === 1 && 
        new Date(bet.game.competition.startDate) >= new Date('2025-08-01')
      ).length;

      // Calculate streaks only from competitions starting August 2025 onwards
      const recentBets = filteredFinishedBets.filter((bet: Bet) => 
        new Date(bet.game.competition.startDate) >= new Date('2025-08-01')
      );
      const { longestStreak, exactScoreStreak } = calculateStreaks(recentBets);

      calculatedStats = {
        totalPredictions: totalBets,
        totalPoints,
        accuracy: Math.round(accuracy * 100) / 100,
        wins,
        longestStreak,
        exactScoreStreak,
        exactScores,
        correctOutcomes
      };
    } else {
      // For existing stats, recalculate competition wins and streaks
      // Filter by sport type if specified
      const competitions = await prisma.competition.findMany({
        where: { 
          winnerId: user.id,
          status: 'COMPLETED',
          ...(sportType && sportType !== 'ALL' ? { sportType } : {})
        }
      });
      const wins = competitions.length;
      
      // Fetch user's bets for streak and exact score calculations
      const userBets = await prisma.bet.findMany({
        where: { userId: user.id },
        include: {
          game: {
            include: {
              competition: true
            }
          }
        }
      });
      
      const finishedGameBets = userBets.filter((bet) => 
        bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
      );
      
      // Filter by sport type
      const filteredFinishedBets = filterBetsBySport(finishedGameBets);
      
      // Recalculate stats from filtered bets (don't use UserStats for sport-specific filtering)
      const totalBets = filteredFinishedBets.length;
      const totalPoints = filteredFinishedBets.reduce((sum: number, bet: Bet) => sum + bet.points, 0);
      const correctPredictions = filteredFinishedBets.filter((bet: Bet) => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;
      
      // Calculate exact scores (3 points) - only from competitions starting August 2025 onwards
      const exactScores = filteredFinishedBets.filter((bet: Bet) => 
        bet.points === 3 && 
        new Date(bet.game.competition.startDate) >= new Date('2025-08-01')
      ).length;

      // Calculate correct outcomes (1 point) - only from competitions starting August 2025 onwards
      const correctOutcomes = filteredFinishedBets.filter((bet: Bet) => 
        bet.points === 1 && 
        new Date(bet.game.competition.startDate) >= new Date('2025-08-01')
      ).length;

      // Calculate streaks only from competitions starting August 2025 onwards
      const recentBets = filteredFinishedBets.filter((bet: Bet) => 
        new Date(bet.game.competition.startDate) >= new Date('2025-08-01')
      );
      const { longestStreak, exactScoreStreak } = calculateStreaks(recentBets);
      
      calculatedStats = {
        totalPredictions: totalBets,
        totalPoints,
        accuracy: Math.round(accuracy * 100) / 100,
        wins,
        longestStreak,
        exactScoreStreak,
        exactScores,
        correctOutcomes
      };
    }

    // Get user's ranking among all non-admin users with predictions (consistent with leaderboard)
    const allUsers = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      include: {
        bets: {
          include: {
            game: {
              include: {
                competition: true
              }
            }
          }
        }
      }
    });

    const userRankings = allUsers
      .map((u) => {
        // Only count bets from finished games for ranking
        const finishedGameBets = u.bets.filter((bet: any) => {
          const statusMatch = bet.game.status === 'FINISHED' || bet.game.status === 'LIVE';
          const sportMatch = !sportType || sportType === 'ALL' || bet.game.competition.sportType === sportType;
          return statusMatch && sportMatch;
        });
        return {
          id: u.id,
          totalPoints: finishedGameBets.reduce((sum: number, bet: { points: number }) => sum + bet.points, 0),
          totalPredictions: finishedGameBets.length
        };
      })
      .filter(u => u.totalPredictions > 0) // Only include users with predictions
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const ranking = userRankings.findIndex((u) => u.id === user.id) + 1;
    // Calculate average points with 3 decimal precision (consistent with leaderboard widget)
    const averagePoints = calculatedStats.totalPredictions > 0 
      ? parseFloat((calculatedStats.totalPoints / calculatedStats.totalPredictions).toFixed(3))
      : 0;

    const currentUserStats = {
      totalPoints: calculatedStats.totalPoints,
      totalPredictions: calculatedStats.totalPredictions,
      accuracy: calculatedStats.accuracy,
      longestStreak: calculatedStats.longestStreak,
      exactScoreStreak: calculatedStats.exactScoreStreak,
      wins: calculatedStats.wins,
      ranking,
      averagePoints,
      exactScores: calculatedStats.exactScores,
      correctOutcomes: calculatedStats.correctOutcomes
    };

    res.status(200).json(currentUserStats);

  } catch (error) {
    console.error('Error fetching current user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 

