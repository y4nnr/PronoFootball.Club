import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = new Date();
  
  // IMPORTANT: Add a 2-minute buffer to prevent marking games as LIVE too early.
  // Games are scheduled for a specific time, but they often start 1-2 minutes later.
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

  // Set games to 'LIVE' if their scheduled date/time is at least 2 minutes in the past and they are still 'UPCOMING'
  await prisma.game.updateMany({
    where: {
      status: 'UPCOMING',
      date: { lte: twoMinutesAgo }
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