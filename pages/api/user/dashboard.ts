import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

interface UserStats {
  totalPredictions: number;
  totalPoints: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  rank: number;
  totalUsers: number;
  averagePoints: number;
  competitionsWon: number;
}

interface LastGamePerformance {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  actualScore: string;
  predictedScore: string;
  points: number;
  result: 'exact' | 'correct' | 'wrong';
  runningTotal: number;
}

interface Competition {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: string;
  logo?: string | null;
  userRanking?: number;
  totalParticipants?: number;
  userPoints?: number;
  remainingGames?: number;
}

interface DashboardData {
  stats: UserStats;
  activeCompetitions: Competition[];
  availableCompetitions: Competition[];
  lastGamesPerformance: LastGamePerformance[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardData | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get user with all bets for live calculation
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
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
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Calculate stats from actual bets (live calculation like stats page)
    // Only count bets from finished games for accurate averages
    const finishedGameBets = user.bets.filter((bet: any) => 
      bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
    );
    const totalBets = finishedGameBets.length;
    const totalPoints = finishedGameBets.reduce((sum, bet) => sum + bet.points, 0);
    // Calculate accuracy as percentage of correct predictions (1+ points) - only from finished games
    const correctPredictions = finishedGameBets.filter((bet: any) => bet.points > 0).length;
    const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;
    
    // Calculate actual competition wins - only completed competitions
    const competitions = await prisma.competition.findMany({
      where: { 
        winnerId: user.id,
        status: 'COMPLETED'
      }
    });
    const competitionsWon = competitions.length;

    // Get user's all-time ranking among all users
    const allUsers = await prisma.user.findMany({
      include: {
        bets: {
          include: {
            game: true
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
          totalPoints: finishedGameBets.reduce((sum, bet) => sum + bet.points, 0)
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const userRank = userRankings.findIndex((u) => u.id === user.id) + 1;

    // Calculate average points per game
    const averagePointsPerGame = totalBets > 0 
      ? parseFloat((totalPoints / totalBets).toFixed(3))
      : 0;

    // Calculate current streak only from Champions League 25/26 onwards
    const cl25_26Bets = finishedGameBets.filter((bet: any) => 
      bet.game.competition.name.includes('UEFA Champions League 25/26')
    );
    
    // Calculate current streak from CL 25/26 onwards
    let currentStreak = 0;
    let bestStreak = 0;
    const sortedClBets = cl25_26Bets.sort((a: any, b: any) => 
      new Date(a.game.date).getTime() - new Date(b.game.date).getTime()
    );
    
    for (const bet of sortedClBets) {
      if (bet.points > 0) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const stats: UserStats = {
      totalPredictions: totalBets,
      totalPoints: totalPoints,
      accuracy: Math.round(accuracy * 100) / 100,
      currentStreak: currentStreak,
      bestStreak: bestStreak,
      rank: userRank,
      totalUsers: allUsers.length,
      averagePoints: averagePointsPerGame,
      competitionsWon: competitionsWon,
    };

    // Get last 10 games performance - Re-enable now that we have real betting
    // Use a past date to include all user bets 
    const cutoffDate = new Date('2020-01-01'); // Include all user bets from 2020 onwards
    console.log('Dashboard API - Cutoff date:', cutoffDate);
    
    const lastGamesPerformance = await prisma.bet.findMany({
      where: {
        userId: user.id,
        game: {
          status: 'FINISHED'
        },
        // Only include bets created after the cutoff date (real user bets only)
        createdAt: { gte: cutoffDate }
      },
      include: {
        game: {
          include: {
            homeTeam: {
              select: {
                name: true,
                logo: true
              }
            },
            awayTeam: {
              select: {
                name: true,
                logo: true
              }
            },
            competition: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        game: {
          date: 'desc'
        }
      },
      take: 10
    });

    console.log('Dashboard API - Found games:', lastGamesPerformance.length);
    console.log('Dashboard API - Games data:', lastGamesPerformance.map(bet => ({
      gameId: bet.game.id,
      createdAt: bet.createdAt,
      points: bet.points
    })));

    // Process games and calculate running totals
    const gamesForRunningTotal = lastGamesPerformance.map(bet => {
      const game = bet.game;
      const actualScore = `${game.homeScore}-${game.awayScore}`;
      const predictedScore = `${bet.score1}-${bet.score2}`;
      
      let result: 'exact' | 'correct' | 'wrong' = 'wrong';
      let gamePoints = 0;
      
      if (bet.score1 === game.homeScore && bet.score2 === game.awayScore) {
        result = 'exact';
        gamePoints = 3;
      } else if (
        game.homeScore !== null && game.awayScore !== null && (
          (bet.score1 > bet.score2 && game.homeScore > game.awayScore) ||
          (bet.score1 < bet.score2 && game.homeScore < game.awayScore) ||
          (bet.score1 === bet.score2 && game.homeScore === game.awayScore)
        )
      ) {
        result = 'correct';
        gamePoints = 1;
      }
      
      return {
        gameId: game.id,
        date: game.date.toISOString(),
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        homeTeamLogo: game.homeTeam.logo,
        awayTeamLogo: game.awayTeam.logo,
        competition: game.competition.name,
        actualScore,
        predictedScore,
        points: gamePoints,
        result,
        runningTotal: 0,
      };
    }).reverse(); // Reverse to calculate running total from oldest to newest

    // Calculate running totals from oldest to newest
    gamesForRunningTotal.forEach((game, index) => {
      if (index === 0) {
        game.runningTotal = game.points;
      } else {
        game.runningTotal = gamesForRunningTotal[index - 1].runningTotal + game.points;
      }
    });

    // Reverse back to show newest first and remove the temporary gameDate field
    const formattedLastGames: LastGamePerformance[] = gamesForRunningTotal
      .reverse()
      .map(({ ...game }) => game);

    // Get all active/upcoming competitions
    const allActiveCompetitions = await prisma.competition.findMany({
      where: {
        OR: [
          { status: 'ACTIVE' },
          { status: 'active' },
          { status: 'UPCOMING' },
        ],
      },
      include: {
        users: {
          include: {
            user: {
              include: {
                bets: {
                  where: {
                    game: {
                      competitionId: { in: [] } // We'll fix this below
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // Get user's competition participation via CompetitionUser table
    const userCompetitions = await prisma.competitionUser.findMany({
      where: { userId: user.id },
      select: { competitionId: true }
    });
    const userCompetitionIds = userCompetitions.map(cu => cu.competitionId);
    

    // Separate competitions into active (user participating) and available (user can join)
    const activeCompetitions = allActiveCompetitions.filter(comp => 
      userCompetitionIds.includes(comp.id)
    );
    const availableCompetitions = allActiveCompetitions.filter(comp => 
      !userCompetitionIds.includes(comp.id)
    );
    

    const processCompetitions = async (competitions: any[]) => {
      return Promise.all(
        competitions.map(async (competition) => {
          // Get all users in this competition with their bets for this specific competition
          const competitionUsersWithBets = await Promise.all(
            competition.users.map(async (cu) => {
              const userBetsForCompetition = await prisma.bet.findMany({
                where: {
                  userId: cu.user.id,
                  game: {
                    competitionId: competition.id
                  }
                }
              });
              
              const competitionPoints = userBetsForCompetition.reduce((sum, bet) => sum + bet.points, 0);
              
              return {
                ...cu.user,
                competitionPoints
              };
            })
          );
          
          // Calculate user's ranking in this competition (only for active competitions)
          const userInCompetition = competitionUsersWithBets.find(u => u.id === user.id);
          let userRanking: number | undefined;
          let userPoints: number | undefined;
          
          if (userInCompetition) {
            const sortedUsers = competitionUsersWithBets.sort((a, b) => 
              b.competitionPoints - a.competitionPoints
            );
            userRanking = sortedUsers.findIndex(u => u.id === user.id) + 1;
            userPoints = userInCompetition.competitionPoints;
          }

          // Calculate remaining games in this competition
          const remainingGames = await prisma.game.count({
            where: {
              competitionId: competition.id,
              status: 'UPCOMING'
            }
          });

          return {
            id: competition.id,
            name: competition.name,
            description: competition.description,
            startDate: competition.startDate.toISOString(),
            endDate: competition.endDate.toISOString(),
            status: competition.status,
            logo: competition.logo,
            userRanking,
            totalParticipants: competition.users.length,
            userPoints,
            remainingGames,
          };
        })
      );
    };

    const [activeCompetitionsWithRanking, availableCompetitionsWithRanking] = await Promise.all([
      processCompetitions(activeCompetitions),
      processCompetitions(availableCompetitions)
    ]);

    return res.status(200).json({
      stats,
      activeCompetitions: activeCompetitionsWithRanking,
      availableCompetitions: availableCompetitionsWithRanking,
      lastGamesPerformance: formattedLastGames,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
} 