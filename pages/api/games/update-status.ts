import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = new Date();

  // Set games to 'LIVE' if their scheduled date/time is in the past and they are still 'UPCOMING'
  await prisma.game.updateMany({
    where: {
      status: 'UPCOMING',
      date: { lte: now }
    },
    data: { status: 'LIVE' }
  });

  // Update games with scores to 'FINISHED'
  await prisma.game.updateMany({
    where: {
      status: 'LIVE',
      homeScore: { not: null },
      awayScore: { not: null }
    },
    data: { status: 'FINISHED' }
  });

  res.status(200).json({ message: 'Game statuses updated.' });
} 