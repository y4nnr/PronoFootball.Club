import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

interface BettingGame {
  id: string;
  date: string;
  status: string;
  externalStatus?: string | null; // V2: External API status (HT, 1H, 2H, etc.)
  homeScore?: number | null;
  awayScore?: number | null;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  elapsedMinute?: number | null; // V2: Chronometer minute
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
  competition?: {
    id: string;
    name: string;
    logo: string | null;
    sportType: string;
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
    score1: number | null;
    score2: number | null;
  }[];
  betCount: number;
}

// Placeholder team name used when the actual qualified team is not yet known.
// Games involving this placeholder should be hidden from user-facing lists,
// but they are still part of the competition schedule for progression bars.
const PLACEHOLDER_TEAM_NAME = 'xxxx';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ games: BettingGame[], hasMore: boolean, total: number } | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get pagination parameters
  const { page = '1', limit = '12', includeToday = 'false' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNumRaw = parseInt(limit as string, 10);
  const limitNum = Math.min(isNaN(limitNumRaw) ? 12 : limitNumRaw, 24); // hard cap at 24
  const offset = (pageNum - 1) * limitNum;
  const shouldIncludeToday = includeToday === 'true'; // Betting UI passes this, dashboard doesn't
  const isDashboardRequest =
    !shouldIncludeToday &&
    (req.query.page === undefined || req.query.page === '1') &&
    req.query.limit === undefined;

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

    // Get user's competition participation via CompetitionUser table
    const userCompetitions = await prisma.competitionUser.findMany({
      where: { userId: user.id },
      select: { competitionId: true }
    });
    const userCompetitionIds = userCompetitions.map(cu => cu.competitionId);

    if (userCompetitionIds.length === 0) {
      return res.status(200).json({ games: [], hasMore: false, total: 0 });
    }

    // Get active competitions that the user is part of (case-insensitive)
    const activeCompetitions = await prisma.competition.findMany({
      where: {
        id: {
          in: userCompetitionIds
        },
        status: { 
          in: ['ACTIVE', 'active', 'UPCOMING', 'upcoming'] 
        },
      },
      select: { id: true }
    });

    if (activeCompetitions.length === 0) {
      return res.status(200).json({ games: [], hasMore: false, total: 0 });
    }

    // Date filter: Dashboard excludes today (tomorrow onwards), Betting UI includes today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    // Use startOfDay for betting UI (includes today), endOfDay for dashboard (excludes today)
    const dateFilter = shouldIncludeToday ? startOfDay : endOfDay;
    
    let totalCount = 0;
    let games;

    if (isDashboardRequest) {
      // Special-case for dashboard "Matchs à venir":
      // - We want a limit of 12 *unless* the next game day itself has > 12 games.
      // - In that case, we show all games of that next game day.
      //
      // This should NOT affect the betting UI carousel (includeToday=true + pagination).

      // Fetch all upcoming games (no pagination) for the user's active competitions
      const allUpcomingGames = await prisma.game.findMany({
        where: {
          competitionId: {
            in: activeCompetitions.map(comp => comp.id)
          },
          status: 'UPCOMING',
          date: {
            gte: dateFilter
          },
          // Exclude placeholder teams (used as TBD when qualifiers are unknown)
          AND: [
            {
              homeTeam: {
                name: { not: PLACEHOLDER_TEAM_NAME }
              }
            },
            {
              awayTeam: {
                name: { not: PLACEHOLDER_TEAM_NAME }
              }
            }
          ]
        },
        select: {
          id: true,
          date: true,
          status: true,
          externalStatus: true, // V2: External API status
          homeScore: true,
          awayScore: true,
          liveHomeScore: true,
          liveAwayScore: true,
          elapsedMinute: true, // V2: Chronometer
          homeTeam: { select: { id: true, name: true, logo: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, logo: true, shortName: true } },
          competition: { 
            select: { 
              id: true, 
              name: true, 
              logo: true, 
              sportType: true 
            } 
          },
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
        }
      });

      totalCount = allUpcomingGames.length;

      if (allUpcomingGames.length === 0) {
        games = [];
      } else {
        // Determine the "next game day" (the calendar day of the first upcoming game)
        const firstDate = allUpcomingGames[0].date as Date;
        const nextDayStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
        const nextDayEnd = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + 1);

        const gamesOnNextDay = allUpcomingGames.filter(game => {
          const d = game.date as Date;
          return d >= nextDayStart && d < nextDayEnd;
        });

        if (gamesOnNextDay.length > 12) {
          // More than 12 games on the next game day: return ALL of them
          games = gamesOnNextDay;
        } else {
          // 12 or fewer on the next game day: keep current behavior (first page, 12 max)
          games = allUpcomingGames.slice(0, limitNum);
        }
      }
    } else {
      // Original paginated behavior (used by betting UI carousel and any explicit pagination)
      // First, get total count for pagination
      totalCount = await prisma.game.count({
        where: {
          competitionId: {
            in: activeCompetitions.map(comp => comp.id)
          },
          status: 'UPCOMING',
          date: {
            gte: dateFilter
          },
          AND: [
            {
              homeTeam: {
                name: { not: PLACEHOLDER_TEAM_NAME }
              }
            },
            {
              awayTeam: {
                name: { not: PLACEHOLDER_TEAM_NAME }
              }
            }
          ]
        }
      });

      // Get paginated games
      games = await prisma.game.findMany({
        where: {
          competitionId: {
            in: activeCompetitions.map(comp => comp.id)
          },
          status: 'UPCOMING', // Only games available for betting
          date: {
            gte: dateFilter
          },
          AND: [
            {
              homeTeam: {
                name: { not: PLACEHOLDER_TEAM_NAME }
              }
            },
            {
              awayTeam: {
                name: { not: PLACEHOLDER_TEAM_NAME }
              }
            }
          ]
        },
        select: {
          id: true,
          date: true,
          status: true,
          externalStatus: true, // V2: External API status
          homeScore: true,
          awayScore: true,
          liveHomeScore: true,
          liveAwayScore: true,
          elapsedMinute: true, // V2: Chronometer
          homeTeam: { select: { id: true, name: true, logo: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, logo: true, shortName: true } },
          competition: { 
            select: { 
              id: true, 
              name: true, 
              logo: true, 
              sportType: true 
            } 
          },
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
    }

    // Format the response
    const bettingGames: BettingGame[] = games.map(game => {
      const currentUserBet = game.bets.find(bet => bet.userId === user.id);
      const betCount = game.bets.length;
      // Include all bets with minimal user info; hide scores until LIVE/FINISHED
      
      return {
        id: game.id,
        date: game.date.toISOString(),
        status: game.status,
        externalStatus: game.externalStatus, // V2: External API status
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        liveHomeScore: game.liveHomeScore,
        liveAwayScore: game.liveAwayScore,
        elapsedMinute: game.elapsedMinute, // V2: Chronometer
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
        competition: game.competition ? {
          id: game.competition.id,
          name: game.competition.name,
          logo: game.competition.logo,
          sportType: game.competition.sportType
        } : undefined,
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
          // Show actual scores for LIVE/FINISHED games, hide for UPCOMING
          score1: (game.status === 'LIVE' || game.status === 'FINISHED') ? bet.score1 : null,
          score2: (game.status === 'LIVE' || game.status === 'FINISHED') ? bet.score2 : null,
          // We do not send createdAt here to keep payload small
        })),
        betCount,
      };
    });

    // Calculate if there are more games
    const hasMore = isDashboardRequest
      ? games.length < totalCount // dashboard: more games exist beyond what we returned
      : offset + games.length < totalCount; // paginated behavior
    
    // Add caching headers - shorter cache for betting games (can change status)
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    
    console.log('🎯 DASHBOARD BETTING GAMES API LOG:');
    console.log('📊 Page:', pageNum, 'Limit:', limitNum, 'Offset:', offset);
    console.log('📊 Games returned:', games.length, 'Total available:', totalCount, 'Has more:', hasMore);
    console.log('📊 User competitions:', userCompetitionIds.length);
    console.log('📊 Active competitions (user participating):', activeCompetitions.length);
    console.log('📊 Include today:', shouldIncludeToday);
    console.log('📊 Date filter: >=', dateFilter.toISOString());
    if (isDashboardRequest) {
      console.log('📊 Mode: Dashboard first page (Matchs à venir) with next-game-day override when > 12 games on that day');
    } else {
      console.log('📊 Mode:', shouldIncludeToday ? 'Betting carousel (includes today, paginated)' : 'Standard paginated upcoming games');
    }
    
    if (games.length === 0) {
      console.log('⚠️ No betting games found - this might cause empty "Matchs à venir" section');
      console.log('🔍 Debug info:');
      console.log('  - User competition IDs:', userCompetitionIds);
      console.log('  - Active competitions (user participating):', activeCompetitions.map(c => c.id));
      console.log('  - Date filter:', dateFilter.toISOString());
      console.log('  - Status filter: UPCOMING only');
    }
    
    return res.status(200).json({
      games: bettingGames,
      hasMore,
      total: totalCount
    });
  } catch (error) {
    console.error('Dashboard betting games API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return res.status(500).json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 