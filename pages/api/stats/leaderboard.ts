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

// Add interfaces for User, Bet, Competition
interface Bet {
  id: string;
  points: number;
  game: {
    status: string;
    date: Date;
    competition: Competition;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  stats?: any;
  bets: Bet[];
}

interface Competition {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  winner?: { id: string };
  logo?: string;
}

interface UserStats {
  totalPredictions: number;
  totalPoints: number;
  exactScores: number;
  correctOutcomes: number;
  noShows: number;
  forgottenBets: number;
  accuracy: number;
  wins: number;
  longestStreak: number;
  exactScoreStreak: number;
  longestStreakStart: Date | null;
  longestStreakEnd: Date | null;
  exactStreakStart: Date | null;
  exactStreakEnd: Date | null;
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

    // Get all competitions to identify real ones and their winners
    const competitions = await prisma.competition.findMany({
      include: {
        winner: true
      }
    });

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
            game: {
              include: {
                competition: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate stats for users who don't have UserStats records yet
    const usersWithCalculatedStats = await Promise.all(
      users.map(async (user: User) => {
        let stats = user.stats;
        
        // If no stats record exists, calculate from bets
        if (!stats) {
          // Only count bets from finished games for accurate averages
          const finishedGameBets = user.bets.filter((bet: any) => 
            bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
          );
          const totalBets = finishedGameBets.length;
          const totalPoints = finishedGameBets.reduce((sum: number, bet: any) => sum + bet.points, 0);
          // Calculate exact scores (3 points) - only from Champions League 25/26 onwards
          const exactScores = user.bets.filter((bet: any) => 
            bet.points === 3 && 
            bet.game.competition.name.includes('UEFA Champions League 25/26')
          ).length;

          // Calculate correct outcomes (1 point) - only from Champions League 25/26 onwards
          const correctOutcomes = user.bets.filter((bet: any) => 
            bet.points === 1 && 
            bet.game.competition.name.includes('UEFA Champions League 25/26')
          ).length;

          // Calculate no-shows - games where user didn't bet but should have
          const noShows = user.stats?.forgottenBets || 0;
          // Calculate accuracy as percentage of correct predictions (1+ points) - only from finished games
          const correctPredictions = finishedGameBets.filter((bet: any) => bet.points > 0).length;
          const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;
          
          // Calculate forgotten bets - games user should have bet on but didn't
          const userCompetitions = await prisma.competitionUser.findMany({
            where: { userId: user.id },
            include: {
              competition: {
                include: {
                  games: {
                    where: {
                      status: { in: ['FINISHED', 'LIVE'] } // Only count finished/live games
                    }
                  }
                }
              }
            }
          });
          
          let forgottenBets = 0;
          for (const userComp of userCompetitions) {
            const competitionGames = userComp.competition.games;
            const userBetsInCompetition = user.bets.filter((bet: any) => 
              competitionGames.some((game: any) => game.id === bet.gameId)
            );
            forgottenBets += competitionGames.length - userBetsInCompetition.length;
          }
          
          // Calculate actual competition wins (not games with points) - only completed competitions
          const competitionWins = competitions.filter((comp: any) => comp.winner?.id === user.id && comp.status === 'COMPLETED').length;
          
          // Calculate streaks only from Champions League 25/26 onwards
          const championsLeagueBets = finishedGameBets.filter((bet: any) => 
            bet.game.competition.name.includes('UEFA Champions League 25/26')
          );
          const { longestStreak, exactScoreStreak } = calculateStreaks(championsLeagueBets);
          
          const longestStreakStart: Date | null = null;
          const longestStreakEnd: Date | null = null;
          const exactStreakStart: Date | null = null;
          const exactStreakEnd: Date | null = null;
          
          stats = {
            totalPredictions: totalBets,
            totalPoints,
            exactScores,
            correctOutcomes,
            noShows,
            forgottenBets,
            accuracy: Math.round(accuracy * 100) / 100,
            wins: competitionWins, // Fixed: actual competition wins, not games with points
            longestStreak,
            exactScoreStreak,
            longestStreakStart,
            longestStreakEnd,
            exactStreakStart,
            exactStreakEnd
          };
        } else {
          // For existing stats, recalculate competition wins and reset streaks to 0
          const competitionWins = competitions.filter((comp: any) => comp.winner?.id === user.id && comp.status === 'COMPLETED').length;
          
          // Calculate exact scores (3 points) from bets - only from Champions League 25/26 onwards
          const exactScores = user.bets.filter((bet: any) => 
            bet.points === 3 && 
            bet.game.competition.name.includes('UEFA Champions League 25/26')
          ).length;

          // Calculate correct outcomes (1 point) from bets - only from Champions League 25/26 onwards
          const correctOutcomes = user.bets.filter((bet: any) => 
            bet.points === 1 && 
            bet.game.competition.name.includes('UEFA Champions League 25/26')
          ).length;

          // Calculate no-shows - games where user didn't bet but should have
          const noShows = user.stats?.forgottenBets || 0;
          
          // Calculate forgotten bets - games user should have bet on but didn't
          const userCompetitions = await prisma.competitionUser.findMany({
            where: { userId: user.id },
            include: {
              competition: {
                include: {
                  games: {
                    where: {
                      status: { in: ['FINISHED', 'LIVE'] } // Only count finished/live games
                    }
                  }
                }
              }
            }
          });
          
          let forgottenBets = 0;
          for (const userComp of userCompetitions) {
            const competitionGames = userComp.competition.games;
            const userBetsInCompetition = user.bets.filter((bet: any) => 
              competitionGames.some((game: any) => game.id === bet.gameId)
            );
            forgottenBets += competitionGames.length - userBetsInCompetition.length;
          }
          
          // Calculate streaks only from Champions League 25/26 onwards
          const finishedGameBets = user.bets.filter((bet: any) => 
            bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
          );
          const championsLeagueBets = finishedGameBets.filter((bet: any) => 
            bet.game.competition.name.includes('UEFA Champions League 25/26')
          );
          const { longestStreak, exactScoreStreak } = calculateStreaks(championsLeagueBets);
          
          const longestStreakStart: Date | null = null;
          const longestStreakEnd: Date | null = null;
          const exactStreakStart: Date | null = null;
          const exactStreakEnd: Date | null = null;

          stats = {
            ...stats,
            exactScores,
            correctOutcomes,
            noShows,
            forgottenBets,
            wins: competitionWins, // Fixed: actual competition wins
            longestStreak,
            exactScoreStreak,
            longestStreakStart,
            longestStreakEnd,
            exactStreakStart,
            exactStreakEnd
          };
        }

        // Generate avatar initials
        const nameParts = user.name.split(' ');
        const avatar = nameParts.length > 1 
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
          : user.name.substring(0, 2).toUpperCase();

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar,
          stats,
          createdAt: user.createdAt
        };
      })
    );

    // Sort by total points for leaderboard
    const topPlayersByPoints = usersWithCalculatedStats
      .filter(user => user.stats.totalPredictions > 0)
      .sort((a, b) => b.stats.totalPoints - a.stats.totalPoints)
      .slice(0, 10);

    // Sort by average points (minimum 5 games)
    const topPlayersByAverage = usersWithCalculatedStats
      .filter(user => user.stats.totalPredictions >= 5)
      .map(user => ({
        ...user,
        averagePoints: user.stats.totalPredictions > 0 
          ? parseFloat((user.stats.totalPoints / user.stats.totalPredictions).toFixed(3))
          : 0
      }))
      .sort((a, b) => b.averagePoints - a.averagePoints)
      .slice(0, 10);

    // Get total user count (excluding admins)
    const totalUsers = usersWithCalculatedStats.length;

    // Add competitions data for Palmarès section with winner's points
    const competitionsData = await Promise.all(
      competitions.map(async (comp: any) => {
        let winnerPoints = 0;
        
        if (comp.winner) {
          // Get winner's bets for this specific competition
          const winnerBets = await prisma.bet.findMany({
            where: {
              userId: comp.winner.id,
              game: {
                competitionId: comp.id
              }
            }
          });
          
          winnerPoints = winnerBets.reduce((sum: number, bet: any) => sum + bet.points, 0);
        }
        
        // Get the actual number of participants for this competition
        const participantCount = await prisma.competitionUser.count({
          where: {
            competitionId: comp.id
          }
        });
        
        // Get the total number of games for this competition
        const gameCount = await prisma.game.count({
          where: {
            competitionId: comp.id
          }
        });
        
        return {
          id: comp.id,
          name: comp.name,
          startDate: comp.startDate,
          endDate: comp.endDate,
          status: comp.status,
          winner: comp.winner,
          winnerPoints,
          participantCount,
          gameCount,
          logo: comp.logo
        };
      })
    );

    // Sort competitions by start date - most recent first (newest at top, oldest at bottom)
    const sortedCompetitions = competitionsData.sort((a, b) => {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    res.status(200).json({
      topPlayersByPoints,
      topPlayersByAverage,
      totalUsers,
      competitions: sortedCompetitions
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 