import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { gameId } = req.query;

  if (!gameId || typeof gameId !== 'string') {
    return res.status(400).json({ message: 'Game ID is required' });
  }

  try {
    const bets = await prisma.bet.findMany({
      where: { gameId },
      select: {
        id: true,
        userId: true,
        score1: true,
        score2: true,
        points: true,
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
    });

    return res.status(200).json(bets);
  } catch (error) {
    console.error('Error fetching game bets:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
