import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import FootballDataAPI from '../../lib/football-data-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎯 Setting up LIVE games for "Matchs du jour"...');

    // Get today's date
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Find games scheduled for today (these are likely the "Matchs du jour")
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

    // Get real live games from external API
    const footballAPI = new FootballDataAPI();
    const isConnected = await footballAPI.testConnection();
    
    if (!isConnected) {
      return res.status(500).json({
        error: 'Failed to connect to Football-Data.org API',
        details: 'Please check your API key'
      });
    }

    // Get real live games
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const realLiveMatches = await footballAPI.makeRequest(`/matches?dateFrom=${todayStr}&dateTo=${tomorrowStr}&status=IN_PLAY,PAUSED`);

    console.log(`📊 Found ${realLiveMatches.count} real live matches from external API`);

    if (realLiveMatches.count === 0) {
      return res.status(200).json({
        success: true,
        message: 'No real live games found from external API',
        games: todaysGames.map(game => ({
          id: game.id,
          homeTeam: game.homeTeam.name,
          awayTeam: game.awayTeam.name,
          status: game.status
        }))
      });
    }

    const updatedGames: any[] = [];
    const realMatches = realLiveMatches.matches || [];

    // Update each of today's games with real live data
    for (let i = 0; i < Math.min(todaysGames.length, realMatches.length); i++) {
      const game = todaysGames[i];
      const realMatch = realMatches[i];

      try {
        // Map external status to internal status
        let status = 'LIVE';
        let statusDetail = null;
        let decidedBy = null;

        switch (realMatch.status) {
          case 'IN_PLAY':
            status = 'LIVE';
            break;
          case 'PAUSED':
            status = 'LIVE';
            statusDetail = 'HT';
            break;
          case 'FINISHED':
            status = 'FINISHED';
            decidedBy = 'FT';
            break;
          case 'AET':
            status = 'FINISHED';
            statusDetail = 'AET';
            decidedBy = 'AET';
            break;
          case 'PEN':
            status = 'FINISHED';
            statusDetail = 'PEN';
            decidedBy = 'PEN';
            break;
          default:
            status = 'LIVE';
        }

        // Update the game with real live data
        const updateData: any = {
          status: status,
          liveHomeScore: realMatch.score.fullTime.home,
          liveAwayScore: realMatch.score.fullTime.away,
          externalStatus: realMatch.status,
          externalId: realMatch.id.toString(),
          lastSyncAt: new Date()
        };

        if (statusDetail) {
          updateData.statusDetail = statusDetail;
        }
        if (decidedBy) {
          updateData.decidedBy = decidedBy;
        }

        // If game is finished, also update final scores
        if (status === 'FINISHED') {
          updateData.homeScore = realMatch.score.fullTime.home;
          updateData.awayScore = realMatch.score.fullTime.away;
          updateData.finishedAt = new Date();
        }

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
          homeScore: updatedGame.homeScore,
          awayScore: updatedGame.awayScore,
          liveHomeScore: updatedGame.liveHomeScore,
          liveAwayScore: updatedGame.liveAwayScore,
          externalStatus: updatedGame.externalStatus,
          statusDetail: updatedGame.statusDetail,
          decidedBy: updatedGame.decidedBy,
          lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
          realGame: `${realMatch.homeTeam.name} vs ${realMatch.awayTeam.name}`,
          realScore: `${realMatch.score.fullTime.home}-${realMatch.score.fullTime.away}`
        });

        console.log(`✅ Updated: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore} (${updatedGame.status})`);
        console.log(`   Real game: ${realMatch.homeTeam.name} vs ${realMatch.awayTeam.name} - ${realMatch.score.fullTime.home}-${realMatch.score.fullTime.away}`);

      } catch (error) {
        console.error(`❌ Error updating game ${game.id}:`, error);
      }
    }

    console.log(`✅ Setup completed. Updated ${updatedGames.length} games for "Matchs du jour"`);

    return res.status(200).json({
      success: true,
      message: `Successfully set up ${updatedGames.length} LIVE games for "Matchs du jour"`,
      games: updatedGames,
      realGamesCount: realMatches.length,
      todaysGamesCount: todaysGames.length
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return res.status(500).json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
