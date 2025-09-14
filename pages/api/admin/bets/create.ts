import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user || typeof session.user !== 'object' || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { gameId, userId, score1, score2 } = req.body;

    if (!gameId || !userId || typeof score1 !== 'number' || typeof score2 !== 'number') {
      return res.status(400).json({ error: 'Game ID, User ID, and valid scores are required' });
    }

    if (score1 < 0 || score2 < 0) {
      return res.status(400).json({ error: 'Scores cannot be negative' });
    }

    if (score1 > 99 || score2 > 99) {
      return res.status(400).json({ error: 'Scores cannot exceed 99' });
    }

    // Check if game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        date: true,
        status: true,
        competition: {
          include: {
            users: {
              where: {
                userId: userId
              }
            }
          }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if game is upcoming (can only create bets for upcoming games)
    if (game.status !== 'UPCOMING') {
      return res.status(400).json({ error: 'Cannot create bet for non-upcoming game' });
    }

    // Check if game date is in the future
    if (new Date(game.date) <= new Date()) {
      return res.status(400).json({ error: 'Cannot create bet for past or current game' });
    }

    // Check if user is part of the competition
    if (game.competition.users.length === 0) {
      return res.status(400).json({ error: 'User is not part of this competition' });
    }

    // Check if user already has a bet for this game
    const existingBet = await prisma.bet.findFirst({
      where: {
        gameId: gameId,
        userId: userId
      }
    });

    if (existingBet) {
      return res.status(400).json({ error: 'User already has a bet for this game' });
    }

    // Create the bet
    const bet = await prisma.bet.create({
      data: {
        gameId: gameId,
        userId: userId,
        score1: score1,
        score2: score2,
        points: 0, // Will be calculated when game finishes
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({ message: 'Bet created successfully', bet });

  } catch (error) {
    console.error('Error creating bet:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
