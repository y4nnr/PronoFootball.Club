import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { ApiSportsV2 } from '../../lib/api-sports-api-v2';
import { API_CONFIG } from '../../lib/api-config';

// Helper function to update shooters for all users in a competition
async function updateShootersForCompetition(competitionId: string) {
  try {
    // Get all users in this competition
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: true }
    });

    // Get all finished/live games in this competition
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] }
      }
    });

    const totalGames = finishedGames.length;

    // Update shooters for each user
    for (const competitionUser of competitionUsers) {
      // Count how many games this user bet on in this competition
      const userBets = await prisma.bet.count({
        where: {
          userId: competitionUser.userId,
          game: {
            competitionId,
            status: { in: ['FINISHED', 'LIVE'] }
          }
        }
      });

      // Calculate shooters (forgotten bets)
      const shooters = totalGames - userBets;

      // Update the CompetitionUser record
      await prisma.competitionUser.update({
        where: { id: competitionUser.id },
        data: { shooters }
      });
    }
  } catch (error) {
    console.error('Error updating shooters for competition:', error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Disable caching for live scores
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    console.log('🔄 Updating live scores with API-Sports.io (V2)...');

    // Validate configuration
    const validation = API_CONFIG.validate();
    if (!validation.valid) {
      throw new Error(`Configuration error: ${validation.errors.join(', ')}`);
    }

    // Initialize API-Sports.io API
    const apiKey = API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      throw new Error('API-FOOTBALL not found in environment variables');
    }

    const apiSports = new ApiSportsV2(apiKey);

    // FIRST: Check database to see if there are any LIVE games before calling API
    // IMPORTANT: We ONLY check for LIVE games - another service handles UPCOMING -> LIVE transitions
    // We do NOT check for UPCOMING or FINISHED games to avoid unnecessary API calls
    // IMPORTANT: Filter by FOOTBALL only to avoid conflicts with rugby games
    const ourLiveGames = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        competition: {
          sportType: 'FOOTBALL'
        }
      },
      select: {
        id: true,
        status: true,
        externalId: true,
        externalStatus: true,
        homeScore: true,
        awayScore: true,
        liveHomeScore: true,
        liveAwayScore: true,
        elapsedMinute: true,
        date: true,
        lastSyncAt: true,
        competitionId: true,
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            sportType: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            sportType: true
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            sportType: true
          }
        }
      }
    });
    
    const hasLiveGames = ourLiveGames.length > 0;
    
    console.log(`📊 Database check: ${ourLiveGames.length} LIVE football games`);
    
    // If no LIVE games, skip API calls completely
    if (!hasLiveGames) {
      console.log('✅ No LIVE football games found in database. Skipping API calls to save quota.');
      return res.status(200).json({
        success: true,
        message: 'No LIVE football games to update',
        updatedGames: [],
        totalLiveGames: 0,
        externalMatchesFound: 0,
        processedMatches: 0,
        matchedGames: 0,
        attribution: apiSports.getAttributionText(),
        apiVersion: 'V2',
        lastSync: new Date().toISOString(),
        hasUpdates: false
      });
    }
    
    // Only call API if we have LIVE games
    console.log('🔄 Calling Football API to fetch live matches...');
    
    let liveMatches: any[] = [];
    try {
      liveMatches = await apiSports.getLiveMatches();
      console.log(`📊 API returned ${liveMatches.length} live football matches`);
    } catch (error) {
      console.log('⚠️ Could not fetch live football matches:', error);
    }
    
    // Also get finished matches from today for games that are LIVE but might have finished
    // (games with externalStatus FT/AET/PEN but still marked as LIVE in our DB)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let finishedMatches: any[] = [];
    // Only fetch finished matches if we have LIVE games (to catch games that finished but are still marked LIVE)
    try {
      finishedMatches = await apiSports.getMatchesByDateRange(todayStr, tomorrowStr);
      // Filter for finished matches only - check externalStatus (FT, AET, PEN) which map to FINISHED
      finishedMatches = finishedMatches.filter(match => 
        match.externalStatus === 'FT' || 
        match.externalStatus === 'AET' || 
        match.externalStatus === 'PEN'
      );
      console.log(`📊 Found ${finishedMatches.length} finished matches from today (to update LIVE games that finished)`);
    } catch (error) {
      console.log('⚠️ Could not fetch finished matches:', error);
    }
    
    // Combine live and finished matches
    let allExternalMatches = [...liveMatches, ...finishedMatches];
    console.log(`📊 Total external matches: ${allExternalMatches.length} (${liveMatches.length} live + ${finishedMatches.length} finished)`);
    
    // Always try fetching by ID if we have externalId (more reliable than date queries)
    const gamesWithExternalId = ourLiveGames.filter(game => game.externalId);
    if (gamesWithExternalId.length > 0) {
      console.log(`🔍 Found ${gamesWithExternalId.length} games with externalId, fetching by ID (more reliable)...`);
      const matchesById: any[] = [];
      for (const game of gamesWithExternalId) {
        try {
          const externalId = parseInt(game.externalId!);
          if (!isNaN(externalId)) {
            console.log(`🔍 Fetching match ID ${externalId} for ${game.homeTeam.name} vs ${game.awayTeam.name}...`);
            const matchById = await apiSports.getMatchById(externalId);
            if (matchById) {
              matchesById.push(matchById);
              console.log(`✅ Found match by ID: ${matchById.homeTeam.name} vs ${matchById.awayTeam.name} (status: ${matchById.externalStatus})`);
            } else {
              console.log(`⚠️ Match ID ${externalId} not found in API`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not fetch match ${game.externalId}:`, error);
        }
      }
      // Merge with existing matches (avoid duplicates)
      const existingIds = new Set(allExternalMatches.map(m => m.id));
      const newMatches = matchesById.filter(m => !existingIds.has(m.id));
      allExternalMatches = [...allExternalMatches, ...newMatches];
      console.log(`📊 Total external matches after ID lookup: ${allExternalMatches.length} (${newMatches.length} new from ID lookup)`);
    }

    // If no external matches, check if we need to auto-finish old LIVE games
    if (allExternalMatches.length === 0) {
      // Auto-finish after 3 hours to account for extra time and penalties (consistent with main auto-finish)
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const oldLiveGames = ourLiveGames.filter(game => 
        new Date(game.date) < threeHoursAgo
      );

      if (oldLiveGames.length > 0) {
        console.log(`🕐 Auto-finishing ${oldLiveGames.length} old LIVE games (older than 3 hours)`);
        
        const updatedGames = [];
        for (const game of oldLiveGames) {
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
              awayTeam: true,
              competition: true
            }
          });

          // Recalculate bets if game finished
          if (updatedGame.status === 'FINISHED' && finalHomeScore !== null && finalAwayScore !== null) {
            const competition = await prisma.competition.findUnique({
              where: { id: game.competitionId },
              select: { sportType: true }
            });
            
            const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
            const scoringSystem = getScoringSystemForSport(competition?.sportType || 'FOOTBALL');
            
            const bets = await prisma.bet.findMany({ where: { gameId: game.id } });
            for (const bet of bets) {
              const points = calculateBetPoints(
                { score1: bet.score1, score2: bet.score2 },
                { home: finalHomeScore, away: finalAwayScore },
                scoringSystem
              );
              await prisma.bet.update({ where: { id: bet.id }, data: { points } });
            }
            
            await updateShootersForCompetition(updatedGame.competitionId);
            console.log(`💰 Calculated points for ${bets.length} bets in auto-finished game ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`);
          }

          updatedGames.push({
            id: updatedGame.id,
            homeTeam: updatedGame.homeTeam.name,
            awayTeam: updatedGame.awayTeam.name,
            oldHomeScore: game.homeScore !== null ? game.homeScore : (game.liveHomeScore ?? 0),
            oldAwayScore: game.awayScore !== null ? game.awayScore : (game.liveAwayScore ?? 0),
            newHomeScore: updatedGame.homeScore ?? 0,
            newAwayScore: updatedGame.awayScore ?? 0,
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
          attribution: apiSports.getAttributionText(),
          apiVersion: 'V2',
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
        attribution: apiSports.getAttributionText(),
        apiVersion: 'V2',
        lastSync: new Date().toISOString(),
        hasUpdates: false
      });
    }

    console.log(`📊 Found ${allExternalMatches.length} external matches from API-Sports.io`);

    // Also get recently finished games (last 2 hours)
    // IMPORTANT: Filter by FOOTBALL only to avoid conflicts with rugby games
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentlyFinishedGames = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        date: {
          lt: twoHoursAgo
        },
        competition: {
          sportType: 'FOOTBALL'
        }
      },
      select: {
        id: true,
        status: true,
        externalId: true,
        externalStatus: true,
        homeScore: true,
        awayScore: true,
        liveHomeScore: true,
        liveAwayScore: true,
        elapsedMinute: true,
        date: true,
        lastSyncAt: true,
        competitionId: true,
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            sportType: true // Include sportType to verify teams are football teams
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            sportType: true // Include sportType to verify teams are football teams
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            sportType: true
          }
        }
      }
    });

    console.log(`📊 Found ${ourLiveGames.length} LIVE games and ${recentlyFinishedGames.length} potentially finished games`);
    
    // Combine LIVE games and recently finished games for matching
    // This ensures we can update games that are finished in the external API but still marked as LIVE in our DB
    // Note: We only check LIVE games - another part of the app handles UPCOMING -> LIVE transitions
    const allGamesToCheck = [...ourLiveGames, ...recentlyFinishedGames];
    console.log(`📊 Total games to check for updates: ${allGamesToCheck.length} (${ourLiveGames.length} LIVE + ${recentlyFinishedGames.length} potentially finished)`);
    
    // Verify that all teams are football teams
    const nonFootballTeams = allGamesToCheck.filter(game => 
      game.homeTeam.sportType !== 'FOOTBALL' || game.awayTeam.sportType !== 'FOOTBALL'
    );
    if (nonFootballTeams.length > 0) {
      console.log(`⚠️ WARNING: Found ${nonFootballTeams.length} football games with non-football teams:`);
      for (const game of nonFootballTeams) {
        console.log(`   - ${game.homeTeam.name} (${game.homeTeam.sportType}) vs ${game.awayTeam.name} (${game.awayTeam.sportType})`);
      }
    }

    const updatedGames: any[] = [];
    const updatedGameIds = new Set<string>();
    let processedCount = 0;
    let matchedCount = 0;
    
    // Get all teams from all games (LIVE + potentially finished) for matching
    // IMPORTANT: Only include teams that are actually football teams (sportType: 'FOOTBALL')
    // Include shortName for better matching (e.g., "Lyon" matches "Olympique Lyonnais")
    const allOurTeams = allGamesToCheck
      .filter(game => game.homeTeam.sportType === 'FOOTBALL' && game.awayTeam.sportType === 'FOOTBALL')
      .flatMap(game => [
        { id: game.homeTeam.id, name: game.homeTeam.name, shortName: game.homeTeam.shortName },
        { id: game.awayTeam.id, name: game.awayTeam.name, shortName: game.awayTeam.shortName }
      ]);
    
    // Remove duplicates
    const uniqueTeams = Array.from(
      new Map(allOurTeams.map(team => [team.id, team])).values()
    );
    
    console.log(`📊 Using ${uniqueTeams.length} unique football teams for matching (from ${allGamesToCheck.length} games)`);
    
    for (const externalMatch of allExternalMatches) {
      try {
        processedCount++;
        console.log(`🔍 Processing ${processedCount}/${allExternalMatches.length}: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name} (ID: ${externalMatch.id})`);

        // First, try to find game by externalId (most reliable)
        // But we'll verify it's correct before using it
        // Try both string and number comparison for externalId
        let matchingGameByExternalId = allGamesToCheck.find(game => {
          if (!game.externalId || game.competition.sportType !== 'FOOTBALL') return false;
          const gameExternalId = game.externalId.toString();
          const matchId = externalMatch.id.toString();
          return gameExternalId === matchId || gameExternalId === externalMatch.id.toString();
        });
        
        let matchingGame = matchingGameByExternalId;

        // If found by externalId, verify team names match (safety check)
        if (matchingGame) {
          console.log(`   ✅ Found game by externalId: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          
          // Verify team names match (safety check in case external ID is wrong)
          // Use strict matching: both teams must match reasonably well
          const normalizeForMatch = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
          const dbHomeNorm = normalizeForMatch(matchingGame.homeTeam.name);
          const apiHomeNorm = normalizeForMatch(externalMatch.homeTeam.name);
          const dbAwayNorm = normalizeForMatch(matchingGame.awayTeam.name);
          const apiAwayNorm = normalizeForMatch(externalMatch.awayTeam.name);
          
          // STRICT verification: Use the same team matching algorithm as team name matching
          // This ensures we catch cases where external ID is wrong
          const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, [matchingGame.homeTeam]);
          const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, [matchingGame.awayTeam]);
          
          // Also check reverse (API home vs DB away, API away vs DB home) in case teams are swapped
          const homeMatchReverse = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, [matchingGame.awayTeam]);
          const awayMatchReverse = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, [matchingGame.homeTeam]);
          
          // Teams must match correctly (home-home and away-away) OR be swapped (home-away and away-home)
          // AND the match score must be high (>= 0.8) to ensure it's a good match
          const teamsMatchCorrectly = homeMatch && awayMatch && 
                                     homeMatch.team.id === matchingGame.homeTeam.id && 
                                     awayMatch.team.id === matchingGame.awayTeam.id &&
                                     (homeMatch.score >= 0.8 && awayMatch.score >= 0.8);
          const teamsAreSwapped = homeMatchReverse && awayMatchReverse &&
                                 homeMatchReverse.team.id === matchingGame.awayTeam.id &&
                                 awayMatchReverse.team.id === matchingGame.homeTeam.id &&
                                 (homeMatchReverse.score >= 0.8 && awayMatchReverse.score >= 0.8);
          
          console.log(`   🔍 Team verification:`);
          console.log(`      Home match: ${homeMatch ? `${homeMatch.team.name} (ID: ${homeMatch.team.id}, score: ${homeMatch.score?.toFixed(2)})` : 'NOT FOUND'}`);
          console.log(`      Away match: ${awayMatch ? `${awayMatch.team.name} (ID: ${awayMatch.team.id}, score: ${awayMatch.score?.toFixed(2)})` : 'NOT FOUND'}`);
          console.log(`      Teams match correctly: ${teamsMatchCorrectly}, Teams swapped: ${teamsAreSwapped}`);
          
          // Additional check: if teams match but scores/elapsed are very different, external ID might be wrong
          // This catches cases where external ID points to a different game with same teams
          const dbHomeScore = matchingGame.liveHomeScore ?? 0;
          const dbAwayScore = matchingGame.liveAwayScore ?? 0;
          const apiHomeScore = externalMatch.score.fullTime.home ?? 0;
          const apiAwayScore = externalMatch.score.fullTime.away ?? 0;
          const scoreDiff = Math.abs(dbHomeScore - apiHomeScore) + Math.abs(dbAwayScore - apiAwayScore);
          const elapsedDiff = matchingGame.elapsedMinute !== null && externalMatch.elapsedMinute !== null
                            ? Math.abs(matchingGame.elapsedMinute - externalMatch.elapsedMinute)
                            : null;
          const significantScoreDiff = scoreDiff > 2; // More than 2 goal difference
          const significantElapsedDiff = elapsedDiff !== null && elapsedDiff > 10; // More than 10 minutes difference
          
          console.log(`   🔍 Data comparison:`);
          console.log(`      DB: ${dbHomeScore}-${dbAwayScore}, Elapsed: ${matchingGame.elapsedMinute ?? 'null'}`);
          console.log(`      API: ${apiHomeScore}-${apiAwayScore}, Elapsed: ${externalMatch.elapsedMinute ?? 'null'}`);
          console.log(`      Score diff: ${scoreDiff}, Elapsed diff: ${elapsedDiff ?? 'N/A'}`);
          console.log(`      Significant score diff: ${significantScoreDiff}, Significant elapsed diff: ${significantElapsedDiff}`);
          
          if (!teamsMatchCorrectly && !teamsAreSwapped) {
            console.log(`   ⚠️ WARNING: External ID ${matchingGame.externalId} matches but teams don't match!`);
            console.log(`      DB: ${matchingGame.homeTeam.name} (ID: ${matchingGame.homeTeam.id}) vs ${matchingGame.awayTeam.name} (ID: ${matchingGame.awayTeam.id})`);
            console.log(`      API: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            console.log(`   ⚠️ External ID ${matchingGame.externalId} is WRONG - will try team name matching instead`);
            // Force it to try team name matching by setting to null
            matchingGame = null as any;
          } else if (teamsMatchCorrectly || teamsAreSwapped) {
            // Teams match, but check if data is significantly different (wrong external ID)
            if (significantScoreDiff || significantElapsedDiff) {
              console.log(`   ⚠️ WARNING: External ID ${matchingGame.externalId} matches and teams match, but data is very different!`);
              console.log(`      DB Score: ${matchingGame.liveHomeScore ?? 0}-${matchingGame.liveAwayScore ?? 0}, API Score: ${externalMatch.score.fullTime.home ?? 0}-${externalMatch.score.fullTime.away ?? 0} (diff: ${scoreDiff})`);
              console.log(`      DB Elapsed: ${matchingGame.elapsedMinute ?? 'null'}, API Elapsed: ${externalMatch.elapsedMinute ?? 'null'} (diff: ${elapsedDiff ?? 'N/A'})`);
              console.log(`   ⚠️ External ID ${matchingGame.externalId} might be WRONG - will try team name matching to find correct game`);
              // Force it to try team name matching by setting to null
              matchingGame = null as any;
            } else {
              console.log(`   ✅ Team names verified: External ID ${matchingGame.externalId} is correct`);
            }
          }
        }

        // Always try team name matching to verify we have the right game
        // This catches cases where external ID matches but points to wrong game
        let matchingGameByTeamName: typeof matchingGame = null;
        
        console.log(`   Also trying team name matching to verify correct game...`);
        
        console.log(`   Our teams in DB: ${allOurTeams.map(t => t.name).join(', ')}`);

        // Use matching for both teams (only match against football teams)
        const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
        const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);

        console.log(`   Home match: ${homeMatch ? homeMatch.team.name : 'NOT FOUND'} (external: ${externalMatch.homeTeam.name})`);
        console.log(`   Away match: ${awayMatch ? awayMatch.team.name : 'NOT FOUND'} (external: ${externalMatch.awayTeam.name})`);

        if (homeMatch && awayMatch) {
          // Find the game that contains both matched teams
          // IMPORTANT: Verify that the matched game is actually a football game (double-check sportType)
          // Search in all games (LIVE + potentially finished) to catch games that finished in external API
          matchingGameByTeamName = allGamesToCheck.find(game => 
            (game.homeTeam.id === homeMatch.team.id || game.awayTeam.id === homeMatch.team.id) &&
            (game.homeTeam.id === awayMatch.team.id || game.awayTeam.id === awayMatch.team.id) &&
            game.competition.sportType === 'FOOTBALL' // Double-check: ensure it's a football competition
          );
          
          if (matchingGameByTeamName) {
            console.log(`   ✅ Found game by team name matching: ${matchingGameByTeamName.homeTeam.name} vs ${matchingGameByTeamName.awayTeam.name}`);
            console.log(`   Team name match external ID: ${matchingGameByTeamName.externalId}, API external ID: ${externalMatch.id}`);
            
            // If team name matching found a different game than external ID matching, prefer team name match
            // This catches cases where external ID is wrong
            if (matchingGame && matchingGame.id !== matchingGameByTeamName.id) {
              console.log(`   ⚠️ WARNING: External ID match (${matchingGame.id}) differs from team name match (${matchingGameByTeamName.id})!`);
              console.log(`   🔄 Preferring team name match - external ID ${matchingGame.externalId} is likely WRONG`);
              matchingGame = matchingGameByTeamName;
            } else if (!matchingGame) {
              matchingGame = matchingGameByTeamName;
            }
            
            // Update the external ID to the correct one if it's different
            if (matchingGame.externalId !== externalMatch.id.toString()) {
              console.log(`   🔄 Will update external ID from ${matchingGame.externalId} to ${externalMatch.id}`);
            }
          }
        }
        
        if (!matchingGame) {
          if (!homeMatch || !awayMatch) {
            console.log(`⚠️ No team matches found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          } else {
            console.log(`⚠️ No matching game found by team name for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          }
          continue;
        }

        if (!matchingGame) {
          console.log(`⚠️ No matching football game found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          console.log(`   Searched in ${allGamesToCheck.length} football games`);
          continue;
        }
        
        // Additional safety check: verify competition sportType
        if (matchingGame.competition.sportType !== 'FOOTBALL') {
          console.log(`⚠️ Skipping match ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} - competition is ${matchingGame.competition.sportType}, not FOOTBALL`);
          continue;
        }
        
        if (updatedGameIds.has(matchingGame.id)) {
          console.log(`⏭️ Skipping already-processed game: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          continue;
        }
        
        if (matchingGame.status === 'FINISHED') {
          console.log(`⏭️ Skipping already-finished game: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          continue;
        }
        
        matchedCount++;
        console.log(`✅ Matched ${matchedCount}/${allExternalMatches.length}: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
        console.log(`   External: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
        console.log(`   External score: ${externalMatch.score.fullTime.home}-${externalMatch.score.fullTime.away}`);
        console.log(`   External elapsed: ${externalMatch.elapsedMinute} min`);
        console.log(`   Current DB score: ${matchingGame.liveHomeScore ?? 0}-${matchingGame.liveAwayScore ?? 0}`);

        // Get external scores
        // IMPORTANT: During HT (half-time), some APIs may return null/0 for scores
        // We should preserve the last known score during HT, but still update if API provides valid score
        let externalHomeScore = matchingGame.liveHomeScore ?? 0;
        let externalAwayScore = matchingGame.liveAwayScore ?? 0;
        
        const isHalfTime = externalMatch.externalStatus === 'HT';
        const apiHomeScore = externalMatch.score.fullTime.home;
        const apiAwayScore = externalMatch.score.fullTime.away;
        
        console.log(`   🔍 API returned scores: ${apiHomeScore ?? 'null'}-${apiAwayScore ?? 'null'} (status: ${externalMatch.externalStatus})`);
        console.log(`   🔍 Current DB scores: ${matchingGame.liveHomeScore ?? 'null'}-${matchingGame.liveAwayScore ?? 'null'}`);
        console.log(`   🔍 Is Half-Time: ${isHalfTime}`);
        
        // Update if external score is a valid number
        // IMPORTANT: If API returns 0-0 but we have a non-zero score, preserve it (API bug during HT/transitions)
        // This prevents losing valid scores when API temporarily returns 0-0
        if (apiHomeScore !== null && apiHomeScore !== undefined) {
          // If API returns 0 but we have a non-zero score, preserve it
          // Exception: if game just started (elapsed < 2 min), allow 0-0 (legitimate start)
          const gameJustStarted = externalMatch.elapsedMinute !== null && externalMatch.elapsedMinute < 2;
          const apiReturnsZeroButWeHaveScore = apiHomeScore === 0 && (matchingGame.liveHomeScore ?? 0) > 0;
          
          if (apiReturnsZeroButWeHaveScore && !gameJustStarted) {
            console.log(`   ⚠️ API bug detected: preserving last known home score ${matchingGame.liveHomeScore} (API returned 0, status: ${externalMatch.externalStatus}, elapsed: ${externalMatch.elapsedMinute})`);
            externalHomeScore = matchingGame.liveHomeScore ?? 0;
          } else {
            externalHomeScore = apiHomeScore;
            console.log(`   ✅ Updating home score: ${matchingGame.liveHomeScore ?? 0} → ${externalHomeScore}`);
          }
        } else {
          console.log(`   ⚠️ API returned null/undefined for home score, keeping current: ${externalHomeScore}`);
        }
        
        if (apiAwayScore !== null && apiAwayScore !== undefined) {
          // If API returns 0 but we have a non-zero score, preserve it
          // Exception: if game just started (elapsed < 2 min), allow 0-0 (legitimate start)
          const gameJustStarted = externalMatch.elapsedMinute !== null && externalMatch.elapsedMinute < 2;
          const apiReturnsZeroButWeHaveScore = apiAwayScore === 0 && (matchingGame.liveAwayScore ?? 0) > 0;
          
          if (apiReturnsZeroButWeHaveScore && !gameJustStarted) {
            console.log(`   ⚠️ API bug detected: preserving last known away score ${matchingGame.liveAwayScore} (API returned 0, status: ${externalMatch.externalStatus}, elapsed: ${externalMatch.elapsedMinute})`);
            externalAwayScore = matchingGame.liveAwayScore ?? 0;
          } else {
            externalAwayScore = apiAwayScore;
            console.log(`   ✅ Updating away score: ${matchingGame.liveAwayScore ?? 0} → ${externalAwayScore}`);
          }
        } else {
          console.log(`   ⚠️ API returned null/undefined for away score, keeping current: ${externalAwayScore}`);
        }
        
        console.log(`   🔍 Final extracted scores BEFORE updateData: ${externalHomeScore}-${externalAwayScore}`);
        
        console.log(`   Final extracted scores: ${externalHomeScore}-${externalAwayScore}${isHalfTime ? ' (HT - preserved if needed)' : ''}`);

        // Check if scores changed
        const homeScoreChanged = externalHomeScore !== matchingGame.liveHomeScore;
        const awayScoreChanged = externalAwayScore !== matchingGame.liveAwayScore;
        const scoresChanged = homeScoreChanged || awayScoreChanged;

        // Check if elapsedMinute changed (for chronometer updates)
        const currentElapsed = (matchingGame as any).elapsedMinute;
        const elapsedChanged = externalMatch.elapsedMinute !== null && 
                               externalMatch.elapsedMinute !== undefined &&
                               externalMatch.elapsedMinute !== currentElapsed;

        // Map external status to our status
        const newStatus = externalMatch.status; // Already mapped by ApiSportsAPI
        const newExternalStatus = externalMatch.externalStatus; // Original external status (HT, 1H, 2H, etc.)
        const statusChanged = newStatus !== matchingGame.status;
        
        // IMPORTANT: Ensure that HT, 1H, 2H are always treated as LIVE, not FINISHED
        // This prevents matches in half-time from being incorrectly marked as finished
        if ((newExternalStatus === 'HT' || newExternalStatus === '1H' || newExternalStatus === '2H') && newStatus === 'FINISHED') {
          console.log(`⚠️ External status is ${newExternalStatus} (LIVE) but mapping returned FINISHED - correcting to LIVE`);
          newStatus = 'LIVE';
        }
        
        console.log(`   Status check: current=${matchingGame.status}, new=${newStatus}, external=${newExternalStatus}, changed=${statusChanged}`);

        // Always update for LIVE games to sync chronometer even if nothing changed
        // This ensures elapsedMinute is always up-to-date

        // Prepare update data
        const updateData: any = {
          externalId: externalMatch.id.toString(), // Store external ID for future direct lookups
          externalStatus: newExternalStatus,
          status: newStatus,
          lastSyncAt: new Date()
        };

        // Always update scores (even if same, to ensure sync)
        // Use the extracted scores (already handled HT preservation logic above)
        updateData.liveHomeScore = externalHomeScore;
        updateData.liveAwayScore = externalAwayScore;
        console.log(`   📝 Final updateData scores: liveHomeScore = ${updateData.liveHomeScore}, liveAwayScore = ${updateData.liveAwayScore}`);

        // V2: Add elapsedMinute if available, but NOT during half-time (HT)
        // During half-time, elapsedMinute should be null to show "MT" badge
        if (newExternalStatus === 'HT') {
          // Half-time: set elapsedMinute to null to show "MT" badge
          updateData.elapsedMinute = null;
          console.log(`   ⏱️ Half-time (HT) - setting elapsedMinute to null to show MT badge`);
        } else if (externalMatch.elapsedMinute !== null && externalMatch.elapsedMinute !== undefined) {
          // Validate elapsedMinute makes sense for the status
          let elapsedMinute = externalMatch.elapsedMinute;
          
          // For 2H (second half), elapsedMinute should be 45+ (45 minutes first half + minutes into second half)
          // If API returns something suspicious (like 59' when game just started 2H), validate it
          if (newExternalStatus === '2H') {
            // Second half: elapsedMinute should be between 45 and ~105 (45 + 60 max)
            // If it's less than 45, it's probably wrong (should be in 1H)
            // If it's way too high (>105), it's probably wrong
            if (elapsedMinute < 45) {
              console.log(`   ⚠️ Suspicious elapsedMinute for 2H: ${elapsedMinute}' (should be ≥45). Using 45 as minimum.`);
              elapsedMinute = 45;
            } else if (elapsedMinute > 105) {
              console.log(`   ⚠️ Suspicious elapsedMinute for 2H: ${elapsedMinute}' (seems too high). Capping at 105.`);
              elapsedMinute = 105;
            }
          } else if (newExternalStatus === '1H') {
            // First half: elapsedMinute should be between 0 and ~50 (45 + 5 injury time max)
            if (elapsedMinute > 50) {
              console.log(`   ⚠️ Suspicious elapsedMinute for 1H: ${elapsedMinute}' (should be ≤50). Capping at 50.`);
              elapsedMinute = 50;
            }
          }
          
          const previousElapsed = (matchingGame as any).elapsedMinute;
          updateData.elapsedMinute = elapsedMinute;
          if (previousElapsed !== elapsedMinute) {
            console.log(`   ⏱️ Chronometer updated: ${previousElapsed ?? 'null'}' → ${elapsedMinute}' (status: ${newExternalStatus})`);
          } else {
            console.log(`   ⏱️ Chronometer unchanged: ${elapsedMinute}' (status: ${newExternalStatus}, API may not be updating in real-time)`);
          }
        } else {
          console.log(`   ⏱️ No elapsedMinute in external match (value: ${externalMatch.elapsedMinute}, status: ${newExternalStatus})`);
        }

        // If game is finished, also update final scores
        if (newStatus === 'FINISHED') {
          console.log(`🏁 Game is FINISHED - updating status from ${matchingGame.status} to ${newStatus}`);
          updateData.homeScore = externalHomeScore;
          updateData.awayScore = externalAwayScore;
          // Determine decidedBy based on external status:
          // - FT: match ended at 90 minutes
          // - AET: match ended after extra time (120 minutes)
          // - PEN: match went to penalties, but we use the 120-minute score (recorded as AET)
          if (newExternalStatus === 'AET') {
            updateData.decidedBy = 'AET'; // 120 minutes
          } else if (newExternalStatus === 'PEN') {
            // Match went to penalties, but we use the 120-minute score (not penalty score)
            updateData.decidedBy = 'AET'; // Recorded as AET since we use 120-minute score
            console.log(`⚽ Match went to penalties, using 120-minute score (not penalty score): ${externalHomeScore}-${externalAwayScore}`);
          } else {
            updateData.decidedBy = 'FT'; // 90 minutes
          }
          updateData.finishedAt = new Date();
          console.log(`🏁 Game finished: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} - Final score: ${externalHomeScore}-${externalAwayScore} (${updateData.decidedBy})`);
        } else if (matchingGame.status === 'LIVE' && newStatus === 'LIVE') {
          console.log(`   Game still LIVE: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} (external: ${newExternalStatus})`);
        }

        // Update the game
        console.log(`   Updating game with data:`, JSON.stringify(updateData, null, 2));
        let updatedGame;
        try {
          updatedGame = await prisma.game.update({
            where: { id: matchingGame.id },
            data: updateData,
            include: {
              homeTeam: true,
              awayTeam: true,
              competition: true
            }
          });
          console.log(`   ✅ Game updated successfully`);
          console.log(`   🔍 Verification - Updated game scores: ${updatedGame.liveHomeScore ?? 'null'}-${updatedGame.liveAwayScore ?? 'null'}`);
          console.log(`   🔍 Verification - UpdateData scores were: ${updateData.liveHomeScore}-${updateData.liveAwayScore}`);
          
          // Double-check: verify the update actually persisted
          const verifyGame = await prisma.game.findUnique({
            where: { id: matchingGame.id },
            select: { liveHomeScore: true, liveAwayScore: true }
          });
          if (verifyGame) {
            console.log(`   🔍 Verification - Database after update: ${verifyGame.liveHomeScore ?? 'null'}-${verifyGame.liveAwayScore ?? 'null'}`);
            if (verifyGame.liveHomeScore !== updateData.liveHomeScore || verifyGame.liveAwayScore !== updateData.liveAwayScore) {
              console.error(`   ❌ CRITICAL: Update did not persist! Expected ${updateData.liveHomeScore}-${updateData.liveAwayScore}, got ${verifyGame.liveHomeScore}-${verifyGame.liveAwayScore}`);
            }
          }
        } catch (updateError: any) {
          console.error(`   ❌ Error updating game:`, updateError?.message || updateError);
          throw updateError;
        }

        // Recalculate bets if game finished
        if (newStatus === 'FINISHED' && externalHomeScore !== null && externalAwayScore !== null) {
          // Get competition to determine sport type and scoring system
          const competition = await prisma.competition.findUnique({
            where: { id: matchingGame.competitionId },
            select: { sportType: true }
          });
          
          const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
          const scoringSystem = getScoringSystemForSport(competition?.sportType || 'FOOTBALL');
          
          const bets = await prisma.bet.findMany({ where: { gameId: matchingGame.id } });
          for (const bet of bets) {
            const points = calculateBetPoints(
              { score1: bet.score1, score2: bet.score2 },
              { home: externalHomeScore, away: externalAwayScore },
              scoringSystem
            );
            await prisma.bet.update({ where: { id: bet.id }, data: { points } });
          }
          
          await updateShootersForCompetition(updatedGame.competitionId);
          console.log(`💰 Calculated points for ${bets.length} bets in game ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} (${scoringSystem})`);
        }

        updatedGameIds.add(matchingGame.id);

        // Always add to updatedGames if we updated the game (for LIVE games, always update to sync chronometer)
        // This ensures the frontend gets the latest elapsedMinute even if scores haven't changed
        if (!updatedGames.find(g => g.id === updatedGame.id)) {
          updatedGames.push({
            id: updatedGame.id,
            homeTeam: updatedGame.homeTeam.name,
            awayTeam: updatedGame.awayTeam.name,
            oldHomeScore: matchingGame.liveHomeScore ?? 0,
            oldAwayScore: matchingGame.liveAwayScore ?? 0,
            newHomeScore: updatedGame.liveHomeScore ?? 0,
            newAwayScore: updatedGame.liveAwayScore ?? 0,
            elapsedMinute: updatedGame.elapsedMinute,
            status: updatedGame.status,
            externalStatus: updatedGame.externalStatus,
            decidedBy: updatedGame.decidedBy,
            lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
            scoreChanged: scoresChanged,
            statusChanged: newStatus !== matchingGame.status
          });
        }

        if (scoresChanged) {
          console.log(`⚽ Score updated: ${updatedGame.homeTeam.name} ${matchingGame.liveHomeScore || 0}-${matchingGame.liveAwayScore || 0} → ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore} ${updatedGame.awayTeam.name}`);
        }
        
        if (externalMatch.elapsedMinute !== null) {
          console.log(`⏱️ Chronometer: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${externalMatch.elapsedMinute}'`);
        }
        
        if (matchingGame.status !== updatedGame.status) {
          console.log(`🔄 Status changed: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${matchingGame.status} → ${updatedGame.status}`);
        }

      } catch (error) {
        console.error(`❌ Error updating match ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}:`, error);
      }
    }

    // Auto-finish old LIVE games
    const remainingLiveGames = ourLiveGames.filter(game => !updatedGameIds.has(game.id));
    const remainingRecentlyFinished = recentlyFinishedGames.filter(game => !updatedGameIds.has(game.id));
    const remainingGamesToCheck = [...remainingLiveGames, ...remainingRecentlyFinished];
    const uniqueGamesToCheck = remainingGamesToCheck.filter((game, index, self) => 
      index === self.findIndex(g => g.id === game.id)
    );
    
    for (const game of uniqueGamesToCheck) {
      try {
        const gameDate = new Date(game.date);
        const now = new Date();
        const timeDiff = now.getTime() - gameDate.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Auto-finish after 3 hours to account for extra time and penalties
        // Normal match: ~90min + stoppage time + half-time = ~2h
        // Extra time match: ~120min + stoppage time + breaks = ~2h30-2h45
        // Extra time + penalties: can go up to ~3h
        if (hoursDiff > 3 && game.status === 'LIVE') {
          console.log(`⏰ Game ${game.homeTeam.name} vs ${game.awayTeam.name} started ${hoursDiff.toFixed(1)} hours ago, marking as FINISHED`);
          
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
              awayTeam: true,
              competition: true
            }
          });

          // Recalculate bets
          if (updatedGame.status === 'FINISHED' && finalHomeScore !== null && finalAwayScore !== null) {
            // Get competition to determine sport type and scoring system
            const competition = await prisma.competition.findUnique({
              where: { id: game.competitionId },
              select: { sportType: true }
            });
            
            const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
            const scoringSystem = getScoringSystemForSport(competition?.sportType || 'FOOTBALL');
            
            const bets = await prisma.bet.findMany({ where: { gameId: game.id } });
            for (const bet of bets) {
              const points = calculateBetPoints(
                { score1: bet.score1, score2: bet.score2 },
                { home: finalHomeScore, away: finalAwayScore },
                scoringSystem
              );
              await prisma.bet.update({ where: { id: bet.id }, data: { points } });
            }
            
            await updateShootersForCompetition(updatedGame.competitionId);
            console.log(`💰 Calculated points for ${bets.length} bets in auto-finished game ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`);
          }

          if (!updatedGames.find(g => g.id === updatedGame.id)) {
            updatedGames.push({
              id: updatedGame.id,
              homeTeam: updatedGame.homeTeam.name,
              awayTeam: updatedGame.awayTeam.name,
              oldHomeScore: game.homeScore !== null ? game.homeScore : (game.liveHomeScore ?? 0),
              oldAwayScore: game.awayScore !== null ? game.awayScore : (game.liveAwayScore ?? 0),
              newHomeScore: updatedGame.homeScore ?? 0,
              newAwayScore: updatedGame.awayScore ?? 0,
              status: updatedGame.status,
              externalStatus: updatedGame.externalStatus,
              decidedBy: updatedGame.decidedBy,
              lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
              scoreChanged: false,
              statusChanged: true
            });
          }

          console.log(`🏁 Auto-finished: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${updatedGame.status}`);
        }
      } catch (error) {
        console.error(`❌ Error auto-finishing game ${game.id}:`, error);
      }
    }

    console.log(`✅ Successfully updated ${updatedGames.length} games with API-Sports.io data`);

    if (updatedGames.length > 0) {
      console.log('🔔 Live score updates found - call /api/trigger-games-refresh to update frontend');
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedGames.length} games with API-Sports.io data`,
      updatedGames,
      totalLiveGames: ourLiveGames.length,
      externalMatchesFound: allExternalMatches.length,
      processedMatches: processedCount,
      matchedGames: matchedCount,
      attribution: apiSports.getAttributionText(),
      apiVersion: 'V2',
      lastSync: new Date().toISOString(),
      hasUpdates: updatedGames.length > 0
    });

  } catch (error) {
    console.error('❌ Error updating live scores with API-Sports.io:', error);
    return res.status(500).json({ 
      error: 'Failed to update live scores',
      details: error instanceof Error ? error.message : 'Unknown error',
      apiVersion: 'V2'
    });
  }
}

