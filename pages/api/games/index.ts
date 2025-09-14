import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const games = await prisma.game.findMany({
      where: {
        status: {
          in: ['UPCOMING', 'LIVE', 'FINISHED']
        }
      },
      select: {
        id: true,
        date: true,
        status: true,
        homeScore: true,
        awayScore: true,
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
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // For each game, always include all bets, but redact scores for other users before kickoff
    const gamesWithVisibleBets = games.map(game => {
      const isLive = game.status === 'LIVE';
      const hasStarted = new Date(game.date) <= new Date();
      return {
        ...game,
        bets: game.bets.map(bet => {
          if (bet.userId === session.user.id || isLive || hasStarted) {
            return bet;
          }
          // Redact scores for other users before kickoff
          return { ...bet, score1: null, score2: null };
        })
      };
    });

    return res.status(200).json(gamesWithVisibleBets);
  } catch (error) {
    console.error('Error fetching games:', error);
    return res.status(500).json({ error: 'Failed to fetch games' });
  }
} 