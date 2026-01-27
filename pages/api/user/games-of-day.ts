import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

interface BettingGame {
  id: string;
  date: string;
  status: string;
  externalStatus?: string | null; // V2: External API status (HT, 1H, 2H, etc.)
  homeScore: number | null;
  awayScore: number | null;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  elapsedMinute?: number | null; // V2: Chronometer minute
  homeTeam: {
    id: string;
    name: string;
    logo: string | null;
    shortName?: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    logo: string | null;
    shortName?: string | null;
  };
  competition: {
    id: string;
    name: string;
    logo: string | null;
    sportType?: string | null;
  };
  userBet: {
    id: string;
    score1: number;
    score2: number;
    points: number | null;
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

// Placeholder team name used when the actual qualified team is not yet known.
// Games involving this placeholder should be hidden from user-facing "Matchs du jour".
const PLACEHOLDER_TEAM_NAME = 'xxxx';

export default async function handler(req: NextApiRequest, res: NextApiResponse<BettingGame[] | { error: string }>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's competition participation via CompetitionUser table
    const userCompetitions = await prisma.competitionUser.findMany({
      where: { userId: user.id },
      select: { competitionId: true }
    });
    const userCompetitionIds = userCompetitions.map(cu => cu.competitionId);

    if (userCompetitionIds.length === 0) {
      return res.status(200).json([]);
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get games for today from competitions the user is part of
    let games;
    try {
      games = await prisma.game.findMany({
        where: {
          competitionId: {
            in: userCompetitionIds
          },
          date: {
            gte: startOfDay,
            lt: endOfDay
          },
          status: {
            in: ['UPCOMING', 'LIVE', 'FINISHED']
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
          homeTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
              shortName: true
            }
          },
          awayTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
              shortName: true
            }
          },
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
              points: true,
              createdAt: true,
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
        orderBy: [
          { date: 'asc' },
          { id: 'asc' } // Secondary sort by ID for stability
        ]
      });
    } catch (prismaError: any) {
      console.error('Prisma query error:', prismaError);
      console.error('Error code:', prismaError?.code);
      console.error('Error meta:', prismaError?.meta);
      throw prismaError;
    }

    // Format the response with same structure as dashboard-betting-games
    const formattedGames: BettingGame[] = games.map(game => {
      const currentUserBet = game.bets.find(bet => bet.userId === user.id);
      
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
        competition: {
          id: game.competition.id,
          name: game.competition.name,
          logo: game.competition.logo,
          sportType: game.competition.sportType ? String(game.competition.sportType) : 'FOOTBALL' // Convert enum to string, default to FOOTBALL if null
        },
        userBet: currentUserBet ? {
          id: currentUserBet.id,
          score1: currentUserBet.score1,
          score2: currentUserBet.score2,
          points: currentUserBet.points
        } : null,
        // All users' bets - show actual scores for LIVE/FINISHED games, hide for UPCOMING
        allUserBets: game.bets.map(bet => ({
          id: bet.id,
          userId: bet.userId,
          user: {
            id: bet.user.id,
            name: bet.user.name,
            profilePictureUrl: bet.user.profilePictureUrl || undefined
          },
          createdAt: bet.createdAt.toISOString(),
          // Show actual scores for LIVE/FINISHED games, hide for UPCOMING
          score1: (game.status === 'LIVE' || game.status === 'FINISHED') ? bet.score1 : null,
          score2: (game.status === 'LIVE' || game.status === 'FINISHED') ? bet.score2 : null,
          points: bet.points // Include points for color coding in finished games
        }))
      };
    });

    // Disable caching for "Matchs du jour" to show live score updates in real-time
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return res.status(200).json(formattedGames);
  } catch (error) {
    console.error('Error fetching games of the day:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return res.status(500).json({ 
      error: 'Failed to fetch games of the day',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
