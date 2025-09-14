import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

interface BettingGame {
  id: string;
  date: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
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
    logo: string | null;
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

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get games for today
    const games = await prisma.game.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay
        },
        status: {
          in: ['UPCOMING', 'LIVE', 'FINISHED']
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
            name: true,
            logo: true
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
      }
    });

    // Format the response with same structure as dashboard-betting-games
    const formattedGames: BettingGame[] = games.map(game => {
      const currentUserBet = game.bets.find(bet => bet.userId === user.id);
      
      return {
        id: game.id,
        date: game.date.toISOString(),
        status: game.status,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
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
          name: game.competition.name,
          logo: game.competition.logo
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
          score2: (game.status === 'LIVE' || game.status === 'FINISHED') ? bet.score2 : null
        }))
      };
    });

    return res.status(200).json(formattedGames);
  } catch (error) {
    console.error('Error fetching games of the day:', error);
    return res.status(500).json({ error: 'Failed to fetch games of the day' });
  }
}
