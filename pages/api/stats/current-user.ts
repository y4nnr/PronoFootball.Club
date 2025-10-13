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

    let calculatedStats;
    
    if (!user.stats) {
      // Only count bets from finished games for accurate averages
      const finishedGameBets = user.bets.filter((bet: Bet) => 
        bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
      );
      const totalBets = finishedGameBets.length;
      const totalPoints = finishedGameBets.reduce((sum: number, bet: Bet) => sum + bet.points, 0);
      // Calculate accuracy as percentage of correct predictions (1+ points) - only from finished games
      const correctPredictions = finishedGameBets.filter((bet: Bet) => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;
      
      // Calculate actual competition wins (consistent with leaderboard API) - only completed competitions
      const competitions = await prisma.competition.findMany({
        where: { 
          winnerId: user.id,
          status: 'COMPLETED'
        }
      });
      const wins = competitions.length;
      
      // Calculate exact scores (3 points) - only from Champions League 25/26 onwards
      const exactScores = finishedGameBets.filter((bet: Bet) => 
        bet.points === 3 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;

      // Calculate correct outcomes (1 point) - only from Champions League 25/26 onwards
      const correctOutcomes = finishedGameBets.filter((bet: Bet) => 
        bet.points === 1 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;

      // Calculate streaks only from Champions League 25/26 onwards
      const championsLeagueBets = finishedGameBets.filter((bet: Bet) => 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      );
      const { longestStreak, exactScoreStreak } = calculateStreaks(championsLeagueBets);

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
      const competitions = await prisma.competition.findMany({
        where: { 
          winnerId: user.id,
          status: 'COMPLETED'
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
      
      // Calculate exact scores (3 points) - only from Champions League 25/26 onwards
      const exactScores = finishedGameBets.filter((bet: Bet) => 
        bet.points === 3 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;

      // Calculate correct outcomes (1 point) - only from Champions League 25/26 onwards
      const correctOutcomes = finishedGameBets.filter((bet: Bet) => 
        bet.points === 1 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;

      // Calculate streaks only from Champions League 25/26 onwards
      const championsLeagueBets = finishedGameBets.filter((bet: Bet) => 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      );
      const { longestStreak, exactScoreStreak } = calculateStreaks(championsLeagueBets);
      
      calculatedStats = {
        totalPredictions: user.stats.totalPredictions,
        totalPoints: user.stats.totalPoints,
        accuracy: user.stats.accuracy,
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
        const finishedGameBets = u.bets.filter((bet: any) => 
          bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
        );
        return {
          id: u.id,
          totalPoints: finishedGameBets.reduce((sum: number, bet: { points: number }) => sum + bet.points, 0),
          totalPredictions: finishedGameBets.length
        };
      })
      .filter(u => u.totalPredictions > 0) // Only include users with predictions
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const ranking = userRankings.findIndex((u) => u.id === user.id) + 1;
    const averagePoints = calculatedStats.totalPredictions > 0 
      ? parseFloat((calculatedStats.totalPoints / calculatedStats.totalPredictions).toFixed(2))
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

