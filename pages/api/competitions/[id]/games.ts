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
    // Get games for this competition that are available for betting
    // Show games that users can bet on: ONLY UPCOMING games (bets close when game starts)
    const games = await prisma.game.findMany({
      where: {
        competitionId: competitionId,
        status: 'UPCOMING' // Only upcoming games - bets close when game starts (becomes LIVE)
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
        date: 'asc'
      }
    });

    // For each game, process the betting information
    // Since all games are UPCOMING, bets are still open and scores should be hidden
    const gamesWithBetInfo = games.map(game => {
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
        // All users' bets - hide actual scores since game hasn't started
        allUserBets: game.bets.map(bet => ({
          id: bet.id,
          userId: bet.userId,
          user: bet.user,
          createdAt: bet.createdAt,
          // Hide actual scores since game hasn't started (bets are still open)
          score1: null,
          score2: null
        }))
      };
    });

    // Return all UPCOMING games available for betting
    return res.status(200).json(gamesWithBetInfo);
  } catch (error) {
    console.error('Error fetching competition games:', error);
    return res.status(500).json({ error: 'Failed to fetch competition games' });
  }
} 