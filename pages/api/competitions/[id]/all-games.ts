import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id: competitionId } = req.query;

  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Competition ID is required' });
  }

  try {
    // Get all games for this competition
    const games = await prisma.game.findMany({
      where: {
        competitionId: competitionId
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
        date: 'desc'
      }
    });

    // For each game, process the betting information based on game status
    const gamesWithBetInfo = games.map(game => {
      const gameStarted = new Date(game.date) <= new Date();
      const currentUserBet = game.bets.find(bet => bet.userId === session.user.id);
      
      return {
        ...game,
        // Current user's bet (for backward compatibility)
        bets: currentUserBet ? [{
          id: currentUserBet.id,
          score1: currentUserBet.score1,
          score2: currentUserBet.score2,
          createdAt: currentUserBet.createdAt
        }] : [],
        // All users' bets with conditional visibility
        allUserBets: gameStarted ? game.bets : game.bets.map(bet => ({
          id: bet.id,
          userId: bet.userId,
          user: bet.user,
          createdAt: bet.createdAt,
          // Hide actual scores if game hasn't started
          score1: null,
          score2: null
        }))
      };
    });

    return res.status(200).json(gamesWithBetInfo);
  } catch (error) {
    console.error('Error fetching all competition games:', error);
    return res.status(500).json({ error: 'Failed to fetch all competition games' });
  }
} 