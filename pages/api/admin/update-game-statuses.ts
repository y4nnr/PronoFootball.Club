import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  // Only allow admin users to trigger this
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true }
  });

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const now = new Date();
    console.log(`[GAME STATUS UPDATE] Starting at ${now.toISOString()}`);
    console.log(`[GAME STATUS UPDATE] WARNING: This is a manual admin endpoint. Automatic updates should be handled by game-status-worker.js`);

    // Find games that should be LIVE (UPCOMING games where start time has passed)
    // IMPORTANT: Add a 2-minute buffer to prevent marking games as LIVE too early.
    // Games are scheduled for a specific time, but they often start 1-2 minutes later.
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const gamesToUpdate = await prisma.game.findMany({
      where: {
        status: 'UPCOMING',
        date: {
          lte: twoMinutesAgo, // Game time has passed by at least 2 minutes
          lt: now // Extra safety: explicitly check date is in the past (not future)
        },
        // Exclude RESCHEDULED games - they should not be automatically updated
        NOT: {
          status: 'RESCHEDULED'
        }
      },
      select: {
        id: true,
        date: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } }
      }
    });

    console.log(`[GAME STATUS UPDATE] Found ${gamesToUpdate.length} games to update to LIVE`);
    
    // Log each game that will be updated with time difference
    gamesToUpdate.forEach(game => {
      const gameDate = new Date(game.date);
      const diffMs = now.getTime() - gameDate.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));
      console.log(`[GAME STATUS UPDATE] Will update: ${game.homeTeam.name} vs ${game.awayTeam.name} - ${diffMinutes} minutes past start time (${gameDate.toISOString()})`);
      
      if (diffMinutes < 0) {
        console.log(`[GAME STATUS UPDATE] ⚠️ WARNING: Game is in the FUTURE! This should not happen!`);
      }
    });

    if (gamesToUpdate.length === 0) {
      return res.status(200).json({
        message: 'No games need status updates',
        updatedCount: 0,
        games: []
      });
    }

    // Update games to LIVE status
    const updateResult = await prisma.game.updateMany({
      where: {
        id: {
          in: gamesToUpdate.map(game => game.id)
        }
      },
      data: {
        status: 'LIVE'
      }
    });

    console.log(`[GAME STATUS UPDATE] Updated ${updateResult.count} games to LIVE status`);

    // Log the updated games
    gamesToUpdate.forEach(game => {
      const timeDiff = Math.round((now.getTime() - new Date(game.date).getTime()) / (1000 * 60));
      console.log(`[GAME STATUS UPDATE] ${game.homeTeam.name} vs ${game.awayTeam.name} - ${timeDiff} minutes past start time`);
    });

    return res.status(200).json({
      message: `Successfully updated ${updateResult.count} games to LIVE status`,
      updatedCount: updateResult.count,
      games: gamesToUpdate.map(game => ({
        id: game.id,
        homeTeam: game.homeTeam.name,
        awayTeam: game.awayTeam.name,
        gameTime: game.date,
        minutesPastStart: Math.round((now.getTime() - new Date(game.date).getTime()) / (1000 * 60))
      }))
    });

  } catch (error) {
    console.error('[GAME STATUS UPDATE] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to update game statuses',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
