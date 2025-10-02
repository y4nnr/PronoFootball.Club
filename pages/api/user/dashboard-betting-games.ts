import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

interface BettingGame {
  id: string;
  date: string;
  status: string;
  homeTeam: {
    id: string;
    name: string;
    logo: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    logo: string | null;
  };
  competition: {
    id: string;
    name: string;
  };
  userBet: {
    id: string;
    score1: number;
    score2: number;
  } | null;
  allUserBets: {
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      profilePictureUrl?: string;
    };
    createdAt: string;
    score1: number | null;
    score2: number | null;
  }[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ games: BettingGame[], hasMore: boolean, total: number } | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get pagination parameters
  const { page = '1', limit = '12' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get active competitions (case-insensitive)
    const activeCompetitions = await prisma.competition.findMany({
      where: {
        status: { 
          in: ['ACTIVE', 'active', 'UPCOMING', 'upcoming'] 
        },
      },
      select: { id: true }
    });

    if (activeCompetitions.length === 0) {
      return res.status(200).json({ games: [], hasMore: false, total: 0 });
    }

    // Get upcoming games from active competitions (excluding today's games)
    const today = new Date();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // First, get total count for pagination
    const totalCount = await prisma.game.count({
      where: {
        competitionId: {
          in: activeCompetitions.map(comp => comp.id)
        },
        status: 'UPCOMING',
        date: {
          gte: endOfDay
        }
      }
    });

    // Get paginated games
    const games = await prisma.game.findMany({
      where: {
        competitionId: {
          in: activeCompetitions.map(comp => comp.id)
        },
        status: 'UPCOMING', // Only games available for betting
        date: {
          gte: endOfDay // Exclude today's games (they go to "Matchs du jour")
        }
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        competition: {
          select: {
            id: true,
            name: true
          }
        },
        bets: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profilePictureUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        date: 'asc'
      },
      skip: offset,
      take: limitNum
    });

    // Format the response
    const bettingGames: BettingGame[] = games.map(game => {
      const currentUserBet = game.bets.find(bet => bet.userId === user.id);
      
      return {
        id: game.id,
        date: game.date.toISOString(),
        status: game.status,
        homeTeam: {
          id: game.homeTeam.id,
          name: game.homeTeam.name,
          logo: game.homeTeam.logo
        },
        awayTeam: {
          id: game.awayTeam.id,
          name: game.awayTeam.name,
          logo: game.awayTeam.logo
        },
        competition: {
          id: game.competition.id,
          name: game.competition.name
        },
        userBet: currentUserBet ? {
          id: currentUserBet.id,
          score1: currentUserBet.score1,
          score2: currentUserBet.score2
        } : null,
        // All users' bets - hide actual scores since game hasn't started
        allUserBets: game.bets.map(bet => ({
          id: bet.id,
          userId: bet.userId,
          user: {
            id: bet.user.id,
            name: bet.user.name,
            profilePictureUrl: bet.user.profilePictureUrl || undefined
          },
          createdAt: bet.createdAt.toISOString(),
          // Hide actual scores since game hasn't started (bets are still open)
          score1: null,
          score2: null
        }))
      };
    });

    // Calculate if there are more games
    const hasMore = offset + games.length < totalCount;
    
    // Add cache-busting headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log('🎯 DASHBOARD BETTING GAMES API LOG:');
    console.log('📊 Page:', pageNum, 'Limit:', limitNum, 'Offset:', offset);
    console.log('📊 Games returned:', games.length, 'Total available:', totalCount, 'Has more:', hasMore);
    console.log('📅 Games details:', games.map(g => ({
      id: g.id,
      homeTeam: g.homeTeam.name,
      awayTeam: g.awayTeam.name,
      date: g.date,
      status: g.status
    })));
    
    return res.status(200).json({
      games: bettingGames,
      hasMore,
      total: totalCount,
      timestamp: Date.now() // Force cache invalidation
    });
  } catch (error) {
    console.error('Dashboard betting games API error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
} 