import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const competitions = await prisma.competition.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: 'desc' }
    });
    const now = new Date();
    const competitionsWithActive = competitions.map(c => ({
      ...c,
      isActive: new Date(c.startDate) <= now && now <= new Date(c.endDate)
    }));
    return res.status(200).json(competitionsWithActive);
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return res.status(500).json({ error: 'Failed to fetch competitions' });
  }
} 