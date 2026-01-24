/**
 * Update Live Scores for Rugby - API-Sports.io Rugby API
 * 
 * This endpoint updates live rugby match scores using the api-sports.io Rugby API
 * Similar to update-live-scores-v2.ts but for Rugby matches
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { RugbyAPI } from '../../lib/api-rugby-v1';
import { API_CONFIG } from '../../lib/api-config';

// Helper function to update shooters for all users in a competition
async function updateShootersForCompetition(competitionId: string) {
  try {
    // Get all users in this competition
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: true }
    });

    for (const compUser of competitionUsers) {
      // Count exact score predictions (3 points) for this user in this competition
      const exactScores = await prisma.bet.count({
        where: {
          userId: compUser.userId,
          game: {
            competitionId,
            status: 'FINISHED'
          },
          points: 3
        }
      });

      // Update shooters count
      await prisma.competitionUser.update({
        where: { id: compUser.id },
        data: { shooters: exactScores }
      });
    }
  } catch (error) {
    console.error(`Error updating shooters for competition ${competitionId}:`, error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Updating live rugby scores with API-Sports.io...');
    const validation = API_CONFIG.validate();
    if (!validation.valid) {
      throw new Error(`Configuration error: ${validation.errors.join(', ')}`);
    }
    const apiKey = API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      throw new Error('API-FOOTBALL not found in environment variables');
    }
    const rugbyAPI = new RugbyAPI(apiKey);

    // FIRST: Check database to see if there are any LIVE games before calling API
    // IMPORTANT: We ONLY check for LIVE games - another service handles UPCOMING -> LIVE transitions
    // We do NOT check for UPCOMING or FINISHED games to avoid unnecessary API calls
    const ourLiveGames = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        competition: {
          sportType: 'RUGBY'
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });
    
    // Check for games that might have finished recently (LIVE but with FT/AET/PEN status)
    const gamesNeedingUpdate = ourLiveGames.filter(game => 
      game.externalStatus === 'FT' || game.externalStatus === 'AET' || game.externalStatus === 'PEN'
    );
    
    const hasLiveGames = ourLiveGames.length > 0;
    
    console.log(`📊 Database check: ${ourLiveGames.length} LIVE rugby games`);
    
    // If no LIVE games, skip API calls completely
    if (!hasLiveGames) {
      console.log('✅ No LIVE rugby games found in database. Skipping API calls to save quota.');
      return res.status(200).json({
        success: true,
        message: 'No LIVE rugby games to update',
        updatedGames: [],
        totalLiveGames: 0,
        externalMatchesFound: 0,
        processedMatches: 0,
        matchedGames: 0,
        attribution: rugbyAPI.getAttributionText(),
        apiVersion: 'RUGBY',
        lastSync: new Date().toISOString(),
        hasUpdates: false
      });
    }
    
    // Only call API if we have LIVE games
    console.log('🔄 Calling Rugby API to fetch live matches...');
    
    let liveMatches: any[] = [];
    try {
      liveMatches = await rugbyAPI.getLiveMatches();
      console.log(`📊 API returned ${liveMatches.length} live rugby matches`);
    } catch (error) {
      console.log('⚠️ Could not fetch live rugby matches:', error);
    }
    
    // Also get finished matches from today/yesterday/tomorrow for games that are LIVE but might have finished
    // (games with externalStatus FT/AET/PEN but still marked as LIVE in our DB)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let finishedMatches: any[] = [];
    // Only fetch finished matches if we have LIVE games (to catch games that finished but are still marked LIVE)
    try {
      // Get matches from yesterday, today, and tomorrow to catch all recent finished games
      const allRecentMatches = await rugbyAPI.getMatchesByDateRange(yesterdayStr, tomorrowStr);
      // Filter for finished matches only - check externalStatus (FT, AET, PEN) which map to FINISHED
      finishedMatches = allRecentMatches.filter(match => 
        match.externalStatus === 'FT' || 
        match.externalStatus === 'AET' || 
        match.externalStatus === 'PEN'
      );
      console.log(`📊 Found ${finishedMatches.length} finished rugby matches from yesterday/today/tomorrow (to update LIVE games that finished)`);
    } catch (error) {
      console.log('⚠️ Could not fetch finished rugby matches:', error);
    }
    
    // Also get finished matches from competitions of LIVE games using getFixturesByCompetition
    // This is more reliable as it gets ALL games from the competition, including finished ones
    // BUT only if we have LIVE games
    if (hasLiveGames) {
      try {
        const activeCompetitions = await prisma.competition.findMany({
          where: {
            sportType: 'RUGBY',
            games: {
              some: {
                status: 'LIVE'
              }
            }
          },
          select: {
            id: true,
            name: true,
            externalSeason: true
          },
          distinct: ['id']
        });
        
        console.log(`📊 Found ${activeCompetitions.length} active rugby competitions with LIVE games`);
        
        for (const competition of activeCompetitions) {
          // Try to determine competition external ID from name
          // Top 14 = 16, Pro D2 = ? (need to check)
          let competitionExternalId: number | null = null;
          if (competition.name.includes('Top 14')) {
            competitionExternalId = 16;
          }
          // Add more competitions as needed
          
          if (competitionExternalId && competition.externalSeason) {
            try {
              console.log(`   Fetching all fixtures for ${competition.name} (ID: ${competitionExternalId}, Season: ${competition.externalSeason})...`);
              const fixtures = await rugbyAPI.getFixturesByCompetition(competitionExternalId, competition.externalSeason);
              
              // Convert RugbyFixture[] to RugbyMatch[] using mapFixturesToMatches (private method)
              const matches = (rugbyAPI as any).mapFixturesToMatches(fixtures);
              
              // Filter for finished matches only
              const finishedFromCompetition = matches.filter((match: any) => 
                match.externalStatus === 'FT' || 
                match.externalStatus === 'AET' || 
                match.externalStatus === 'PEN'
              );
              
              console.log(`   Found ${finishedFromCompetition.length} finished matches in ${competition.name}`);
              
              // Add to finishedMatches (avoid duplicates by ID)
              const existingIds = new Set(finishedMatches.map(m => m.id));
              const newFinished = finishedFromCompetition.filter((m: any) => !existingIds.has(m.id));
              finishedMatches = [...finishedMatches, ...newFinished];
              console.log(`   Added ${newFinished.length} new finished matches from ${competition.name}`);
            } catch (error) {
              console.log(`   ⚠️ Could not fetch fixtures for ${competition.name}:`, error);
            }
          }
        }
        
        console.log(`📊 Total finished matches after competition lookup: ${finishedMatches.length}`);
      } catch (error) {
        console.log('⚠️ Could not fetch finished matches from competitions:', error);
      }
    } else {
      console.log('⏭️ Skipping getFixturesByCompetition() - no LIVE games in database');
    }
    
    // Combine live and finished matches
    let allExternalMatches = [...liveMatches, ...finishedMatches];
    console.log(`📊 Total external rugby matches: ${allExternalMatches.length} (${liveMatches.length} live + ${finishedMatches.length} finished)`);
    
    // Always try fetching by ID if we have externalId (more reliable than date queries)
    // Also check for games with externalStatus FT but still LIVE (need to be updated to FINISHED)
    const gamesWithExternalId = ourLiveGames.filter(game => game.externalId);
    
    // gamesNeedingUpdate was already defined above, reuse it
    if (gamesWithExternalId.length > 0 || gamesNeedingUpdate.length > 0) {
      console.log(`🔍 Found ${gamesWithExternalId.length} rugby games with externalId, ${gamesNeedingUpdate.length} needing update (FT/AET/PEN but still LIVE)`);
      const matchesById: any[] = [];
      const gamesToFetch = new Set([...gamesWithExternalId, ...gamesNeedingUpdate]);
      
      for (const game of gamesToFetch) {
        if (!game.externalId) {
          console.log(`⚠️ Game ${game.homeTeam.name} vs ${game.awayTeam.name} needs update but has no externalId`);
          continue;
        }
        
        try {
          const externalId = parseInt(game.externalId!);
          if (!isNaN(externalId)) {
            console.log(`🔍 Fetching rugby match ID ${externalId} for ${game.homeTeam.name} vs ${game.awayTeam.name} (current status: ${game.status}, external: ${game.externalStatus})...`);
            const matchById = await rugbyAPI.getMatchById(externalId);
            if (matchById) {
              matchesById.push(matchById);
              console.log(`✅ Found rugby match by ID: ${matchById.homeTeam.name} vs ${matchById.awayTeam.name} (status: ${matchById.externalStatus}, score: ${matchById.score?.home}-${matchById.score?.away})`);
            } else {
              console.log(`⚠️ Rugby match ID ${externalId} not found in API`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not fetch rugby match ${game.externalId}:`, error);
        }
      }
      // Merge with existing matches (avoid duplicates)
      const existingIds = new Set(allExternalMatches.map(m => m.id));
      const newMatches = matchesById.filter(m => !existingIds.has(m.id));
      allExternalMatches = [...allExternalMatches, ...newMatches];
      console.log(`📊 Total external rugby matches after ID lookup: ${allExternalMatches.length} (${newMatches.length} new from ID lookup)`);
    }

    // If no external matches, check if we need to auto-finish old LIVE games
    if (allExternalMatches.length === 0) {
      // Auto-finish after 4 hours for rugby (longer than football due to longer match duration + breaks)
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const oldLiveGames = ourLiveGames.filter(game => 
        new Date(game.date) < fourHoursAgo
      );

      if (oldLiveGames.length > 0) {
        console.log(`🕐 Auto-finishing ${oldLiveGames.length} old LIVE rugby games (older than 4 hours)`);
        
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
            const scoringSystem = getScoringSystemForSport(competition?.sportType || 'RUGBY');
            
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
            console.log(`💰 Calculated points for ${bets.length} bets in auto-finished rugby game ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`);
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
          message: `Auto-finished ${updatedGames.length} old LIVE rugby games (no external matches found)`,
          updatedGames,
          totalLiveGames: ourLiveGames.length,
          externalMatchesFound: 0,
          processedMatches: 0,
          matchedGames: 0,
          attribution: rugbyAPI.getAttributionText(),
          apiVersion: 'RUGBY',
          lastSync: new Date().toISOString(),
          hasUpdates: updatedGames.length > 0
        });
      }

      return res.status(200).json({
        success: true,
        message: 'No external rugby matches found and no old games to auto-finish',
        updatedGames: [],
        totalLiveGames: ourLiveGames.length,
        externalMatchesFound: 0,
        processedMatches: 0,
        matchedGames: 0,
        attribution: rugbyAPI.getAttributionText(),
        apiVersion: 'RUGBY',
        lastSync: new Date().toISOString(),
        hasUpdates: false
      });
    }

    console.log(`📊 Found ${allExternalMatches.length} external rugby matches from API-Sports.io`);

    // Also get recently finished games (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentlyFinishedGames = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        date: {
          lt: twoHoursAgo
        },
        competition: {
          sportType: 'RUGBY'
        }
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            sportType: true // Include sportType to verify teams are rugby teams
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            sportType: true // Include sportType to verify teams are rugby teams
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

    console.log(`📊 Found ${ourLiveGames.length} LIVE rugby games and ${recentlyFinishedGames.length} potentially finished games`);
    
    // Combine LIVE games and recently finished games for matching
    const allGamesToCheck = [...ourLiveGames, ...recentlyFinishedGames];
    console.log(`📊 Total rugby games to check for updates: ${allGamesToCheck.length} (${ourLiveGames.length} LIVE + ${recentlyFinishedGames.length} potentially finished)`);
    
    // Verify that all teams are rugby teams
    const nonRugbyTeams = allGamesToCheck.filter(game => 
      game.homeTeam.sportType !== 'RUGBY' || game.awayTeam.sportType !== 'RUGBY'
    );
    if (nonRugbyTeams.length > 0) {
      console.log(`⚠️ WARNING: Found ${nonRugbyTeams.length} rugby games with non-rugby teams:`);
      for (const game of nonRugbyTeams) {
        console.log(`   - ${game.homeTeam.name} (${game.homeTeam.sportType}) vs ${game.awayTeam.name} (${game.awayTeam.sportType})`);
      }
    }

    const updatedGames: any[] = [];
    const updatedGameIds = new Set<string>();
    let processedCount = 0;
    let matchedCount = 0;
    
    // Get all teams from all games (LIVE + potentially finished) for matching
    // IMPORTANT: Only include teams that are actually rugby teams (sportType: 'RUGBY')
    const allOurTeams = allGamesToCheck
      .filter(game => game.homeTeam.sportType === 'RUGBY' && game.awayTeam.sportType === 'RUGBY')
      .flatMap(game => [
        { id: game.homeTeam.id, name: game.homeTeam.name, shortName: (game.homeTeam as any).shortName },
        { id: game.awayTeam.id, name: game.awayTeam.name, shortName: (game.awayTeam as any).shortName }
      ]);
    
    // Remove duplicates
    const uniqueTeams = Array.from(
      new Map(allOurTeams.map(team => [team.id, team])).values()
    );
    
    console.log(`📊 Using ${uniqueTeams.length} unique rugby teams for matching (from ${allGamesToCheck.length} games)`);
    
    // First, try to match games with externalStatus FT/AET/PEN that are still LIVE
    // These should be in finishedMatches - let's match them explicitly
    const gamesNeedingFinish = allGamesToCheck.filter(game => 
      game.status === 'LIVE' && 
      (game.externalStatus === 'FT' || game.externalStatus === 'AET' || game.externalStatus === 'PEN')
    );
    
    if (gamesNeedingFinish.length > 0) {
      console.log(`🔍 Found ${gamesNeedingFinish.length} games with externalStatus FT/AET/PEN but still LIVE - checking if they're in finishedMatches...`);
      
      for (const game of gamesNeedingFinish) {
        // Try to find this game in finishedMatches by externalId or team names
        const finishedMatch = finishedMatches.find(fm => {
          if (game.externalId && fm.id.toString() === game.externalId) {
            return true;
          }
          // Try team name matching
          const homeMatch = rugbyAPI.findBestTeamMatch(fm.homeTeam.name, [
            { id: game.homeTeam.id, name: game.homeTeam.name, shortName: (game.homeTeam as any).shortName },
            { id: game.awayTeam.id, name: game.awayTeam.name, shortName: (game.awayTeam as any).shortName }
          ]);
          const awayMatch = rugbyAPI.findBestTeamMatch(fm.awayTeam.name, [
            { id: game.homeTeam.id, name: game.homeTeam.name, shortName: (game.homeTeam as any).shortName },
            { id: game.awayTeam.id, name: game.awayTeam.name, shortName: (game.awayTeam as any).shortName }
          ]);
          
          if (homeMatch && awayMatch) {
            const homeMatches = (homeMatch.team.id === game.homeTeam.id && awayMatch.team.id === game.awayTeam.id);
            const awayMatches = (homeMatch.team.id === game.awayTeam.id && awayMatch.team.id === game.homeTeam.id);
            return homeMatches || awayMatches;
          }
          return false;
        });
        
        if (finishedMatch) {
          console.log(`✅ Found finished match in API for ${game.homeTeam.name} vs ${game.awayTeam.name} - will be updated in normal flow`);
          // Add to allExternalMatches if not already there
          const existingMatch = allExternalMatches.find(m => m.id === finishedMatch.id);
          if (!existingMatch) {
            allExternalMatches.push(finishedMatch);
            console.log(`   Added to allExternalMatches for processing`);
          }
        } else {
          console.log(`⚠️ Game ${game.homeTeam.name} vs ${game.awayTeam.name} has externalStatus ${game.externalStatus} but not found in finishedMatches from API`);
          console.log(`   This might mean the API no longer returns this match, or it's too old`);
        }
      }
    }
    
    for (const externalMatch of allExternalMatches) {
      try {
        processedCount++;
        console.log(`🔍 Processing ${processedCount}/${allExternalMatches.length}: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name} (ID: ${externalMatch.id})`);

        // First, try to find game by externalId (most reliable)
        let matchingGame = allGamesToCheck.find(game => 
          game.externalId === externalMatch.id.toString() &&
          game.competition.sportType === 'RUGBY'
        );

        // If found by externalId, verify team names match (external IDs can be reused or point to wrong games)
        if (matchingGame) {
          console.log(`   Found potential match by externalId: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          
          // CRITICAL: Verify team names match
          const homeMatch = rugbyAPI.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
          const awayMatch = rugbyAPI.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);
          
          // Both teams must match the externalIdMatch game
          const homeMatchesGame = homeMatch && (
            homeMatch.team.id === matchingGame.homeTeam.id || 
            homeMatch.team.id === matchingGame.awayTeam.id
          );
          const awayMatchesGame = awayMatch && (
            awayMatch.team.id === matchingGame.homeTeam.id || 
            awayMatch.team.id === matchingGame.awayTeam.id
          );
          
          if (!homeMatchesGame || !awayMatchesGame) {
            console.log(`   ⚠️ ExternalId match found but team names don't match - rejecting`);
            console.log(`      DB: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
            console.log(`      API: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            console.log(`      Home match: ${homeMatch ? `${homeMatch.team.name} (score: ${(homeMatch.score * 100).toFixed(1)}%)` : 'NOT FOUND'}, Away match: ${awayMatch ? `${awayMatch.team.name} (score: ${(awayMatch.score * 100).toFixed(1)}%)` : 'NOT FOUND'}`);
            matchingGame = null; // Reject the match
          } else {
            // CRITICAL: Verify competition name makes sense for rugby
            // Reject if external competition is clearly a football competition
            const externalCompName = externalMatch.competition?.name?.toLowerCase() || '';
            const footballKeywords = ['premier league', 'ligue 1', 'serie a', 'bundesliga', 'la liga', 'champions league', 'europa league', 'league two', 'league one', 'championship', 'world cup', 'euro'];
            const isFootballCompetition = footballKeywords.some(keyword => externalCompName.includes(keyword));
            
            if (isFootballCompetition) {
              console.log(`   ⚠️ ExternalId match found but competition is wrong sport - rejecting`);
              console.log(`      DB Competition: ${matchingGame.competition.name} (RUGBY)`);
              console.log(`      API Competition: ${externalMatch.competition?.name || 'unknown'} (appears to be FOOTBALL)`);
              matchingGame = null; // Reject the match
            } else {
              // CRITICAL: Verify date is from the same season/year
              // Reject matches from different seasons (external IDs can be reused across seasons)
              if (externalMatch.utcDate && matchingGame.date) {
                const apiMatchDate = new Date(externalMatch.utcDate);
                const dbGameDate = new Date(matchingGame.date);
                const daysDiff = Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60 * 24);
                
                // For rugby, seasons typically run Sep-Jun, so allow up to 30 days difference
                // But reject if dates are more than 60 days apart (likely different season)
                if (daysDiff > 60) {
                  console.log(`   ⚠️ ExternalId match found but date is from different season - rejecting`);
                  console.log(`      DB Date: ${dbGameDate.toISOString().split('T')[0]} (${matchingGame.competition.name})`);
                  console.log(`      API Date: ${apiMatchDate.toISOString().split('T')[0]} (${externalMatch.competition?.name || 'unknown'})`);
                  console.log(`      Date difference: ${daysDiff.toFixed(1)} days`);
                  matchingGame = null; // Reject the match
                } else {
                  console.log(`   ✅ Found game by externalId: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
                  console.log(`      Team names verified: ${homeMatch.team.name} and ${awayMatch.team.name}`);
                  console.log(`      Competition verified: ${externalMatch.competition?.name || 'unknown'}`);
                  console.log(`      Date verified: ${daysDiff.toFixed(1)} days difference`);
                }
              } else {
                // No date to verify - be more cautious
                console.log(`   ⚠️ MEDIUM CONFIDENCE: Found by externalId but no date to verify`);
                console.log(`      Team names verified: ${homeMatch.team.name} and ${awayMatch.team.name}`);
                console.log(`      Competition verified: ${externalMatch.competition?.name || 'unknown'}`);
                // Still accept but with lower confidence
              }
            }
          }
        }

        // If not found by externalId or externalId match was rejected, try team name matching
        if (!matchingGame) {
          console.log(`   No valid match by externalId, trying team name matching...`);
          
          // Use matching for both teams (only match against rugby teams)
          const homeMatch = rugbyAPI.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
          const awayMatch = rugbyAPI.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);

          console.log(`   Home match: ${homeMatch ? homeMatch.team.name : 'NOT FOUND'} (external: ${externalMatch.homeTeam.name})`);
          console.log(`   Away match: ${awayMatch ? awayMatch.team.name : 'NOT FOUND'} (external: ${externalMatch.awayTeam.name})`);

          if (!homeMatch || !awayMatch) {
            console.log(`⚠️ No team matches found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            continue;
          }

          // Find the game that contains both matched teams
          // IMPORTANT: Verify that the matched game is actually a rugby game (double-check sportType)
          matchingGame = allGamesToCheck.find(game => 
            (game.homeTeam.id === homeMatch.team.id || game.awayTeam.id === homeMatch.team.id) &&
            (game.homeTeam.id === awayMatch.team.id || game.awayTeam.id === awayMatch.team.id) &&
            game.competition.sportType === 'RUGBY' // Double-check: ensure it's a rugby competition
          );
        }

        if (!matchingGame) {
          console.log(`⚠️ No matching rugby game found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          console.log(`   Searched in ${allGamesToCheck.length} rugby games`);
          continue;
        }
        
        // Additional safety check: verify competition sportType
        if (matchingGame.competition.sportType !== 'RUGBY') {
          console.log(`⚠️ Skipping match ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} - competition is ${matchingGame.competition.sportType}, not RUGBY`);
          continue;
        }
        
        if (updatedGameIds.has(matchingGame.id)) {
          console.log(`⏭️ Skipping already-processed rugby game: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          continue;
        }
        
        // Don't skip if game is FINISHED but externalStatus is FT (might need score update)
        // Only skip if game is FINISHED AND has final scores
        if (matchingGame.status === 'FINISHED' && matchingGame.homeScore !== null && matchingGame.awayScore !== null) {
          console.log(`⏭️ Skipping already-finished rugby game with final scores: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          continue;
        }
        
        // If game has externalStatus FT/AET/PEN but is still LIVE, we need to update it
        // Even if we don't find it in external API, we should mark it as FINISHED
        if ((matchingGame.externalStatus === 'FT' || matchingGame.externalStatus === 'AET' || matchingGame.externalStatus === 'PEN') && matchingGame.status === 'LIVE') {
          console.log(`🔄 Game has externalStatus ${matchingGame.externalStatus} but status is ${matchingGame.status} - will update to FINISHED`);
          // Force update to FINISHED even if not found in external API
          const updateData: any = {
            status: 'FINISHED',
            externalStatus: matchingGame.externalStatus,
            homeScore: matchingGame.liveHomeScore ?? matchingGame.homeScore ?? 0,
            awayScore: matchingGame.liveAwayScore ?? matchingGame.awayScore ?? 0,
            finishedAt: new Date(),
            lastSyncAt: new Date()
          };
          
          if (matchingGame.externalStatus === 'AET') {
            updateData.decidedBy = 'AET';
          } else if (matchingGame.externalStatus === 'PEN') {
            updateData.decidedBy = 'AET'; // Use AET since we use 80-minute score
          } else {
            updateData.decidedBy = 'FT';
          }
          
          try {
            const updatedGame = await prisma.game.update({
              where: { id: matchingGame.id },
              data: updateData
            });
            console.log(`✅ Force-updated game to FINISHED: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
            
            // Recalculate bets
            if (updatedGame.homeScore !== null && updatedGame.awayScore !== null) {
              const competition = await prisma.competition.findUnique({
                where: { id: matchingGame.competitionId },
                select: { sportType: true }
              });
              
              const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
              const scoringSystem = getScoringSystemForSport(competition?.sportType || 'RUGBY');
              
              const bets = await prisma.bet.findMany({ where: { gameId: matchingGame.id } });
              for (const bet of bets) {
                const points = calculateBetPoints(
                  { score1: bet.score1, score2: bet.score2 },
                  { home: updatedGame.homeScore!, away: updatedGame.awayScore! },
                  scoringSystem
                );
                await prisma.bet.update({ where: { id: bet.id }, data: { points } });
              }
              
              await updateShootersForCompetition(matchingGame.competitionId);
              console.log(`💰 Calculated points for ${bets.length} bets in force-finished game`);
            }
            
            updatedGameIds.add(matchingGame.id);
            continue; // Skip normal processing since we already updated
          } catch (error) {
            console.error(`❌ Error force-updating game:`, error);
          }
        }
        
        matchedCount++;
        console.log(`✅ Matched ${matchedCount}/${allExternalMatches.length}: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);

        // Get external scores
        let externalHomeScore = matchingGame.liveHomeScore;
        let externalAwayScore = matchingGame.liveAwayScore;
        
        if (externalMatch.score.fullTime.home !== null) {
          externalHomeScore = externalMatch.score.fullTime.home;
        }
        if (externalMatch.score.fullTime.away !== null) {
          externalAwayScore = externalMatch.score.fullTime.away;
        }

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
        let newStatus = externalMatch.status; // Already mapped by RugbyAPI
        const newExternalStatus = externalMatch.externalStatus; // Original external status (HT, 1H, 2H, etc.)
        
        // IMPORTANT: Ensure that HT, 1H, 2H are always treated as LIVE, not FINISHED
        // This prevents matches in half-time from being incorrectly marked as finished
        if ((newExternalStatus === 'HT' || newExternalStatus === '1H' || newExternalStatus === '2H') && newStatus === 'FINISHED') {
          console.log(`⚠️ External status is ${newExternalStatus} (LIVE) but mapping returned FINISHED - correcting to LIVE`);
          newStatus = 'LIVE';
        }
        
        const statusChanged = newStatus !== matchingGame.status;
        
        console.log(`   Status check: current=${matchingGame.status}, new=${newStatus}, external=${newExternalStatus}, changed=${statusChanged}`);

        // Always update if scores, elapsedMinute, or status changed
        // For LIVE games, always update to sync chronometer even if nothing changed
        const shouldUpdate = scoresChanged || elapsedChanged || statusChanged || matchingGame.status === 'LIVE';

        // Prepare update data
        const updateData: any = {
          externalId: externalMatch.id.toString(), // Store external ID for future direct lookups
          externalStatus: newExternalStatus,
          status: newStatus,
          lastSyncAt: new Date()
        };

        // Always update scores (even if same, to ensure sync)
        updateData.liveHomeScore = externalHomeScore;
        updateData.liveAwayScore = externalAwayScore;

        // Add elapsedMinute if available
        if (externalMatch.elapsedMinute !== null && externalMatch.elapsedMinute !== undefined) {
          const previousElapsed = (matchingGame as any).elapsedMinute;
          updateData.elapsedMinute = externalMatch.elapsedMinute;
          if (previousElapsed !== externalMatch.elapsedMinute) {
            console.log(`   ⏱️ Chronometer updated: ${previousElapsed ?? 'null'}' → ${externalMatch.elapsedMinute}'`);
          } else {
            console.log(`   ⏱️ Chronometer unchanged: ${externalMatch.elapsedMinute}' (API may not be updating in real-time)`);
          }
        } else {
          // For HT (half-time), elapsedMinute is expected to be null
          if (newExternalStatus === 'HT') {
            console.log(`   ⏱️ Half-time (HT) - elapsedMinute is null (expected). Badge "MT" should be displayed.`);
          } else {
            console.log(`   ⚠️ No elapsedMinute in external match (status: ${newExternalStatus}, value: ${externalMatch.elapsedMinute}). This might be an API issue.`);
          }
        }

        // If game is finished, also update final scores
        // IMPORTANT: Only mark as FINISHED if external status is actually FT, AET, or PEN
        // Do NOT mark as FINISHED if external status is HT, 1H, 2H (still LIVE)
        if (newStatus === 'FINISHED' && (newExternalStatus === 'FT' || newExternalStatus === 'AET' || newExternalStatus === 'PEN')) {
          console.log(`🏁 Rugby game is FINISHED - updating status from ${matchingGame.status} to ${newStatus} (external: ${newExternalStatus})`);
          updateData.homeScore = externalHomeScore;
          updateData.awayScore = externalAwayScore;
          // Determine decidedBy based on external status
          if (newExternalStatus === 'AET') {
            updateData.decidedBy = 'AET'; // 80 minutes + extra time
          } else if (newExternalStatus === 'PEN') {
            // Match went to penalties, but we use the 80-minute score (not penalty score)
            updateData.decidedBy = 'AET'; // Recorded as AET since we use 80-minute score
            console.log(`⚽ Rugby match went to penalties, using 80-minute score (not penalty score): ${externalHomeScore}-${externalAwayScore}`);
          } else {
            updateData.decidedBy = 'FT'; // 80 minutes
          }
          updateData.finishedAt = new Date();
          console.log(`🏁 Rugby game finished: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} - Final score: ${externalHomeScore}-${externalAwayScore} (${updateData.decidedBy})`);
        } else {
          // Game is still LIVE (HT, 1H, 2H, or any other LIVE status)
          console.log(`   Rugby game still LIVE: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} (external: ${newExternalStatus})`);
        }

        // Update the game
        console.log(`   Updating rugby game with data:`, JSON.stringify(updateData, null, 2));
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
          console.log(`   ✅ Rugby game updated successfully`);
        } catch (updateError: any) {
          console.error(`   ❌ Error updating rugby game:`, updateError?.message || updateError);
          throw updateError;
        }

        // Recalculate bets if game finished
        if (newStatus === 'FINISHED' && externalHomeScore !== null && externalAwayScore !== null) {
          const competition = await prisma.competition.findUnique({
            where: { id: matchingGame.competitionId },
            select: { sportType: true }
          });
          
          const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
          const scoringSystem = getScoringSystemForSport(competition?.sportType || 'RUGBY');
          
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
          console.log(`💰 Calculated points for ${bets.length} bets in rugby game ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`);
        }

        updatedGameIds.add(matchingGame.id);

        // Always add to updatedGames if we updated the game
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
        console.error(`❌ Error updating rugby match ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}:`, error);
      }
    }

    // Auto-finish old LIVE games
    // Only auto-finish if they weren't found in external API (meaning they're truly finished)
    const remainingLiveGames = ourLiveGames.filter(game => !updatedGameIds.has(game.id));
    const remainingRecentlyFinished = recentlyFinishedGames.filter(game => !updatedGameIds.has(game.id));
    const remainingGamesToCheck = [...remainingLiveGames, ...remainingRecentlyFinished].filter((game, index, self) => 
      index === self.findIndex(g => g.id === game.id)
    );
    
    // Check which games were found in external API (by externalId)
    const externalMatchIds = new Set(allExternalMatches.map(m => m.id.toString()));
    
    for (const game of remainingGamesToCheck) {
      try {
        // Skip if this game was found in external API (it's being handled above)
        if (game.externalId && externalMatchIds.has(game.externalId)) {
          console.log(`⏭️ Skipping auto-finish for ${game.homeTeam.name} vs ${game.awayTeam.name} - found in external API`);
          continue;
        }
        
        const gameDate = new Date(game.date);
        const now = new Date();
        const timeDiff = now.getTime() - gameDate.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Auto-finish after 4 hours for rugby (longer than football due to longer match duration + breaks)
        // Only if not found in external API
        if (hoursDiff > 4 && game.status === 'LIVE') {
          console.log(`⏰ Rugby game ${game.homeTeam.name} vs ${game.awayTeam.name} started ${hoursDiff.toFixed(1)} hours ago and not found in external API, marking as FINISHED`);
          
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
            const competition = await prisma.competition.findUnique({
              where: { id: game.competitionId },
              select: { sportType: true }
            });
            
            const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
            const scoringSystem = getScoringSystemForSport(competition?.sportType || 'RUGBY');
            
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
            console.log(`💰 Calculated points for ${bets.length} bets in auto-finished rugby game ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`);
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
        console.error(`❌ Error auto-finishing rugby game ${game.id}:`, error);
      }
    }

    console.log(`✅ Successfully updated ${updatedGames.length} rugby games with API-Sports.io data`);

    if (updatedGames.length > 0) {
      console.log('🔔 Live score updates found - call /api/trigger-games-refresh to update frontend');
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedGames.length} rugby games with API-Sports.io data`,
      updatedGames,
      totalLiveGames: ourLiveGames.length,
      externalMatchesFound: allExternalMatches.length,
      processedMatches: processedCount,
      matchedGames: matchedCount,
      attribution: rugbyAPI.getAttributionText(),
      apiVersion: 'RUGBY',
      lastSync: new Date().toISOString(),
      hasUpdates: updatedGames.length > 0
    });

  } catch (error) {
    console.error('❌ Error updating live rugby scores with API-Sports.io:', error);
    return res.status(500).json({ 
      error: 'Failed to update live rugby scores',
      details: error instanceof Error ? error.message : 'Unknown error',
      apiVersion: 'RUGBY'
    });
  }
}

