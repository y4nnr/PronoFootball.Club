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
  }[];
  betCount: number;
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
  const limitNumRaw = parseInt(limit as string, 10);
  const limitNum = Math.min(isNaN(limitNumRaw) ? 12 : limitNumRaw, 24); // hard cap at 24
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

    // Get upcoming games from active competitions (including today's games)
    const now = new Date();
    
    // First, get total count for pagination
    const totalCount = await prisma.game.count({
      where: {
        competitionId: {
          in: activeCompetitions.map(comp => comp.id)
        },
        status: 'UPCOMING',
        date: {
          gte: now // Include all future games from now
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
          gte: now // Include all future games from now
        }
      },
      select: {
        id: true,
        date: true,
        status: true,
        homeTeam: { select: { id: true, name: true, logo: true } },
        awayTeam: { select: { id: true, name: true, logo: true } },
        bets: { select: { id: true, userId: true } },
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
      const betCount = game.bets.length;
      // No avatars on dashboard to minimize payload size
      
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
        userBet: currentUserBet ? {
          id: currentUserBet.id,
          // Scores are not returned in bets selection; keep existing UI behavior:
          // the client already shows score box based on separate endpoints.
          // To preserve current UI logic expecting numbers, set to 0 (hidden in UI for upcoming).
          score1: 0,
          score2: 0
        } : null,
        // No per-bet user payload to keep response small
        allUserBets: [],
        betCount,
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
    // Reduce verbose logging to avoid heavy server logs
    
    return res.status(200).json({
      games: bettingGames,
      hasMore,
      total: totalCount
    });
  } catch (error) {
    console.error('Dashboard betting games API error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
} 