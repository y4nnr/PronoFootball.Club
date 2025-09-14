import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { competitionId } = req.query;
  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid competitionId' });
  }

  try {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        users: {
          include: {
            user: true
          }
        }
      }
    });

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    const results: { user: string; totalPoints: number }[] = [];
    for (const compUser of competition.users) {
      const user = compUser.user;
      const userBets = await prisma.bet.findMany({
        where: {
          userId: user.id,
          game: {
            competitionId,
            status: 'FINISHED'
          }
        }
      });
      const totalPoints = userBets.reduce((sum, bet) => sum + bet.points, 0);
      results.push({
        user: user.name,
        totalPoints
      });
    }

    results.sort((a, b) => b.totalPoints - a.totalPoints);
    res.status(200).json({ competitionId, ranking: results });
  } catch (error) {
    console.error('Error fetching live ranking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 