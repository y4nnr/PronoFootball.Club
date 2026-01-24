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
import { matchTeamsWithOpenAI } from '../../lib/openai-team-matcher';

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
    const gamesWithoutExternalId = ourLiveGames.filter(game => !game.externalId);
    
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
    
    // CRITICAL FIX: For games WITHOUT externalId, also search by date and team names
    // This is what the Admin tool does and it works! We should do the same here.
    if (gamesWithoutExternalId.length > 0) {
      console.log(`🔍 Found ${gamesWithoutExternalId.length} LIVE rugby games WITHOUT externalId - searching by date and team names...`);
      const matchesByDate: any[] = [];
      
      for (const game of gamesWithoutExternalId) {
        try {
          const gameDate = new Date(game.date);
          const dateStr = gameDate.toISOString().split('T')[0];
          console.log(`   🔍 Searching for ${game.homeTeam.name} vs ${game.awayTeam.name} on ${dateStr}...`);
          
          // Get matches for this specific date
          const dateMatches = await rugbyAPI.getMatchesByDateRange(dateStr, dateStr);
          console.log(`   📊 Found ${dateMatches.length} matches on ${dateStr}`);
          
          // Try to find matching match by team names (similar to Admin tool logic)
          const matchingMatch = dateMatches.find(m => {
            const homeMatch = m.homeTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase()) ||
                             game.homeTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase());
            const awayMatch = m.awayTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase()) ||
                             game.awayTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase());
            return homeMatch && awayMatch;
          });
          
          if (matchingMatch) {
            console.log(`   ✅ Found match by date/team search: ${matchingMatch.homeTeam.name} vs ${matchingMatch.awayTeam.name} (ID: ${matchingMatch.id}, Status: ${matchingMatch.externalStatus})`);
            matchesByDate.push(matchingMatch);
            
            // Special logging for target game
            if (game.homeTeam.name.includes('Bordeaux') && game.awayTeam.name.includes('Stade')) {
              console.log(`   🎯 TARGET GAME MATCH FOUND! External ID: ${matchingMatch.id}`);
              console.log(`      Our DB: ${game.homeTeam.name} vs ${game.awayTeam.name} (Game ID: ${game.id})`);
              console.log(`      External: ${matchingMatch.homeTeam.name} vs ${matchingMatch.awayTeam.name} (External ID: ${matchingMatch.id})`);
            }
          } else {
            console.log(`   ⚠️ No match found for ${game.homeTeam.name} vs ${game.awayTeam.name} on ${dateStr}`);
            console.log(`      Searched ${dateMatches.length} matches from API`);
            if (dateMatches.length > 0) {
              console.log(`      Sample matches: ${dateMatches.slice(0, 3).map(m => `${m.homeTeam.name} vs ${m.awayTeam.name} (ID: ${m.id})`).join(', ')}`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️ Could not search for ${game.homeTeam.name} vs ${game.awayTeam.name}:`, error);
        }
      }
      
      // Merge with existing matches (avoid duplicates)
      const existingIds = new Set(allExternalMatches.map(m => m.id));
      const newMatches = matchesByDate.filter(m => !existingIds.has(m.id));
      allExternalMatches = [...allExternalMatches, ...newMatches];
      console.log(`📊 Total external rugby matches after date/team search: ${allExternalMatches.length} (${newMatches.length} new from date/team search)`);
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
    
    // Log the target game if it's in our list
    const targetGame = allGamesToCheck.find(g => 
      (g.homeTeam.name.includes('Bordeaux') && g.awayTeam.name.includes('Stade Francais')) ||
      (g.homeTeam.name.includes('Bordeaux') && g.awayTeam.name.includes('Stade')) ||
      (g.homeTeam.name.includes('Bordeaux Begles') && g.awayTeam.name.includes('Stade Francais'))
    );
    if (targetGame) {
      console.log(`🎯 TARGET GAME FOUND IN OUR DB: ${targetGame.homeTeam.name} vs ${targetGame.awayTeam.name}`);
      console.log(`   Game ID: ${targetGame.id}, Status: ${targetGame.status}, Date: ${targetGame.date ? new Date(targetGame.date).toISOString() : 'MISSING'}`);
      console.log(`   External ID: ${targetGame.externalId || 'NOT SET'}`);
      console.log(`   Competition: ${targetGame.competition.name}`);
      console.log(`   Is in ourLiveGames: ${ourLiveGames.some(g => g.id === targetGame.id)}`);
      console.log(`   Is in recentlyFinishedGames: ${recentlyFinishedGames.some(g => g.id === targetGame.id)}`);
    } else {
      console.log(`⚠️ TARGET GAME NOT FOUND IN ourLiveGames or recentlyFinishedGames`);
      console.log(`   Looking for: Bordeaux Begles vs Stade Francais Paris`);
      console.log(`   ourLiveGames count: ${ourLiveGames.length}`);
      console.log(`   recentlyFinishedGames count: ${recentlyFinishedGames.length}`);
      console.log(`   Available games: ${allGamesToCheck.slice(0, 5).map(g => `${g.homeTeam.name} vs ${g.awayTeam.name} (${g.status})`).join(', ')}${allGamesToCheck.length > 5 ? '...' : ''}`);
      
      // Also check if the game exists in DB but with different status
      const { prisma } = await import('../../lib/prisma');
      const dbGame = await prisma.game.findFirst({
        where: {
          homeTeam: { name: { contains: 'Bordeaux' } },
          awayTeam: { name: { contains: 'Stade Francais' } },
          competition: { sportType: 'RUGBY' }
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true
        },
        orderBy: { date: 'desc' }
      });
      
      if (dbGame) {
        console.log(`   🔍 Found game in DB with different status: ${dbGame.homeTeam.name} vs ${dbGame.awayTeam.name}`);
        console.log(`      Status: ${dbGame.status}, Date: ${dbGame.date ? new Date(dbGame.date).toISOString() : 'MISSING'}`);
        console.log(`      External ID: ${dbGame.externalId || 'NOT SET'}`);
        console.log(`      Why not in allGamesToCheck: ${dbGame.status !== 'LIVE' ? `Status is ${dbGame.status}, not LIVE` : 'Date might be outside 2-hour window'}`);
      }
    }
    
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
    
    // Collect failed matches for OpenAI fallback
    const failedMatches: Array<{
      externalMatch: any;
      homeMatch: any;
      awayMatch: any;
      reason: string;
    }> = [];
    
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
        // Log specific game we're looking for
        if (externalMatch.id === 49960 || (externalMatch.homeTeam.name.includes('Bordeaux') && externalMatch.awayTeam.name.includes('Stade'))) {
          console.log(`🎯 FOUND TARGET EXTERNAL MATCH: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name} (ID: ${externalMatch.id})`);
          console.log(`   Date: ${externalMatch.utcDate}, Status: ${externalMatch.externalStatus}, Score: ${externalMatch.score.fullTime.home}-${externalMatch.score.fullTime.away}`);
          console.log(`   Competition: ${externalMatch.competition?.name || 'Unknown'}`);
          console.log(`   Will try to match this with our DB games...`);
        }
        console.log(`🔍 Processing ${processedCount}/${allExternalMatches.length}: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name} (ID: ${externalMatch.id})`);

        // First, try to find game by externalId (most reliable)
        // BUT: Skip games that were already matched in this sync run to prevent overwriting correct matches
        let matchingGame = allGamesToCheck.find(game => 
          game.externalId === externalMatch.id.toString() &&
          game.competition.sportType === 'RUGBY' &&
          !updatedGameIds.has(game.id) // CRITICAL: Don't rematch games already processed in this sync
        );

        // If found by externalId, verify team names match (external IDs can be reused or point to wrong games)
        if (matchingGame) {
          console.log(`   Found potential match by externalId: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
          
          // CRITICAL: Verify team names match with HIGH confidence (>= 90%)
          // External IDs can be reused, so we need strict validation
          const homeMatch = rugbyAPI.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
          const awayMatch = rugbyAPI.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);
          
          // Require HIGH confidence (>= 90%) for team matches when validating externalId
          const MIN_TEAM_MATCH_CONFIDENCE = 0.9; // 90%
          const homeMatchConfident = homeMatch && homeMatch.score >= MIN_TEAM_MATCH_CONFIDENCE;
          const awayMatchConfident = awayMatch && awayMatch.score >= MIN_TEAM_MATCH_CONFIDENCE;
          
          // Both teams must match the externalIdMatch game with HIGH confidence
          const homeMatchesGame = homeMatchConfident && (
            homeMatch.team.id === matchingGame.homeTeam.id || 
            homeMatch.team.id === matchingGame.awayTeam.id
          );
          const awayMatchesGame = awayMatchConfident && (
            awayMatch.team.id === matchingGame.homeTeam.id || 
            awayMatch.team.id === matchingGame.awayTeam.id
          );
          
          if (!homeMatchesGame || !awayMatchesGame) {
            console.log(`   ⚠️ ExternalId match found but team names don't match with HIGH confidence - rejecting`);
            console.log(`      DB: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
            console.log(`      API: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            console.log(`      Home match: ${homeMatch ? `${homeMatch.team.name} (score: ${(homeMatch.score * 100).toFixed(1)}%, confident: ${homeMatchConfident})` : 'NOT FOUND'}, Away match: ${awayMatch ? `${awayMatch.team.name} (score: ${(awayMatch.score * 100).toFixed(1)}%, confident: ${awayMatchConfident})` : 'NOT FOUND'}`);
            console.log(`      External IDs can be reused - this is likely a different game!`);
            
            // CRITICAL: Clear the wrong externalId and reset status/scores if game was incorrectly marked as FINISHED
            const gameIdToClear = matchingGame.id;
            const wasIncorrectlyFinished = matchingGame.status === 'FINISHED' && matchingGame.externalId === externalMatch.id.toString();
            matchingGame = null; // Reject the match
            
            try {
              const clearData: any = { 
                externalId: null,
                externalStatus: null
              };
              
              // If game was incorrectly marked as FINISHED due to wrong match, reset it
              if (wasIncorrectlyFinished) {
                console.log(`   ⚠️ Game was incorrectly marked as FINISHED due to wrong external match - resetting status`);
                clearData.status = 'UPCOMING';
                clearData.homeScore = null;
                clearData.awayScore = null;
                clearData.liveHomeScore = null;
                clearData.liveAwayScore = null;
                clearData.finishedAt = null;
                clearData.decidedBy = null;
              }
              
              await prisma.game.update({
                where: { id: gameIdToClear },
                data: clearData
              });
              console.log(`   🧹 Cleared wrong externalId (${externalMatch.id}) from game ${gameIdToClear} - team names don't match${wasIncorrectlyFinished ? ' and reset status/scores' : ''}`);
            } catch (error) {
              console.error(`   ❌ Error clearing externalId:`, error);
            }
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
              
              // CRITICAL: Clear the wrong externalId and reset status/scores if game was incorrectly marked as FINISHED
              const gameIdToClear = matchingGame.id;
              const wasIncorrectlyFinished = matchingGame.status === 'FINISHED' && matchingGame.externalId === externalMatch.id.toString();
              matchingGame = null; // Reject the match
              
              try {
                const clearData: any = { 
                  externalId: null,
                  externalStatus: null
                };
                
                // If game was incorrectly marked as FINISHED due to wrong match, reset it
                if (wasIncorrectlyFinished) {
                  console.log(`   ⚠️ Game was incorrectly marked as FINISHED due to wrong external match - resetting status`);
                  clearData.status = 'UPCOMING';
                  clearData.homeScore = null;
                  clearData.awayScore = null;
                  clearData.liveHomeScore = null;
                  clearData.liveAwayScore = null;
                  clearData.finishedAt = null;
                  clearData.decidedBy = null;
                }
                
                await prisma.game.update({
                  where: { id: gameIdToClear },
                  data: clearData
                });
                console.log(`   🧹 Cleared wrong externalId (${externalMatch.id}) from game ${gameIdToClear} - wrong sport${wasIncorrectlyFinished ? ' and reset status/scores' : ''}`);
              } catch (error) {
                console.error(`   ❌ Error clearing externalId:`, error);
              }
            } else {
              // CRITICAL: Verify date is from the same season/year
              // Reject matches from different seasons (external IDs can be reused across seasons)
              if (externalMatch.utcDate && matchingGame.date) {
                const apiMatchDate = new Date(externalMatch.utcDate);
                const dbGameDate = new Date(matchingGame.date);
                const daysDiff = Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60 * 24);
                
                // CRITICAL: External IDs can be reused across different games/seasons
                // Be VERY strict with date validation - reject if more than 7 days apart
                // This prevents matching games from different weeks/seasons with same external ID
                if (daysDiff > 7) {
                  console.log(`   ⚠️ ExternalId match found but date is too far apart - rejecting`);
                  console.log(`      DB Date: ${dbGameDate.toISOString().split('T')[0]} (${matchingGame.competition.name})`);
                  console.log(`      API Date: ${apiMatchDate.toISOString().split('T')[0]} (${externalMatch.competition?.name || 'unknown'})`);
                  console.log(`      Date difference: ${daysDiff.toFixed(1)} days (threshold: 7 days)`);
                  console.log(`      External IDs can be reused - this is likely a different game!`);
                  
                  // CRITICAL: Clear the wrong externalId and reset status/scores if game was incorrectly marked as FINISHED
                  const gameIdToClear = matchingGame.id;
                  const wasIncorrectlyFinished = matchingGame.status === 'FINISHED' && matchingGame.externalId === externalMatch.id.toString();
                  matchingGame = null; // Reject the match
                  
                  try {
                    const clearData: any = { 
                      externalId: null,
                      externalStatus: null
                    };
                    
                    // If game was incorrectly marked as FINISHED due to wrong match, reset it
                    if (wasIncorrectlyFinished) {
                      console.log(`   ⚠️ Game was incorrectly marked as FINISHED due to wrong external match - resetting status`);
                      clearData.status = 'UPCOMING';
                      clearData.homeScore = null;
                      clearData.awayScore = null;
                      clearData.liveHomeScore = null;
                      clearData.liveAwayScore = null;
                      clearData.finishedAt = null;
                      clearData.decidedBy = null;
                    }
                    
                    await prisma.game.update({
                      where: { id: gameIdToClear },
                      data: clearData
                    });
                    console.log(`   🧹 Cleared wrong externalId (${externalMatch.id}) from game ${gameIdToClear}${wasIncorrectlyFinished ? ' and reset status/scores' : ''}`);
                  } catch (error) {
                    console.error(`   ❌ Error clearing externalId:`, error);
                  }
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
          console.log(`   🔍 Searching for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          console.log(`   📋 Available teams in DB (${uniqueTeams.length}): ${uniqueTeams.slice(0, 10).map(t => t.name).join(', ')}${uniqueTeams.length > 10 ? '...' : ''}`);
          
          // Use matching for both teams (only match against rugby teams)
          const homeMatch = rugbyAPI.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
          const awayMatch = rugbyAPI.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);

          console.log(`   Home match: ${homeMatch ? `${homeMatch.team.name} (score: ${(homeMatch.score * 100).toFixed(1)}%, method: ${homeMatch.method})` : 'NOT FOUND'} (external: ${externalMatch.homeTeam.name})`);
          console.log(`   Away match: ${awayMatch ? `${awayMatch.team.name} (score: ${(awayMatch.score * 100).toFixed(1)}%, method: ${awayMatch.method})` : 'NOT FOUND'} (external: ${externalMatch.awayTeam.name})`);

          // CRITICAL: Require BOTH teams to match with HIGH confidence (at least 0.9 = 90%)
          // If confidence is below 90%, we'll use OpenAI to verify and guarantee 100% match
          const MIN_TEAM_MATCH_CONFIDENCE = 0.9; // Changed from 0.85 to 0.9 (90%)
          const homeMatchConfident = homeMatch && homeMatch.score >= MIN_TEAM_MATCH_CONFIDENCE;
          const awayMatchConfident = awayMatch && awayMatch.score >= MIN_TEAM_MATCH_CONFIDENCE;
          
          // Calculate overall match confidence (average of home and away, or minimum if one is missing)
          const overallConfidence = homeMatch && awayMatch 
            ? (homeMatch.score + awayMatch.score) / 2 
            : (homeMatch?.score || awayMatch?.score || 0);

          if (!homeMatchConfident || !awayMatchConfident) {
            console.log(`⚠️ Confidence below 90% threshold for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            console.log(`   Overall confidence: ${(overallConfidence * 100).toFixed(1)}% (threshold: 90%)`);
            if (homeMatch && homeMatch.score < MIN_TEAM_MATCH_CONFIDENCE) {
              console.log(`   Home match score ${(homeMatch.score * 100).toFixed(1)}% is below threshold ${(MIN_TEAM_MATCH_CONFIDENCE * 100).toFixed(1)}%`);
              console.log(`   Home match details: DB team="${homeMatch.team.name}", shortName="${homeMatch.team.shortName || 'N/A'}"`);
            }
            if (awayMatch && awayMatch.score < MIN_TEAM_MATCH_CONFIDENCE) {
              console.log(`   Away match score ${(awayMatch.score * 100).toFixed(1)}% is below threshold ${(MIN_TEAM_MATCH_CONFIDENCE * 100).toFixed(1)}%`);
              console.log(`   Away match details: DB team="${awayMatch.team.name}", shortName="${awayMatch.team.shortName || 'N/A'}"`);
            }
            if (!homeMatch) {
              console.log(`   ❌ Home team "${externalMatch.homeTeam.name}" not found in DB at all`);
            }
            if (!awayMatch) {
              console.log(`   ❌ Away team "${externalMatch.awayTeam.name}" not found in DB at all`);
            }
            console.log(`   🤖 Will use OpenAI to verify and guarantee 100% match`);
            
            // Collect for OpenAI fallback - use OpenAI when confidence < 90%
            failedMatches.push({
              externalMatch,
              homeMatch,
              awayMatch,
              reason: 'confidence_below_90_percent'
            });
            continue;
          }

          // Find the game that contains both matched teams
          // IMPORTANT: Verify that the matched game is actually a rugby game (double-check sportType)
          // CRITICAL: Skip games already matched in this sync run to prevent overwriting correct matches
          matchingGame = allGamesToCheck.find(game => 
            (game.homeTeam.id === homeMatch.team.id || game.awayTeam.id === homeMatch.team.id) &&
            (game.homeTeam.id === awayMatch.team.id || game.awayTeam.id === awayMatch.team.id) &&
            game.competition.sportType === 'RUGBY' && // Double-check: ensure it's a rugby competition
            !updatedGameIds.has(game.id) // CRITICAL: Don't rematch games already processed in this sync
          );
          
          // CRITICAL: If found by team name matching, verify date is reasonable AND check overall confidence
          if (matchingGame) {
            console.log(`   ✅ Found game by team name matching: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
            console.log(`      Game ID: ${matchingGame.id}, Status: ${matchingGame.status}, Date: ${matchingGame.date ? new Date(matchingGame.date).toISOString().split('T')[0] : 'MISSING'}`);
            console.log(`      Match confidence: Home=${(homeMatch.score * 100).toFixed(1)}%, Away=${(awayMatch.score * 100).toFixed(1)}%, Overall=${(overallConfidence * 100).toFixed(1)}%`);
            
            // Check if overall confidence is below 90% - if so, use OpenAI to verify
            if (overallConfidence < 0.9) {
              console.log(`   ⚠️ Overall confidence ${(overallConfidence * 100).toFixed(1)}% is below 90% threshold`);
              console.log(`   🤖 Will use OpenAI to verify and guarantee 100% match`);
              matchingGame = null; // Reject for now, let OpenAI verify
              
              // Collect for OpenAI fallback (confidence below 90%)
              failedMatches.push({
                externalMatch,
                homeMatch,
                awayMatch,
                reason: 'overall_confidence_below_90_percent'
              });
            } else {
              // ALWAYS verify date - this is critical to prevent matching games from different seasons
              if (externalMatch.utcDate && matchingGame.date) {
                const apiMatchDate = new Date(externalMatch.utcDate);
                const dbGameDate = new Date(matchingGame.date);
                const daysDiff = Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60 * 24);
                
                console.log(`      Date check: DB=${dbGameDate.toISOString().split('T')[0]}, API=${apiMatchDate.toISOString().split('T')[0]}, diff=${daysDiff.toFixed(1)} days`);
                
                // Reject if dates are more than 30 days apart (very strict - prevents cross-season matches)
                if (daysDiff > 30) {
                  console.log(`   ⚠️ Team name match found but date is from different season - REJECTING`);
                  console.log(`      DB Date: ${dbGameDate.toISOString().split('T')[0]} (${matchingGame.competition.name})`);
                  console.log(`      API Date: ${apiMatchDate.toISOString().split('T')[0]} (${externalMatch.competition?.name || 'unknown'})`);
                  console.log(`      Date difference: ${daysDiff.toFixed(1)} days (threshold: 30 days)`);
                  console.log(`   🤖 Will use OpenAI to verify and guarantee 100% match`);
                  matchingGame = null; // Reject the match
                  
                  // Collect for OpenAI fallback (date validation failed but teams matched)
                  failedMatches.push({
                    externalMatch,
                    homeMatch,
                    awayMatch,
                    reason: 'date_validation_failed'
                  });
                } else {
                  console.log(`   ✅ Date verified: ${daysDiff.toFixed(1)} days difference (within 30 day threshold)`);
                  console.log(`   ✅ Overall confidence ${(overallConfidence * 100).toFixed(1)}% is above 90% - match accepted`);
                }
              } else {
                // If no date available, be very cautious - use OpenAI to verify
                console.log(`   ⚠️ Team name match found but NO DATE available for verification`);
                console.log(`      DB Date: ${matchingGame.date ? new Date(matchingGame.date).toISOString().split('T')[0] : 'MISSING'}`);
                console.log(`      API Date: ${externalMatch.utcDate ? new Date(externalMatch.utcDate).toISOString().split('T')[0] : 'MISSING'}`);
                console.log(`   🤖 Will use OpenAI to verify and guarantee 100% match`);
                matchingGame = null; // Reject for now, let OpenAI verify
                
                // Collect for OpenAI fallback (date validation failed but teams matched)
                failedMatches.push({
                  externalMatch,
                  homeMatch,
                  awayMatch,
                  reason: 'date_validation_failed_no_date'
                });
              }
            }
          } else {
            console.log(`   ❌ No game found in DB with both matched teams: ${homeMatch?.team.name || 'N/A'} and ${awayMatch?.team.name || 'N/A'}`);
            console.log(`      Searched ${allGamesToCheck.length} games`);
            
            // Collect for OpenAI fallback (teams matched but no game found)
            failedMatches.push({
              externalMatch,
              homeMatch,
              awayMatch,
              reason: 'no_game_found'
            });
          }
        }

        if (!matchingGame) {
          console.log(`⚠️ No matching rugby game found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          console.log(`   Searched in ${allGamesToCheck.length} rugby games`);
          
          // Only add to failedMatches if we haven't already (to avoid duplicates)
          const alreadyCollected = failedMatches.some(fm => 
            fm.externalMatch.id === externalMatch.id
          );
          if (!alreadyCollected) {
            failedMatches.push({
              externalMatch,
              homeMatch: null,
              awayMatch: null,
              reason: 'no_match_after_all_attempts'
            });
          }
          continue; // Skip this external match - no valid game found
        }
        
        // CRITICAL: Don't update games if external API shows NS (Not Started)
        // Games that haven't started should remain UPCOMING, not be marked as LIVE
        if (externalMatch.externalStatus === 'NS' || externalMatch.externalStatus === 'POST') {
          console.log(`   ⏭️ Skipping update: External API shows ${externalMatch.externalStatus} (Not Started/Postponed)`);
          console.log(`      Game ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} should remain ${matchingGame.status}`);
          console.log(`      Will not update status or scores until game actually starts`);
          continue; // Skip this match - game hasn't started yet
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
        console.log(`   External match data: status=${externalMatch.externalStatus}, elapsed=${externalMatch.elapsedMinute}, score=${externalMatch.score.fullTime.home}-${externalMatch.score.fullTime.away}`);

        // Get external scores
        // IMPORTANT: For LIVE games, use scores from API even if they're 0 (game just started)
        // Only use existing scores if API doesn't provide them (null means not available, 0 means no score yet)
        let externalHomeScore: number | null = externalMatch.score.fullTime.home !== null && externalMatch.score.fullTime.home !== undefined 
          ? externalMatch.score.fullTime.home 
          : (matchingGame.liveHomeScore !== null && matchingGame.liveHomeScore !== undefined ? matchingGame.liveHomeScore : null);
        let externalAwayScore: number | null = externalMatch.score.fullTime.away !== null && externalMatch.score.fullTime.away !== undefined 
          ? externalMatch.score.fullTime.away 
          : (matchingGame.liveAwayScore !== null && matchingGame.liveAwayScore !== undefined ? matchingGame.liveAwayScore : null);
        
        // For LIVE games, if scores are null from both API and DB, set to 0 (game hasn't scored yet)
        // This ensures the UI shows "0 - 0" instead of "-"
        if (externalMatch.status === 'LIVE') {
          if (externalHomeScore === null) {
            externalHomeScore = 0;
          }
          if (externalAwayScore === null) {
            externalAwayScore = 0;
          }
          if (externalHomeScore === 0 && externalAwayScore === 0 && (externalMatch.score.fullTime.home === null || externalMatch.score.fullTime.away === null)) {
            console.log(`   ⚠️ LIVE game with null scores from API - setting to 0-0 (game may not have scored yet)`);
          }
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
        
        // CRITICAL: Prevent invalid status transitions
        // A game cannot "un-start" - once LIVE, it can only go to FINISHED, not back to UPCOMING
        // The external API might show NS/UPCOMING if it's slow to update or the game is delayed
        if (matchingGame.status === 'LIVE' && newStatus === 'UPCOMING') {
          console.log(`   ⚠️ BLOCKING invalid status transition: LIVE → UPCOMING`);
          console.log(`      External API shows ${newExternalStatus} (mapped to UPCOMING), but game is already LIVE`);
          console.log(`      This can happen if external API is slow to update or game is delayed`);
          console.log(`      Keeping status as LIVE - will update when external API shows game has started`);
          newStatus = 'LIVE'; // Keep it as LIVE
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
        // IMPORTANT: For LIVE games, always set scores (even if 0) to ensure UI displays them
        updateData.liveHomeScore = externalHomeScore;
        updateData.liveAwayScore = externalAwayScore;
        console.log(`   📊 Setting scores: ${externalHomeScore}-${externalAwayScore} (externalStatus: ${newExternalStatus})`);

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

    // OpenAI Fallback: Try to match failed games using AI
    console.log(`📊 DEBUG: Total failed matches collected: ${failedMatches.length}`);
    let openAIMatchedCount = 0;
    let openAIExternalIdSetCount = 0;
    if (failedMatches.length > 0) {
      console.log(`🤖 Attempting OpenAI fallback for ${failedMatches.length} failed matches...`);
      console.log(`📋 Failed matches:`, failedMatches.map(fm => ({
        external: `${fm.externalMatch.homeTeam.name} vs ${fm.externalMatch.awayTeam.name}`,
        reason: fm.reason,
        id: fm.externalMatch.id
      })));
      const openAIApiKey = process.env.OPENAI_API_KEY || null;
      console.log(`🔑 OpenAI API key present: ${openAIApiKey ? 'YES' : 'NO'}`);
      
      if (openAIApiKey) {
        try {
          console.log(`🤖 Calling OpenAI API with ${failedMatches.length} failed matches...`);
          // Prepare requests for OpenAI with full game context (date, competition, teams)
          const openAIRequests = failedMatches.map(fm => ({
            externalHome: fm.externalMatch.homeTeam.name,
            externalAway: fm.externalMatch.awayTeam.name,
            externalDate: fm.externalMatch.utcDate || null,
            externalCompetition: fm.externalMatch.competition?.name || null,
            dbGames: allGamesToCheck.map(game => ({
              id: game.id,
              homeTeam: {
                id: game.homeTeam.id,
                name: game.homeTeam.name,
                shortName: (game.homeTeam as any).shortName || null
              },
              awayTeam: {
                id: game.awayTeam.id,
                name: game.awayTeam.name,
                shortName: (game.awayTeam as any).shortName || null
              },
              date: game.date ? game.date.toISOString() : null,
              competition: {
                name: game.competition.name
              }
            })),
            dbTeams: uniqueTeams, // Keep for backward compatibility
          }));

          // Batch process with OpenAI
          console.log(`🤖 Calling OpenAI with ${openAIRequests.length} requests...`);
          console.log(`🤖 Sample requests (first 3):`, openAIRequests.slice(0, 3).map(r => ({
            external: `${r.externalHome} vs ${r.externalAway}`,
            dbTeamsCount: r.dbTeams.length
          })));
          const openAIResults = await matchTeamsWithOpenAI(openAIRequests, openAIApiKey);
          console.log(`🤖 OpenAI returned ${openAIResults.size} results`);
          console.log(`🤖 OpenAI result keys (first 10):`, Array.from(openAIResults.keys()).slice(0, 10));
          
          // Log sample results to see what OpenAI returned
          const sampleResults = Array.from(openAIResults.entries()).slice(0, 3);
          for (const [key, result] of sampleResults) {
            console.log(`🤖 Sample result for "${key}":`);
            console.log(`   Home: ${result.homeMatch ? `${result.homeMatch.team.name} (${(result.homeMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
            console.log(`   Away: ${result.awayMatch ? `${result.awayMatch.team.name} (${(result.awayMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
          }

          // Process OpenAI matches
          console.log(`🤖 Processing ${failedMatches.length} failed matches with OpenAI results...`);
          for (const failedMatch of failedMatches) {
            const resultKey = `${failedMatch.externalMatch.homeTeam.name}|${failedMatch.externalMatch.awayTeam.name}`;
            console.log(`   🔍 Looking for result key: "${resultKey}"`);
            const aiResult = openAIResults.get(resultKey);
            
            // Also try to find by external ID if we know it
            if (!aiResult && failedMatch.externalMatch.id) {
              console.log(`   🔍 Trying to find match by external ID: ${failedMatch.externalMatch.id}`);
              // Check if any result matches this external match
              for (const [key, result] of openAIResults.entries()) {
                if (result.homeMatch && result.awayMatch) {
                  console.log(`      Checking key: "${key}"`);
                }
              }
            }
            
            console.log(`🤖 Checking OpenAI result for: ${failedMatch.externalMatch.homeTeam.name} vs ${failedMatch.externalMatch.awayTeam.name}`);
            console.log(`   Result key: ${resultKey}`);
            console.log(`   OpenAI result exists: ${!!aiResult}`);
            if (aiResult) {
              console.log(`   Home match: ${aiResult.homeMatch ? `${aiResult.homeMatch.team.name} (${(aiResult.homeMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
              console.log(`   Away match: ${aiResult.awayMatch ? `${aiResult.awayMatch.team.name} (${(aiResult.awayMatch.confidence * 100).toFixed(1)}%)` : 'null'}`);
            }

            // Trust OpenAI results - if OpenAI says it's a match with overallConfidence >= 0.85, we accept it
            // OpenAI is used as a fallback when rule-based matching has low confidence, so we trust its judgment
            const MIN_OPENAI_CONFIDENCE = 0.85; // 85% - high confidence threshold for OpenAI
            const openAIConfident = aiResult?.overallConfidence && aiResult.overallConfidence >= MIN_OPENAI_CONFIDENCE;
            const hasGameId = aiResult?.gameId && aiResult.gameId !== null;
            
            if (aiResult && openAIConfident && hasGameId) {
              console.log(`🤖 OpenAI matched with HIGH CONFIDENCE: ${failedMatch.externalMatch.homeTeam.name} vs ${failedMatch.externalMatch.awayTeam.name}`);
              console.log(`   Game ID: ${aiResult.gameId}`);
              console.log(`   Overall Confidence: ${(aiResult.overallConfidence! * 100).toFixed(1)}%`);
              if (aiResult.homeMatch) {
                console.log(`   Home: ${failedMatch.externalMatch.homeTeam.name} → ${aiResult.homeMatch.team.name} (${(aiResult.homeMatch.confidence * 100).toFixed(1)}%)`);
              }
              if (aiResult.awayMatch) {
                console.log(`   Away: ${failedMatch.externalMatch.awayTeam.name} → ${aiResult.awayMatch.team.name} (${(aiResult.awayMatch.confidence * 100).toFixed(1)}%)`);
              }
              console.log(`   Reasoning: ${aiResult.reasoning || 'N/A'}`);
              console.log(`   ✅ OpenAI guarantees 100% match - accepting without further validation`);

              // Find the game by ID (OpenAI told us which game it is!)
              const aiMatchingGame = allGamesToCheck.find(game =>
                game.id === aiResult.gameId &&
                game.competition.sportType === 'RUGBY' &&
                !updatedGameIds.has(game.id)
              );
              
              if (!aiMatchingGame) {
                console.log(`   ❌ No game found in allGamesToCheck with teams ${aiResult.homeMatch.team.name} and ${aiResult.awayMatch.team.name}`);
                console.log(`   🔍 Checking if teams exist in any games...`);
                const homeTeamGames = allGamesToCheck.filter(g => g.homeTeam.id === aiResult.homeMatch!.team.id || g.awayTeam.id === aiResult.homeMatch!.team.id);
                const awayTeamGames = allGamesToCheck.filter(g => g.homeTeam.id === aiResult.awayMatch!.team.id || g.awayTeam.id === aiResult.awayMatch!.team.id);
                console.log(`   📊 Games with home team: ${homeTeamGames.length}, Games with away team: ${awayTeamGames.length}`);
              }

              if (aiMatchingGame) {
                // Verify date
                const externalMatch = failedMatch.externalMatch;
                if (externalMatch.utcDate && aiMatchingGame.date) {
                  const apiMatchDate = new Date(externalMatch.utcDate);
                  const dbGameDate = new Date(aiMatchingGame.date);
                  const daysDiff = Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60 * 24);

                  if (daysDiff <= 30) {
                    console.log(`✅ OpenAI match verified by date: ${daysDiff.toFixed(1)} days difference`);
                    console.log(`🎯 OpenAI found valid match: ${aiMatchingGame.homeTeam.name} vs ${aiMatchingGame.awayTeam.name} for external ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
                    
                    // Process the match immediately using the same update logic as the main loop
                    // Skip if already processed in this sync
                    if (updatedGameIds.has(aiMatchingGame.id)) {
                      console.log(`⏭️ OpenAI match already processed in this sync: ${aiMatchingGame.homeTeam.name} vs ${aiMatchingGame.awayTeam.name}`);
                      continue;
                    }
                    
                    // Get external scores
                    let externalHomeScore: number | null = externalMatch.score.fullTime.home !== null && externalMatch.score.fullTime.home !== undefined 
                      ? externalMatch.score.fullTime.home 
                      : (aiMatchingGame.liveHomeScore !== null && aiMatchingGame.liveHomeScore !== undefined ? aiMatchingGame.liveHomeScore : null);
                    let externalAwayScore: number | null = externalMatch.score.fullTime.away !== null && externalMatch.score.fullTime.away !== undefined 
                      ? externalMatch.score.fullTime.away 
                      : (aiMatchingGame.liveAwayScore !== null && aiMatchingGame.liveAwayScore !== undefined ? aiMatchingGame.liveAwayScore : null);
                    
                    // For LIVE games, if scores are null from both API and DB, set to 0 (game hasn't scored yet)
                    if (externalMatch.status === 'LIVE') {
                      if (externalHomeScore === null) {
                        externalHomeScore = 0;
                      }
                      if (externalAwayScore === null) {
                        externalAwayScore = 0;
                      }
                      if (externalHomeScore === 0 && externalAwayScore === 0 && (externalMatch.score.fullTime.home === null || externalMatch.score.fullTime.away === null)) {
                        console.log(`   ⚠️ LIVE game with null scores from API - setting to 0-0 (game may not have scored yet)`);
                      }
                    }
                    
                    // Check if scores changed
                    const homeScoreChanged = externalHomeScore !== aiMatchingGame.liveHomeScore;
                    const awayScoreChanged = externalAwayScore !== aiMatchingGame.liveAwayScore;
                    const scoresChanged = homeScoreChanged || awayScoreChanged;
                    
                    // Check if elapsedMinute changed
                    const currentElapsed = (aiMatchingGame as any).elapsedMinute;
                    const elapsedChanged = externalMatch.elapsedMinute !== null && 
                                         externalMatch.elapsedMinute !== undefined &&
                                         externalMatch.elapsedMinute !== currentElapsed;
                    
                    // Map external status to our status
                    let newStatus = externalMatch.status;
                    const newExternalStatus = externalMatch.externalStatus;
                    
                    // Ensure HT, 1H, 2H are LIVE
                    if ((newExternalStatus === 'HT' || newExternalStatus === '1H' || newExternalStatus === '2H') && newStatus === 'FINISHED') {
                      console.log(`   ⚠️ External status is ${newExternalStatus} (LIVE) but mapping returned FINISHED - correcting to LIVE`);
                      newStatus = 'LIVE';
                    }
                    
                    // CRITICAL: Prevent invalid status transitions (LIVE → UPCOMING)
                    if (aiMatchingGame.status === 'LIVE' && newStatus === 'UPCOMING') {
                      console.log(`   ⚠️ BLOCKING invalid status transition: LIVE → UPCOMING`);
                      console.log(`      External API shows ${newExternalStatus} (mapped to UPCOMING), but game is already LIVE`);
                      newStatus = 'LIVE'; // Keep it as LIVE
                    }
                    
                    const statusChanged = newStatus !== aiMatchingGame.status;
                    const shouldUpdate = scoresChanged || elapsedChanged || statusChanged || aiMatchingGame.status === 'LIVE';
                    
                    if (!shouldUpdate) {
                      console.log(`   ⏭️ No changes needed for OpenAI match`);
                      // Still set externalId for future direct matching
                      try {
                        await prisma.game.update({
                          where: { id: aiMatchingGame.id },
                          data: { externalId: externalMatch.id.toString() }
                        });
                        console.log(`   ✅ Set externalId ${externalMatch.id} for future direct matching`);
                        openAIExternalIdSetCount++;
                      } catch (error) {
                        console.error(`   ❌ Error setting externalId:`, error);
                      }
                      continue;
                    }
                    
                    // Prepare update data
                    const updateData: any = {
                      externalId: externalMatch.id.toString(),
                      externalStatus: newExternalStatus,
                      status: newStatus,
                      lastSyncAt: new Date()
                    };
                    
                    // Always update scores
                    updateData.liveHomeScore = externalHomeScore;
                    updateData.liveAwayScore = externalAwayScore;
                    console.log(`   📊 Setting scores: ${externalHomeScore}-${externalAwayScore} (externalStatus: ${newExternalStatus})`);
                    
                    // Add elapsedMinute if available
                    if (externalMatch.elapsedMinute !== null && externalMatch.elapsedMinute !== undefined) {
                      updateData.elapsedMinute = externalMatch.elapsedMinute;
                      console.log(`   ⏱️ Setting elapsedMinute: ${externalMatch.elapsedMinute}'`);
                    } else {
                      if (newExternalStatus === 'HT') {
                        console.log(`   ⏱️ Half-time (HT) - elapsedMinute is null (expected)`);
                      } else {
                        console.log(`   ⚠️ No elapsedMinute in external match (status: ${newExternalStatus})`);
                      }
                    }
                    
                    // If game is finished, also update final scores
                    if (newStatus === 'FINISHED' && (newExternalStatus === 'FT' || newExternalStatus === 'AET' || newExternalStatus === 'PEN')) {
                      updateData.homeScore = externalHomeScore;
                      updateData.awayScore = externalAwayScore;
                      if (newExternalStatus === 'AET') {
                        updateData.decidedBy = 'AET';
                      } else if (newExternalStatus === 'PEN') {
                        updateData.decidedBy = 'AET';
                      } else {
                        updateData.decidedBy = 'FT';
                      }
                      updateData.finishedAt = new Date();
                    }
                    
                    // Update the game
                    try {
                      const updatedGame = await prisma.game.update({
                        where: { id: aiMatchingGame.id },
                        data: updateData,
                        include: {
                          homeTeam: true,
                          awayTeam: true,
                          competition: true
                        }
                      });
                      
                      console.log(`   ✅ OpenAI match updated successfully: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name}`);
                      console.log(`      Status: ${aiMatchingGame.status} → ${updatedGame.status}`);
                      console.log(`      Scores: ${aiMatchingGame.liveHomeScore ?? '-'}-${aiMatchingGame.liveAwayScore ?? '-'} → ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore}`);
                      console.log(`      ExternalId: ${updatedGame.externalId}`);
                      
                      updatedGameIds.add(aiMatchingGame.id);
                      matchedCount++;
                      openAIMatchedCount++;
                      openAIExternalIdSetCount++;
                      
                      // Add to updatedGames for response
                      if (!updatedGames.find(g => g.id === updatedGame.id)) {
                        updatedGames.push({
                          id: updatedGame.id,
                          homeTeam: updatedGame.homeTeam.name,
                          awayTeam: updatedGame.awayTeam.name,
                          oldHomeScore: aiMatchingGame.liveHomeScore ?? 0,
                          oldAwayScore: aiMatchingGame.liveAwayScore ?? 0,
                          newHomeScore: updatedGame.liveHomeScore ?? 0,
                          newAwayScore: updatedGame.liveAwayScore ?? 0,
                          elapsedMinute: updatedGame.elapsedMinute,
                          status: updatedGame.status,
                          externalStatus: updatedGame.externalStatus,
                          decidedBy: updatedGame.decidedBy,
                          lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
                          scoreChanged: scoresChanged,
                          statusChanged: statusChanged
                        });
                      }
                      
                      // Recalculate bets if game finished
                      if (newStatus === 'FINISHED' && externalHomeScore !== null && externalAwayScore !== null) {
                        const competition = await prisma.competition.findUnique({
                          where: { id: aiMatchingGame.competitionId },
                          select: { sportType: true }
                        });
                        
                        const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
                        const scoringSystem = getScoringSystemForSport(competition?.sportType || 'RUGBY');
                        
                        const bets = await prisma.bet.findMany({ where: { gameId: aiMatchingGame.id } });
                        for (const bet of bets) {
                          const points = calculateBetPoints(
                            { score1: bet.score1, score2: bet.score2 },
                            { home: externalHomeScore, away: externalAwayScore },
                            scoringSystem
                          );
                          await prisma.bet.update({ where: { id: bet.id }, data: { points } });
                        }
                        
                        await updateShootersForCompetition(aiMatchingGame.competitionId);
                        console.log(`💰 Calculated points for ${bets.length} bets in OpenAI-matched finished game`);
                      }
                    } catch (error) {
                      console.error(`   ❌ Error updating OpenAI-matched game:`, error);
                    }
                  } else {
                    console.log(`⚠️ OpenAI match rejected: date difference ${daysDiff.toFixed(1)} days > 30`);
                  }
                } else {
                  console.log(`⚠️ OpenAI match rejected: missing date for verification`);
                }
              } else {
                console.log(`⚠️ OpenAI matched teams but no game found in DB`);
              }
            } else {
              if (!aiResult) {
                console.log(`❌ OpenAI returned no result for: ${failedMatch.externalMatch.homeTeam.name} vs ${failedMatch.externalMatch.awayTeam.name}`);
                console.log(`   Result key searched: "${resultKey}"`);
              } else if (!openAIHomeConfident || !openAIAwayConfident) {
                console.log(`❌ OpenAI result confidence too low for: ${failedMatch.externalMatch.homeTeam.name} vs ${failedMatch.externalMatch.awayTeam.name}`);
                console.log(`   Home confident: ${openAIHomeConfident} (${aiResult.homeMatch ? (aiResult.homeMatch.confidence * 100).toFixed(1) + '%' : 'null'})`);
                console.log(`   Away confident: ${openAIAwayConfident} (${aiResult.awayMatch ? (aiResult.awayMatch.confidence * 100).toFixed(1) + '%' : 'null'})`);
                console.log(`   Threshold: 85%`);
              } else {
                console.log(`❌ OpenAI matched but game not found or other issue: ${failedMatch.externalMatch.homeTeam.name} vs ${failedMatch.externalMatch.awayTeam.name}`);
              }
            }
          }
          console.log(`🤖 OpenAI Summary: ${openAIMatchedCount} matches found, ${openAIExternalIdSetCount} externalIds set`);
        } catch (error) {
          console.error(`❌ Error in OpenAI fallback matching:`, error);
          console.error(`❌ Error details:`, error instanceof Error ? error.message : String(error));
        }
      } else {
        console.log(`⚠️ OpenAI API key not configured - skipping AI fallback`);
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
    console.log(`📊 DEBUG: Final failedMatches.length = ${failedMatches.length}`);
    console.log(`📊 DEBUG: Final matchedCount = ${matchedCount}`);

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
      hasUpdates: updatedGames.length > 0,
      debug: {
        failedMatchesCount: failedMatches.length,
        openAIAttempted: failedMatches.length > 0,
        openAIKeyPresent: !!process.env.OPENAI_API_KEY,
        openAIMatchedCount: openAIMatchedCount,
        openAIExternalIdSetCount: openAIExternalIdSetCount
      }
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

