import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  try {
    const breakdown = await prisma.$queryRawUnsafe<any[]>(
      `SELECT c.name AS competition, SUM(b.points)::int AS total_points, c."startDate"
       FROM "Bet" b
       JOIN "Game" g ON b."gameId" = g.id
       JOIN "Competition" c ON g."competitionId" = c.id
       WHERE b."userId" = $1
       GROUP BY c.name, c."startDate"
       ORDER BY c."startDate" DESC;`,
      userId
    );
    res.status(200).json(breakdown);
  } catch (error) {
    console.error('Breakdown API error:', error);
    res.status(500).json({ error: 'Failed to fetch breakdown', details: error });
  }
} 