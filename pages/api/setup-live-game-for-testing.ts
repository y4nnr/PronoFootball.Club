import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { FootballDataAPI } from '../../lib/football-data-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Finding REAL LIVE games for testing...');

    // Get real live games from Football-Data.org
    const footballAPI = new FootballDataAPI();
    const isConnected = await footballAPI.testConnection();
    
    if (!isConnected) {
      return res.status(500).json({
        error: 'Failed to connect to Football-Data.org API',
        details: 'Please check your API key'
      });
    }

    // Get real live games (IN_PLAY status)
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const realLiveMatches = await footballAPI.makeRequest(`/matches?dateFrom=${todayStr}&dateTo=${tomorrowStr}&status=IN_PLAY`);

    console.log(`📊 Found ${realLiveMatches.count} real LIVE matches from external API`);

    if (realLiveMatches.count === 0) {
      return res.status(200).json({
        success: true,
        message: 'No real LIVE games found from external API',
        realGames: [],
        setupGames: []
      });
    }

    // Get today's date
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get games scheduled for today (these are the "Matchs du jour")
    const todaysGames = await prisma.game.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      },
      orderBy: {
        date: 'asc'
      },
      take: 1 // Take only the first game for testing
    });

    console.log(`📊 Found ${todaysGames.length} games scheduled for today`);

    if (todaysGames.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No games scheduled for today',
        realGames: realLiveMatches.matches || [],
        setupGames: []
      });
    }

    const realMatches = realLiveMatches.matches || [];
    const updatedGames: any[] = [];

    // Update the first game with the first real live match
    const game = todaysGames[0];
    const realMatch = realMatches[0];

    try {
      // Set the game to LIVE with real live data
      const updateData = {
        status: 'LIVE',
        liveHomeScore: realMatch.score.fullTime.home,
        liveAwayScore: realMatch.score.fullTime.away,
        homeScore: null, // Clear final scores
        awayScore: null,
        externalStatus: realMatch.status,
        externalId: realMatch.id.toString(),
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
          awayTeam: true,
          competition: true
        }
      });

      updatedGames.push({
        id: updatedGame.id,
        homeTeam: updatedGame.homeTeam.name,
        awayTeam: updatedGame.awayTeam.name,
        status: updatedGame.status,
        liveHomeScore: updatedGame.liveHomeScore,
        liveAwayScore: updatedGame.liveAwayScore,
        externalStatus: updatedGame.externalStatus,
        lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
        realGame: `${realMatch.homeTeam.name} vs ${realMatch.awayTeam.name}`,
        realScore: `${realMatch.score.fullTime.home}-${realMatch.score.fullTime.away}`,
        realStatus: realMatch.status
      });

      console.log(`✅ Setup: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore} (${updatedGame.status})`);
      console.log(`   Real game: ${realMatch.homeTeam.name} vs ${realMatch.awayTeam.name} - ${realMatch.score.fullTime.home}-${realMatch.score.fullTime.away} (${realMatch.status})`);

    } catch (error) {
      console.error(`❌ Error updating game ${game.id}:`, error);
    }

    console.log(`✅ Setup completed. ${updatedGames.length} game is now LIVE with real data`);

    return res.status(200).json({
      success: true,
      message: `Successfully set up ${updatedGames.length} game for LIVE testing`,
      realGames: realMatches.map(match => ({
        id: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        score: `${match.score.fullTime.home}-${match.score.fullTime.away}`,
        status: match.status
      })),
      setupGames: updatedGames,
      totalRealGames: realMatches.length,
      setupGamesCount: updatedGames.length
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return res.status(500).json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
