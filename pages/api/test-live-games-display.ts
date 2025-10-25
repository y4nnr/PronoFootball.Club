import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Fetching live games for display...');

    // Get all LIVE games
    const liveGames = await prisma.game.findMany({
      where: {
        status: 'LIVE'
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      },
      orderBy: {
        lastSyncAt: 'desc'
      }
    });

    console.log(`📊 Found ${liveGames.length} LIVE games`);

    // Get all games with live scores (even if status is not LIVE)
    const gamesWithLiveScores = await prisma.game.findMany({
      where: {
        liveHomeScore: { not: null },
        liveAwayScore: { not: null }
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      },
      orderBy: {
        lastSyncAt: 'desc'
      },
      take: 10
    });

    console.log(`📊 Found ${gamesWithLiveScores.length} games with live scores`);

    // Format games for display
    const formattedLiveGames = liveGames.map(game => ({
      id: game.id,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      liveHomeScore: game.liveHomeScore,
      liveAwayScore: game.liveAwayScore,
      status: game.status,
      externalStatus: game.externalStatus,
      statusDetail: game.statusDetail,
      decidedBy: game.decidedBy,
      lastSyncAt: game.lastSyncAt?.toISOString(),
      competition: game.competition.name
    }));

    const formattedGamesWithLiveScores = gamesWithLiveScores.map(game => ({
      id: game.id,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      liveHomeScore: game.liveHomeScore,
      liveAwayScore: game.liveAwayScore,
      status: game.status,
      externalStatus: game.externalStatus,
      statusDetail: game.statusDetail,
      decidedBy: game.decidedBy,
      lastSyncAt: game.lastSyncAt?.toISOString(),
      competition: game.competition.name
    }));

    return res.status(200).json({
      success: true,
      message: `Found ${liveGames.length} LIVE games and ${gamesWithLiveScores.length} games with live scores`,
      liveGames: formattedLiveGames,
      gamesWithLiveScores: formattedGamesWithLiveScores,
      totalLiveGames: liveGames.length,
      totalGamesWithLiveScores: gamesWithLiveScores.length
    });

  } catch (error) {
    console.error('❌ Error fetching live games:', error);
    return res.status(500).json({
      error: 'Failed to fetch live games',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
