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
    console.log('🔄 Updating live scores with real Football-Data.org API...');

    // Initialize Football-Data.org API
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY not found in environment variables');
    }

    const footballAPI = new FootballDataAPI(apiKey);

    // Get live matches from Football-Data.org
    const liveMatches = await footballAPI.getLiveMatches();
    
    // Also get recently finished matches from today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let finishedMatches: any[] = [];
    try {
      finishedMatches = await footballAPI.getMatchesByDateRange(todayStr, tomorrowStr);
      // Filter for finished matches only
      finishedMatches = finishedMatches.filter(match => match.status === 'FINISHED');
      console.log(`📊 Found ${finishedMatches.length} finished matches from today`);
    } catch (error) {
      console.log('⚠️ Could not fetch finished matches:', error);
    }
    
    // Combine live and finished matches
    const allExternalMatches = [...liveMatches, ...finishedMatches];
    console.log(`📊 Total external matches: ${allExternalMatches.length} (${liveMatches.length} live + ${finishedMatches.length} finished)`);
    
    // Get all LIVE games from our database
    const ourLiveGames = await prisma.game.findMany({
      where: {
        status: 'LIVE'
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    // If no external matches, check if we need to auto-finish old LIVE games
    if (allExternalMatches.length === 0) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const oldLiveGames = ourLiveGames.filter(game => 
        new Date(game.date) < twoHoursAgo
      );

      if (oldLiveGames.length > 0) {
        console.log(`🕐 Auto-finishing ${oldLiveGames.length} old LIVE games (older than 2 hours)`);
        
        const updatedGames = [];
        for (const game of oldLiveGames) {
          // Preserve existing final scores if they exist, otherwise use live scores
          // This prevents resetting scores to 0 when games already have final scores
          const finalHomeScore = game.homeScore !== null ? game.homeScore : (game.liveHomeScore || 0);
          const finalAwayScore = game.awayScore !== null ? game.awayScore : (game.liveAwayScore || 0);
          
          const updatedGame = await prisma.game.update({
            where: { id: game.id },
            data: {
              status: 'FINISHED',
              homeScore: finalHomeScore,
              awayScore: finalAwayScore,
              decidedBy: 'FT',
              finishedAt: new Date(),
              lastSyncAt: new Date()
            },
            include: {
              homeTeam: true,
              awayTeam: true
            }
          });

          updatedGames.push({
            id: updatedGame.id,
            homeTeam: updatedGame.homeTeam.name,
            awayTeam: updatedGame.awayTeam.name,
            oldHomeScore: game.homeScore !== null ? game.homeScore : (game.liveHomeScore || 0),
            oldAwayScore: game.awayScore !== null ? game.awayScore : (game.liveAwayScore || 0),
            newHomeScore: updatedGame.homeScore || 0,
            newAwayScore: updatedGame.awayScore || 0,
            status: updatedGame.status,
            externalStatus: 'AUTO_FINISHED',
            decidedBy: updatedGame.decidedBy,
            lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
            scoreChanged: false,
            statusChanged: true
          });
        }

        return res.status(200).json({
          success: true,
          message: `Auto-finished ${updatedGames.length} old LIVE games (no external matches found)`,
          updatedGames,
          totalLiveGames: ourLiveGames.length,
          externalMatchesFound: 0,
          processedMatches: 0,
          matchedGames: 0,
          attribution: footballAPI.getAttributionText(),
          apiVersion: 'v4',
          lastSync: new Date().toISOString(),
          hasUpdates: updatedGames.length > 0
        });
      }

      return res.status(200).json({
        success: true,
        message: 'No external matches found and no old games to auto-finish',
        updatedGames: [],
        totalLiveGames: ourLiveGames.length,
        externalMatchesFound: 0,
        processedMatches: 0,
        matchedGames: 0,
        attribution: footballAPI.getAttributionText(),
        apiVersion: 'v4',
        lastSync: new Date().toISOString(),
        hasUpdates: false
      });
    }

    console.log(`📊 Found ${allExternalMatches.length} external matches from Football-Data.org`);

    // Also get recently finished games (last 2 hours) to update their status
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentlyFinishedGames = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        date: {
          lt: twoHoursAgo
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    console.log(`📊 Found ${ourLiveGames.length} LIVE games and ${recentlyFinishedGames.length} potentially finished games`);

    console.log(`📊 Found ${ourLiveGames.length} LIVE games in our database`);

    const updatedGames: any[] = [];

    // Track which games we've updated from external data
    const updatedGameIds = new Set<string>();

    // Try to match external matches with our games using direct normalization
    let processedCount = 0;
    let matchedCount = 0;
    
    for (const externalMatch of allExternalMatches) {
      try {
        processedCount++;
        console.log(`🔍 Processing ${processedCount}/7: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
        
        // Get all our teams for advanced matching
        const allOurTeams = ourLiveGames.flatMap(game => [
          { id: game.homeTeam.id, name: game.homeTeam.name },
          { id: game.awayTeam.id, name: game.awayTeam.name }
        ]);

        // Use advanced matching for both teams
        const homeMatch = footballAPI.findBestTeamMatch(externalMatch.homeTeam.name, allOurTeams);
        const awayMatch = footballAPI.findBestTeamMatch(externalMatch.awayTeam.name, allOurTeams);

        if (!homeMatch || !awayMatch) {
          console.log(`⚠️ No team matches found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          console.log(`   Home match: ${homeMatch ? 'Found' : 'Not found'}`);
          console.log(`   Away match: ${awayMatch ? 'Found' : 'Not found'}`);
          continue;
        }

        // Find the game that contains both matched teams
        const matchingGame = ourLiveGames.find(game => 
          (game.homeTeam.id === homeMatch.team.id || game.awayTeam.id === homeMatch.team.id) &&
          (game.homeTeam.id === awayMatch.team.id || game.awayTeam.id === awayMatch.team.id)
        );

        if (!matchingGame) {
          console.log(`⚠️ No matching game found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          continue;
        }
        
        // Skip if we already processed this game (prevents duplicate processing when same game appears in both live and finished matches)
        if (updatedGameIds.has(matchingGame.id)) {
          console.log(`⏭️ Skipping already-processed game: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          continue;
        }
        
        // SAFETY: Skip games that are already FINISHED - API cannot update finished games
        // This protects finished games from API bugs and gives admin full control
        if (matchingGame.status === 'FINISHED') {
          console.log(`⏭️ Skipping already-finished game: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} (score: ${matchingGame.homeScore}-${matchingGame.awayScore})`);
          continue;
        }
        
        matchedCount++;
        console.log(`✅ Matched ${matchedCount}/7: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);

        console.log(`🎯 Found match: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} (External: ${externalMatch.status})`);

        // Get current scores
        const currentHomeScore = matchingGame.liveHomeScore || 0;
        const currentAwayScore = matchingGame.liveAwayScore || 0;

        // Get external scores - handle null values properly as per API docs
        // For live games, null scores mean the game hasn't scored yet
        let externalHomeScore = matchingGame.liveHomeScore;
        let externalAwayScore = matchingGame.liveAwayScore;
        
        // Only update scores if the external API has actual scores (not null)
        if (externalMatch.score.fullTime.home !== null) {
          externalHomeScore = externalMatch.score.fullTime.home;
        }
        if (externalMatch.score.fullTime.away !== null) {
          externalAwayScore = externalMatch.score.fullTime.away;
        }

        // Check if scores actually changed
        const homeScoreChanged = externalHomeScore !== matchingGame.liveHomeScore;
        const awayScoreChanged = externalAwayScore !== matchingGame.liveAwayScore;
        const scoresChanged = homeScoreChanged || awayScoreChanged;

        // Map external status to our status
        const newStatus = footballAPI.mapStatus(externalMatch.status);
        const newExternalStatus = externalMatch.status;

        // Only prepare update data if something actually changed
        const updateData: any = {
          externalStatus: newExternalStatus,
          status: newStatus,
          lastSyncAt: new Date()
        };

        // Only update scores if they actually changed
        if (scoresChanged) {
          updateData.liveHomeScore = externalHomeScore;
          updateData.liveAwayScore = externalAwayScore;
        }

        // If game is finished, also update final scores
        if (newStatus === 'FINISHED') {
          updateData.homeScore = externalHomeScore;
          updateData.awayScore = externalAwayScore;
          updateData.decidedBy = 'FT';
          updateData.finishedAt = new Date();
          console.log(`🏁 Game finished: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} - Final score: ${externalHomeScore}-${externalAwayScore}`);
        }

        // Update the game
        const updatedGame = await prisma.game.update({
          where: { id: matchingGame.id },
          data: updateData,
          include: {
            homeTeam: true,
            awayTeam: true
          }
        });

        updatedGameIds.add(matchingGame.id);

        // Only add to updatedGames if something actually changed
        if (scoresChanged || newStatus !== matchingGame.status) {
          updatedGames.push({
            id: updatedGame.id,
            homeTeam: updatedGame.homeTeam.name,
            awayTeam: updatedGame.awayTeam.name,
            oldHomeScore: currentHomeScore,
            oldAwayScore: currentAwayScore,
            newHomeScore: updatedGame.liveHomeScore,
            newAwayScore: updatedGame.liveAwayScore,
            status: updatedGame.status,
            externalStatus: updatedGame.externalStatus,
            decidedBy: updatedGame.decidedBy,
            lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
            scoreChanged: scoresChanged,
            statusChanged: newStatus !== matchingGame.status
          });
        }

        if (currentHomeScore !== updatedGame.liveHomeScore || currentAwayScore !== updatedGame.liveAwayScore) {
          console.log(`⚽ Score updated: ${updatedGame.homeTeam.name} ${currentHomeScore}-${currentAwayScore} → ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore} ${updatedGame.awayTeam.name}`);
        }
        
        if (matchingGame.status !== updatedGame.status) {
          console.log(`🔄 Status changed: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${matchingGame.status} → ${updatedGame.status}`);
        }

      } catch (error) {
        console.error(`❌ Error updating match ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}:`, error);
      }
    }

    // Check for LIVE games that might be finished but not in external API
    // (e.g., games that finished but aren't in today's external data)
    const remainingLiveGames = ourLiveGames.filter(game => !updatedGameIds.has(game.id));
    
    // Also check recently finished games
    const allGamesToCheck = [...remainingLiveGames, ...recentlyFinishedGames];
    
    for (const game of allGamesToCheck) {
      try {
        // Check if game should be finished based on time
        const gameDate = new Date(game.date);
        const now = new Date();
        const timeDiff = now.getTime() - gameDate.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // If game started more than 2 hours ago and is still LIVE, mark as FINISHED
        if (hoursDiff > 2 && game.status === 'LIVE') {
          console.log(`⏰ Game ${game.homeTeam.name} vs ${game.awayTeam.name} started ${hoursDiff.toFixed(1)} hours ago, marking as FINISHED`);
          
          // Preserve existing final scores if they exist, otherwise use live scores
          // This prevents resetting scores to 0 when games already have final scores
          const finalHomeScore = game.homeScore !== null ? game.homeScore : (game.liveHomeScore !== null ? game.liveHomeScore : 0);
          const finalAwayScore = game.awayScore !== null ? game.awayScore : (game.liveAwayScore !== null ? game.liveAwayScore : 0);
          
          const updateData: any = {
            status: 'FINISHED',
            externalStatus: 'FINISHED',
            decidedBy: 'FT',
            finishedAt: new Date(),
            lastSyncAt: new Date(),
            homeScore: finalHomeScore,
            awayScore: finalAwayScore
          };

          const updatedGame = await prisma.game.update({
            where: { id: game.id },
            data: updateData,
            include: {
              homeTeam: true,
              awayTeam: true
            }
          });

          updatedGames.push({
            id: updatedGame.id,
            homeTeam: updatedGame.homeTeam.name,
            awayTeam: updatedGame.awayTeam.name,
            oldHomeScore: game.homeScore !== null ? game.homeScore : (game.liveHomeScore || 0),
            oldAwayScore: game.awayScore !== null ? game.awayScore : (game.liveAwayScore || 0),
            newHomeScore: updatedGame.homeScore || 0,
            newAwayScore: updatedGame.awayScore || 0,
            status: updatedGame.status,
            externalStatus: updatedGame.externalStatus,
            decidedBy: updatedGame.decidedBy,
            lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
            scoreChanged: false,
            statusChanged: true
          });

          console.log(`🏁 Auto-finished: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${updatedGame.status}`);
        }
      } catch (error) {
        console.error(`❌ Error auto-finishing game ${game.id}:`, error);
      }
    }

    console.log(`✅ Successfully updated ${updatedGames.length} games with real data`);

        // If we have updates, log them (you can trigger refresh from your scheduler)
        if (updatedGames.length > 0) {
          console.log('🔔 Live score updates found - call /api/trigger-games-refresh to update frontend');
        }

        return res.status(200).json({
          success: true,
          message: `Successfully updated ${updatedGames.length} games with real Football-Data.org data`,
          updatedGames,
          totalLiveGames: ourLiveGames.length,
          externalMatchesFound: allExternalMatches.length,
          processedMatches: processedCount,
          matchedGames: matchedCount,
          attribution: footballAPI.getAttributionText(),
          apiVersion: 'v4',
          lastSync: new Date().toISOString(),
          hasUpdates: updatedGames.length > 0
        });

  } catch (error) {
    console.error('❌ Error updating live scores:', error);
    return res.status(500).json({ 
      error: 'Failed to update live scores',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}