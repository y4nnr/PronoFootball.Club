import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]';
import { prisma } from '../../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role?.toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId } = req.query;
  if (!gameId || typeof gameId !== 'string') {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  try {
    const source = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        competitionId: true,
        homeTeamId: true,
        awayTeamId: true,
        date: true,
      },
    });

    if (!source) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Always duplicate with the exact same date/time as source
    const newDate = new Date(source.date.getTime());

    const created = await prisma.game.create({
      data: {
        competitionId: source.competitionId,
        homeTeamId: source.homeTeamId,
        awayTeamId: source.awayTeamId,
        date: newDate,
        status: 'UPCOMING',
        homeScore: null,
        awayScore: null,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('Error duplicating game:', error);
    return res.status(500).json({ error: 'Failed to duplicate game' });
  }
}


