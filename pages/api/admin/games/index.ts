import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role.toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    try {
      const { competitionId, team1, team2, date } = req.body;

      if (!competitionId || !team1 || !team2 || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const game = await prisma.game.create({
        data: {
          competitionId,
          homeTeamId: team1,
          awayTeamId: team2,
          date: new Date(date),
        },
      });

      return res.status(201).json(game);
    } catch (error) {
      console.error('Error creating game:', error);
      return res.status(500).json({ error: 'Failed to create game' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 