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
    const { gameId, homeScore, awayScore, status = 'LIVE' } = req.body;

    if (!gameId || homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: gameId, homeScore, awayScore' 
      });
    }

    console.log(`🔧 Manual score update: Game ${gameId} → ${homeScore}-${awayScore} (${status})`);

    // Get the current game
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Update the game with manual scores
    const updateData: any = {
      liveHomeScore: homeScore,
      liveAwayScore: awayScore,
      status: status,
      lastSyncAt: new Date()
    };

    // If game is finished, also update final scores
    if (status === 'FINISHED') {
      updateData.homeScore = homeScore;
      updateData.awayScore = awayScore;
      updateData.decidedBy = 'FT';
      updateData.finishedAt = new Date();
    }

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: updateData,
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    console.log(`✅ Manual update successful: ${updatedGame.homeTeam.name} ${homeScore}-${awayScore} ${updatedGame.awayTeam.name}`);

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`,
      game: {
        id: updatedGame.id,
        homeTeam: updatedGame.homeTeam.name,
        awayTeam: updatedGame.awayTeam.name,
        homeScore: updatedGame.liveHomeScore,
        awayScore: updatedGame.liveAwayScore,
        status: updatedGame.status,
        lastSyncAt: updatedGame.lastSyncAt?.toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error updating manual scores:', error);
    return res.status(500).json({ 
      error: 'Failed to update scores',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
