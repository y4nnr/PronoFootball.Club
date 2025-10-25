import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Resetting games to LIVE status for testing...');

    // Get today's date
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Find games scheduled for today
    const todaysGames = await prisma.game.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: {
        date: 'asc'
      },
      take: 3 // Take the first 3 games of today
    });

    console.log(`📊 Found ${todaysGames.length} games scheduled for today`);

    if (todaysGames.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No games scheduled for today',
        games: []
      });
    }

    const resetGames: any[] = [];

    // Reset each game to LIVE with fresh scores
    for (let i = 0; i < todaysGames.length; i++) {
      const game = todaysGames[i];

      try {
        // Set different starting scores for each game
        const startingScores = [
          { home: 0, away: 0 },
          { home: 1, away: 0 },
          { home: 0, away: 1 }
        ];

        const scores = startingScores[i] || { home: 0, away: 0 };

        // Reset the game to LIVE status with starting scores
        const updateData = {
          status: 'LIVE',
          liveHomeScore: scores.home,
          liveAwayScore: scores.away,
          homeScore: null, // Clear final scores
          awayScore: null,
          externalStatus: 'IN_PLAY',
          statusDetail: null,
          decidedBy: null,
          finishedAt: null,
          lastSyncAt: new Date()
        };

        const updatedGame = await prisma.game.update({
          where: { id: game.id },
          data: updateData,
          include: {
            homeTeam: true,
            awayTeam: true
          }
        });

        resetGames.push({
          id: updatedGame.id,
          homeTeam: updatedGame.homeTeam.name,
          awayTeam: updatedGame.awayTeam.name,
          status: updatedGame.status,
          liveHomeScore: updatedGame.liveHomeScore,
          liveAwayScore: updatedGame.liveAwayScore,
          homeScore: updatedGame.homeScore,
          awayScore: updatedGame.awayScore,
          externalStatus: updatedGame.externalStatus,
          lastSyncAt: updatedGame.lastSyncAt?.toISOString()
        });

        console.log(`✅ Reset: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore} (${updatedGame.status})`);

      } catch (error) {
        console.error(`❌ Error resetting game ${game.id}:`, error);
      }
    }

    console.log(`✅ Reset completed. ${resetGames.length} games are now LIVE`);

    return res.status(200).json({
      success: true,
      message: `Successfully reset ${resetGames.length} games to LIVE status`,
      games: resetGames,
      totalGames: resetGames.length
    });

  } catch (error) {
    console.error('❌ Reset failed:', error);
    return res.status(500).json({
      error: 'Reset failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
