import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { gameId } = req.query;

  try {
    const bet = await prisma.bet.findFirst({
      where: {
        gameId: gameId as string,
        userId: session.user.id
      },
      select: {
        score1: true,
        score2: true
      }
    });

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    return res.status(200).json(bet);
  } catch (error) {
    console.error('Error fetching bet:', error);
    return res.status(500).json({ error: 'Failed to fetch bet' });
  }
} 