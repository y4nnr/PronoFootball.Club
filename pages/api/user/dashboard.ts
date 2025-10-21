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
  result: 'exact' | 'correct' | 'wrong' | 'no_bet';
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
  totalGames?: number;
  gamesPlayed?: number;
  progressPercentage?: number;
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

    // Heavy global ranking computation removed to speed up dashboard.
    // If needed later, compute asynchronously in a background job.
    const totalUsers = await prisma.user.count();
    const userRank = 0; // not computed here for performance

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
      totalUsers: totalUsers,
      averagePoints: averagePointsPerGame,
      competitionsWon: competitionsWon,
    };

    // Get last 10 games performance - Only from Champions League 25/26 and future competitions
    // First, find the Champions League 25/26 competition where user is participating
    const recentCompetition = await prisma.competition.findFirst({
      where: {
        OR: [
          { name: { contains: 'UEFA Champions League 25/26' } },
          { name: { contains: 'Champions League 25/26' } }
        ],
        status: {
          in: ['ACTIVE', 'COMPLETED']
        },
        games: {
          some: {
            status: 'FINISHED'
          }
        },
        users: {
          some: {
            userId: user.id
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    let formattedLastGames: LastGamePerformance[] = [];

    if (recentCompetition) {
      // Fetch ALL finished games from the Champions League 25/26
      const finishedGames = await prisma.game.findMany({
        where: {
          competitionId: recentCompetition.id,
          status: 'FINISHED'
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
          bets: {
            where: {
              userId: user.id
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
        // Removed take: 10 to get ALL finished games
      });

      // Process games and calculate running totals
      const gamesForRunningTotal = finishedGames.map(game => {
        const actualScore = `${game.homeScore}-${game.awayScore}`;
        const userBet = game.bets[0]; // Get the user's bet if it exists

        if (!userBet) {
          // No bet placed
          return {
            gameId: game.id,
            date: game.date.toISOString(),
            homeTeam: game.homeTeam.name,
            awayTeam: game.awayTeam.name,
            homeTeamLogo: game.homeTeam.logo,
            awayTeamLogo: game.awayTeam.logo,
            competition: game.competition.name,
            actualScore,
            predictedScore: 'N/A',
            points: 0,
            result: 'no_bet' as const,
            runningTotal: 0,
          };
        }

        // Bet was placed
        const predictedScore = `${userBet.score1}-${userBet.score2}`;
        let result: 'exact' | 'correct' | 'wrong' | 'no_bet' = 'wrong';
        let gamePoints = 0;
        
        if (userBet.score1 === game.homeScore && userBet.score2 === game.awayScore) {
          result = 'exact';
          gamePoints = 3;
        } else if (
          game.homeScore !== null && game.awayScore !== null && (
            (userBet.score1 > userBet.score2 && game.homeScore > game.awayScore) ||
            (userBet.score1 < userBet.score2 && game.homeScore < game.awayScore) ||
            (userBet.score1 === userBet.score2 && game.homeScore === game.awayScore)
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

      // Reverse back to show newest first
      formattedLastGames = gamesForRunningTotal
        .reverse()
        .map(({ ...game }) => game);
    }

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
            user: true
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
          // Aggregate points per user for this competition in a single query
          const pointsByUser = await prisma.bet.groupBy({
            by: ['userId'],
            where: {
              game: { competitionId: competition.id }
            },
            _sum: { points: true }
          });

          const pointsMap = new Map<string, number>(
            pointsByUser.map((row: any) => [row.userId, row._sum.points || 0])
          );

          // Determine current user's ranking and points
          const rankingArray = Array.from(pointsMap.entries())
            .map(([userId, pts]) => ({ userId, pts }))
            .sort((a, b) => b.pts - a.pts);

          const userPoints = pointsMap.get(user.id) ?? undefined;
          const userRanking = userPoints !== undefined
            ? (rankingArray.findIndex((r) => r.userId === user.id) + 1)
            : undefined;

          // Get total games and remaining games for this competition
          const [totalGames, remainingGames, finishedGames] = await Promise.all([
            prisma.game.count({
              where: { competitionId: competition.id }
            }),
            prisma.game.count({
              where: { competitionId: competition.id, status: 'UPCOMING' }
            }),
            prisma.game.count({
              where: { 
                competitionId: competition.id, 
                status: { in: ['FINISHED', 'LIVE'] }
              }
            })
          ]);

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
            totalGames,
            gamesPlayed: finishedGames,
            progressPercentage: totalGames > 0 ? Math.round((finishedGames / totalGames) * 100) : 0,
          };
        })
      );
    };

    const [activeCompetitionsWithRanking, availableCompetitionsWithRanking] = await Promise.all([
      processCompetitions(activeCompetitions),
      processCompetitions(availableCompetitions)
    ]);

    // Add caching headers to reduce database load
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    
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