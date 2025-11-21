import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

interface BettingGame {
  id: string;
  date: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  homeTeam: {
    id: string;
    name: string;
    logo: string | null;
    shortName: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    logo: string | null;
    shortName: string | null;
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

    // Get upcoming games from active competitions (excluding today's games to avoid duplication)
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    // First, get total count for pagination
    const totalCount = await prisma.game.count({
      where: {
        competitionId: {
          in: activeCompetitions.map(comp => comp.id)
        },
        status: 'UPCOMING',
        date: {
          gte: endOfDay // Only future games (tomorrow onwards)
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
          gte: endOfDay // Only future games (tomorrow onwards)
        }
      },
      select: {
        id: true,
        date: true,
        status: true,
        homeScore: true,
        awayScore: true,
        liveHomeScore: true,
        liveAwayScore: true,
        homeTeam: { select: { id: true, name: true, logo: true, shortName: true } },
        awayTeam: { select: { id: true, name: true, logo: true, shortName: true } },
        bets: { 
          select: { 
            id: true, 
            userId: true,
            score1: true,
            score2: true,
            user: { select: { id: true, name: true, profilePictureUrl: true } }
          } 
        },
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
      // Include all bets with minimal user info; hide scores until LIVE/FINISHED
      
      return {
        id: game.id,
        date: game.date.toISOString(),
        status: game.status,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        liveHomeScore: game.liveHomeScore,
        liveAwayScore: game.liveAwayScore,
        homeTeam: {
          id: game.homeTeam.id,
          name: game.homeTeam.name,
          logo: game.homeTeam.logo,
          shortName: game.homeTeam.shortName
        },
        awayTeam: {
          id: game.awayTeam.id,
          name: game.awayTeam.name,
          logo: game.awayTeam.logo,
          shortName: game.awayTeam.shortName
        },
        userBet: currentUserBet ? {
          id: currentUserBet.id,
          score1: currentUserBet.score1 ?? 0,
          score2: currentUserBet.score2 ?? 0
        } : null,
        allUserBets: game.bets.map(bet => ({
          id: bet.id,
          userId: bet.userId,
          user: {
            id: bet.user.id,
            name: bet.user.name,
            profilePictureUrl: bet.user.profilePictureUrl || undefined
          },
          // Only reveal scores for LIVE/FINISHED; current user's score always merged on client via userBet
          // We do not send createdAt here to keep payload small
        })),
        betCount,
      };
    });

    // Calculate if there are more games
    const hasMore = offset + games.length < totalCount;
    
    // Add caching headers - shorter cache for betting games (can change status)
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    
    console.log('🎯 DASHBOARD BETTING GAMES API LOG:');
    console.log('📊 Page:', pageNum, 'Limit:', limitNum, 'Offset:', offset);
    console.log('📊 Games returned:', games.length, 'Total available:', totalCount, 'Has more:', hasMore);
    console.log('📊 Active competitions:', activeCompetitions.length);
    console.log('📊 Date filter: >=', endOfDay.toISOString());
    console.log('📊 Showing future games only (tomorrow onwards) to avoid duplication with "Matchs du jour"');
    
    if (games.length === 0) {
      console.log('⚠️ No betting games found - this might cause empty "Matchs à venir" section');
      console.log('🔍 Debug info:');
      console.log('  - Active competitions:', activeCompetitions.map(c => c.id));
      console.log('  - Date filter:', endOfDay.toISOString());
      console.log('  - Status filter: UPCOMING only');
    }
    
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