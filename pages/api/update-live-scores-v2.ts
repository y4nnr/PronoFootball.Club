import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { ApiSportsV2 } from '../../lib/api-sports-api-v2';
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
        },
        // Exclude RESCHEDULED games - they should not be automatically updated
        NOT: {
          status: 'RESCHEDULED'
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
        },
        // Exclude RESCHEDULED games
        NOT: {
          status: 'RESCHEDULED'
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

    // Also get FINISHED games with externalId to check for wrong matches (games incorrectly marked as FINISHED)
    const finishedGamesWithExternalId = await prisma.game.findMany({
      where: {
        status: 'FINISHED',
        externalId: { not: null },
        competition: {
          sportType: 'FOOTBALL'
        },
        // Exclude RESCHEDULED games
        NOT: {
          status: 'RESCHEDULED'
        },
        // Only check games from the last 7 days to avoid checking old games
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
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

    // Also get LIVE games without externalId - these need to be matched by OpenAI
    // These are games that are LIVE but don't have an externalId yet (e.g., PSG vs Newcastle)
    const liveGamesWithoutExternalId = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        externalId: null,
        competition: {
          sportType: 'FOOTBALL'
        },
        // Exclude RESCHEDULED games
        NOT: {
          status: 'RESCHEDULED'
        },
        // Only check games from the last 24 hours (games that just went LIVE)
        date: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
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

    // Also get UPCOMING games without externalId - these need to be matched by OpenAI
    // Only include games scheduled for today or in the near future (next 3 days)
    const upcomingGamesWithoutExternalId = await prisma.game.findMany({
      where: {
        status: 'UPCOMING',
        externalId: null,
        competition: {
          sportType: 'FOOTBALL'
        },
        // Exclude RESCHEDULED games
        NOT: {
          status: 'RESCHEDULED'
        },
        // Only check games from today to 3 days in the future
        date: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // From yesterday (to catch games that just started)
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Up to 3 days ahead
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
    
    console.log(`📊 Found ${ourLiveGames.length} LIVE games, ${recentlyFinishedGames.length} potentially finished games, ${finishedGamesWithExternalId.length} FINISHED games with externalId, ${liveGamesWithoutExternalId.length} LIVE games without externalId, and ${upcomingGamesWithoutExternalId.length} UPCOMING games without externalId`);
    
    // Combine LIVE games, recently finished games, FINISHED games with externalId, LIVE games without externalId, and UPCOMING games without externalId
    // Deduplicate by game ID
    const allGamesToCheck = [...ourLiveGames, ...recentlyFinishedGames, ...finishedGamesWithExternalId, ...liveGamesWithoutExternalId, ...upcomingGamesWithoutExternalId];
    const uniqueGamesToCheck = allGamesToCheck.filter((game, index, self) => 
      index === self.findIndex(g => g.id === game.id)
    );
    console.log(`📊 Total games to check for updates: ${uniqueGamesToCheck.length} (${ourLiveGames.length} LIVE + ${recentlyFinishedGames.length} potentially finished + ${finishedGamesWithExternalId.length} FINISHED with externalId + ${liveGamesWithoutExternalId.length} LIVE without externalId + ${upcomingGamesWithoutExternalId.length} UPCOMING without externalId)`);
    
    // Verify that all teams are football teams
    const nonFootballTeams = uniqueGamesToCheck.filter(game => 
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
    let rejectedCount = 0;
    const rejectedMatches: Array<{
      externalMatch: { home: string; away: string; id: number; competition?: string };
      reason: string;
      details?: string;
    }> = [];
    const unmatchedMatches: Array<{
      externalMatch: { home: string; away: string; id: number; competition?: string };
      reason: string;
    }> = [];
    
    // Get all teams from all games (LIVE + potentially finished) for matching
    // IMPORTANT: Only include teams that are actually football teams (sportType: 'FOOTBALL')
    // Include shortName for better matching (e.g., "Lyon" matches "Olympique Lyonnais")
    const allOurTeams = uniqueGamesToCheck
      .filter(game => game.homeTeam.sportType === 'FOOTBALL' && game.awayTeam.sportType === 'FOOTBALL')
      .flatMap(game => [
        { id: game.homeTeam.id, name: game.homeTeam.name, shortName: game.homeTeam.shortName },
        { id: game.awayTeam.id, name: game.awayTeam.name, shortName: game.awayTeam.shortName }
      ]);
    
    // Remove duplicates
    const uniqueTeams = Array.from(
      new Map(allOurTeams.map(team => [team.id, team])).values()
    );
    
    console.log(`📊 Using ${uniqueTeams.length} unique football teams for matching (from ${uniqueGamesToCheck.length} games)`);
    console.log(`📊 LIVE games: ${ourLiveGames.length}, Recently finished: ${uniqueGamesToCheck.length - ourLiveGames.length}`);
    
    // Collect failed matches for OpenAI fallback
    const failedMatches: Array<{
      externalMatch: any;
      homeMatch: any;
      awayMatch: any;
      reason: string;
    }> = [];
    
    for (const externalMatch of allExternalMatches) {
      try {
        processedCount++;
        console.log(`🔍 Processing ${processedCount}/${allExternalMatches.length}: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name} (ID: ${externalMatch.id})`);

        // PRIORITY 1: V1-STYLE SIMPLE MATCHING FOR LIVE GAMES (Most reliable - like V1 that worked perfectly)
        // This is the key: if a game is LIVE in our DB, simple team matching is almost always correct
        let matchingGame: typeof ourLiveGames[0] | null = null;
        let matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let matchMethod = '';

        // Step 1A: Try simple team matching in LIVE games only (V1 style - most reliable)
        if (ourLiveGames.length > 0) {
          // Get teams from LIVE games only for this matching attempt
          const liveTeams = ourLiveGames.flatMap(game => [
            { id: game.homeTeam.id, name: game.homeTeam.name, shortName: game.homeTeam.shortName },
            { id: game.awayTeam.id, name: game.awayTeam.name, shortName: game.awayTeam.shortName }
          ]);

          const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, liveTeams);
          const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, liveTeams);

          // For V1-style LIVE matching we are extremely strict:
          // - Both teams must have a very strong match (score >= 0.9)
          // - This path is only allowed to produce HIGH confidence matches
          if (
            homeMatch &&
            awayMatch &&
            homeMatch.score >= 0.9 &&
            awayMatch.score >= 0.9
          ) {
            // Find game in LIVE games that contains both matched teams (V1 style)
            const liveMatch = ourLiveGames.find(game => 
              (game.homeTeam.id === homeMatch.team.id || game.awayTeam.id === homeMatch.team.id) &&
              (game.homeTeam.id === awayMatch.team.id || game.awayTeam.id === awayMatch.team.id)
            );

            if (liveMatch) {
              matchingGame = liveMatch;
              matchConfidence = 'HIGH';
              matchMethod = 'V1-style LIVE game match';
              console.log(`   ✅ HIGH CONFIDENCE: Found LIVE game match (V1 style): ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
              console.log(`      Home: ${externalMatch.homeTeam.name} → ${homeMatch.team.name} (${homeMatch.method}, ${(homeMatch.score * 100).toFixed(1)}%)`);
              console.log(`      Away: ${externalMatch.awayTeam.name} → ${awayMatch.team.name} (${awayMatch.method}, ${(awayMatch.score * 100).toFixed(1)}%)`);
            }
          } else if (homeMatch || awayMatch) {
            console.log(
              `   ⚠️ LIVE V1-style match discarded due to low score: homeScore=${homeMatch?.score?.toFixed(2) ?? 'n/a'}, awayScore=${awayMatch?.score?.toFixed(2) ?? 'n/a'}`
            );
          }
        }

        // Step 1B: If not found in LIVE games, try externalId matching (only if we have externalId)
        if (!matchingGame && externalMatch.id) {
          const externalIdMatch = uniqueGamesToCheck.find(game => {
            if (!game.externalId || game.competition.sportType !== 'FOOTBALL') return false;
            return game.externalId.toString() === externalMatch.id.toString();
          });

          if (externalIdMatch) {
            // CRITICAL: Verify team names match (external IDs can be reused or point to wrong games)
            const allTeams = uniqueGamesToCheck.flatMap(game => [
              { id: game.homeTeam.id, name: game.homeTeam.name, shortName: game.homeTeam.shortName },
              { id: game.awayTeam.id, name: game.awayTeam.name, shortName: game.awayTeam.shortName }
            ]);
            
            const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, allTeams);
            const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, allTeams);
            
            // CRITICAL: Both teams must match in CORRECT positions with HIGH confidence
            // Check both normal and reversed positions
            const homeMatchesHome = homeMatch && homeMatch.team.id === externalIdMatch.homeTeam.id;
            const awayMatchesAway = awayMatch && awayMatch.team.id === externalIdMatch.awayTeam.id;
            const homeMatchesAway = homeMatch && homeMatch.team.id === externalIdMatch.awayTeam.id;
            const awayMatchesHome = awayMatch && awayMatch.team.id === externalIdMatch.homeTeam.id;
            
            // Require BOTH teams to match in the SAME orientation (both normal OR both reversed)
            const matchesNormal = homeMatchesHome && awayMatchesAway;
            const matchesReversed = homeMatchesAway && awayMatchesHome;
            const teamsMatchCorrectly = matchesNormal || matchesReversed;
            
            // Safety check: Only clear externalId if BOTH teams have LOW confidence or no match
            // This prevents clearing correct externalIds due to minor name variations
            const homeMatchConfidence = homeMatch?.score ?? 0;
            const awayMatchConfidence = awayMatch?.score ?? 0;
            const MIN_TEAM_MATCH_CONFIDENCE = 0.85; // Require 85%+ confidence to trust a team match
            const bothTeamsLowConfidence = homeMatchConfidence < MIN_TEAM_MATCH_CONFIDENCE && awayMatchConfidence < MIN_TEAM_MATCH_CONFIDENCE;
            
            // CRITICAL: Don't clear externalId if game is LIVE and has been syncing successfully
            // This prevents clearing correct externalIds during temporary API inconsistencies (e.g., halftime)
            const isLiveAndSyncing = externalIdMatch.status === 'LIVE' && 
                                     externalIdMatch.lastSyncAt && 
                                     (Date.now() - externalIdMatch.lastSyncAt.getTime()) < 10 * 60 * 1000; // Synced within last 10 minutes
            
            if (!teamsMatchCorrectly) {
              console.log(`   ⚠️ ExternalId match found but team names don't match in correct positions - rejecting`);
              console.log(`      DB: ${externalIdMatch.homeTeam.name} vs ${externalIdMatch.awayTeam.name}`);
              console.log(`      API: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
              console.log(`      Home match: ${homeMatch ? `${homeMatch.team.name} (score: ${(homeMatch.score * 100).toFixed(1)}%, method: ${homeMatch.method}, matches DB home: ${homeMatchesHome}, matches DB away: ${homeMatchesAway})` : 'NOT FOUND'}`);
              console.log(`      Away match: ${awayMatch ? `${awayMatch.team.name} (score: ${(awayMatch.score * 100).toFixed(1)}%, method: ${awayMatch.method}, matches DB home: ${awayMatchesHome}, matches DB away: ${awayMatchesAway})` : 'NOT FOUND'}`);
              console.log(`      Normal match: ${matchesNormal}, Reversed match: ${matchesReversed}`);
              
              // SAFETY: Never clear externalId if game is LIVE and has been syncing successfully
              // This prevents clearing correct externalIds during temporary API inconsistencies
              if (isLiveAndSyncing) {
                console.log(`   ⚠️ SKIPPING externalId clear: Game is LIVE and has been syncing successfully (lastSync: ${externalIdMatch.lastSyncAt?.toISOString()}) - might be temporary API inconsistency, not wrong match`);
                continue; // Skip clearing and continue to next match
              }
              
              // SAFETY: Only clear externalId if BOTH teams have low confidence
              // If one team matches well, it might be a name variation issue, not a wrong match
              if (!bothTeamsLowConfidence) {
                console.log(`   ⚠️ SKIPPING externalId clear: One or both teams have high confidence matches (home: ${(homeMatchConfidence * 100).toFixed(1)}%, away: ${(awayMatchConfidence * 100).toFixed(1)}%) - might be name variation, not wrong match`);
                continue; // Skip clearing and continue to next match
              }
              
              // CRITICAL: Clear the wrong externalId and reset status/scores if game was incorrectly marked as FINISHED
              const gameIdToClear = externalIdMatch.id;
              const wasIncorrectlyFinished = externalIdMatch.status === 'FINISHED' && externalIdMatch.externalId === externalMatch.id.toString();
              
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
              // CRITICAL: Verify competition name makes sense for football
              // Reject if external competition is clearly a rugby competition
              const externalCompName = externalMatch.competition?.name?.toLowerCase() || '';
              const rugbyKeywords = ['top 14', 'pro d2', 'six nations', 'champions cup', 'challenge cup', 'premiership', 'super rugby'];
              const isRugbyCompetition = rugbyKeywords.some(keyword => externalCompName.includes(keyword));
              
              if (isRugbyCompetition) {
                console.log(`   ⚠️ ExternalId match found but competition is wrong sport - rejecting`);
                console.log(`      DB Competition: ${externalIdMatch.competition.name} (FOOTBALL)`);
                console.log(`      API Competition: ${externalMatch.competition?.name || 'unknown'} (appears to be RUGBY)`);
                
                // CRITICAL: Clear the wrong externalId and reset status/scores if game was incorrectly marked as FINISHED
                const gameIdToClear = externalIdMatch.id;
                const wasIncorrectlyFinished = externalIdMatch.status === 'FINISHED' && externalIdMatch.externalId === externalMatch.id.toString();
                
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
                // Team names match and competition is correct, now verify date
                if (externalMatch.utcDate) {
                  const apiMatchDate = new Date(externalMatch.utcDate);
                  const dbGameDate = new Date(externalIdMatch.date);
                  const daysDiff = Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60 * 24);
                  
                  // For football, reject if dates are more than 7 days apart (likely different matchday/season)
                  if (daysDiff > 7) {
                    console.log(`   ⚠️ ExternalId match found but date is from different season/matchday - rejecting`);
                    console.log(`      DB Date: ${dbGameDate.toISOString().split('T')[0]} (${externalIdMatch.competition.name})`);
                    console.log(`      API Date: ${apiMatchDate.toISOString().split('T')[0]} (${externalMatch.competition?.name || 'unknown'})`);
                    console.log(`      Date difference: ${daysDiff.toFixed(1)} days`);
                    
                    // CRITICAL: Clear the wrong externalId and reset status/scores if game was incorrectly marked as FINISHED
                    const gameIdToClear = externalIdMatch.id;
                    const wasIncorrectlyFinished = externalIdMatch.status === 'FINISHED' && externalIdMatch.externalId === externalMatch.id.toString();
                    
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
                    const hoursDiff = Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60);
                    if (hoursDiff <= 1) {
                      matchingGame = externalIdMatch;
                      matchConfidence = 'HIGH';
                      matchMethod = 'externalId + team names + competition + date verified';
                      console.log(`   ✅ HIGH CONFIDENCE: Found by externalId: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
                      console.log(`      Team names verified, competition verified, date verified: ${hoursDiff.toFixed(2)} hours difference`);
                    } else {
                      console.log(`   ⚠️ ExternalId match found, team names match, competition match, but date differs by ${hoursDiff.toFixed(2)} hours - rejecting`);
                    }
                  }
                } else {
                  // Team names match and competition is correct but no date to verify
                  matchingGame = externalIdMatch;
                  matchConfidence = 'MEDIUM';
                  matchMethod = 'externalId + team names + competition verified (no date)';
                  console.log(`   ⚠️ MEDIUM CONFIDENCE: Found by externalId: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
                  console.log(`      Team names verified, competition verified, but no date to verify`);
                }
              }
            }
          }
        }

        // Step 2: If still not found, try complex matching (team + date + competition)
        // This is only for games that aren't LIVE yet or recently finished
        if (!matchingGame) {
          console.log(`   No simple match found, trying complex matching...`);
          
          const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
          const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);

          if (!homeMatch || !awayMatch) {
            console.log(`⚠️ No team matches found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            // Collect for OpenAI fallback
            failedMatches.push({
              externalMatch,
              homeMatch,
              awayMatch,
              reason: 'no_team_match'
            });
            continue;
          }
          
          // Check confidence - if below 90%, use OpenAI
          const MIN_TEAM_MATCH_CONFIDENCE = 0.9; // 90%
          const homeMatchConfident = homeMatch && homeMatch.score >= MIN_TEAM_MATCH_CONFIDENCE;
          const awayMatchConfident = awayMatch && awayMatch.score >= MIN_TEAM_MATCH_CONFIDENCE;
          const overallConfidence = homeMatch && awayMatch 
            ? (homeMatch.score + awayMatch.score) / 2 
            : (homeMatch?.score || awayMatch?.score || 0);
          
          if (!homeMatchConfident || !awayMatchConfident || overallConfidence < 0.9) {
            console.log(`⚠️ Confidence below 90% for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            console.log(`   Overall confidence: ${(overallConfidence * 100).toFixed(1)}% (threshold: 90%)`);
            console.log(`   🤖 Will use OpenAI to verify and guarantee 100% match`);
            failedMatches.push({
              externalMatch,
              homeMatch,
              awayMatch,
              reason: 'confidence_below_90_percent',
              matchConfidence: overallConfidence < 0.85 ? 'LOW' : 'MEDIUM'
            });
            continue;
          }

          // Find ALL potential games that match by teams
          const potentialMatches = uniqueGamesToCheck.filter(game => 
            (game.homeTeam.id === homeMatch.team.id || game.awayTeam.id === homeMatch.team.id) &&
            (game.homeTeam.id === awayMatch.team.id || game.awayTeam.id === awayMatch.team.id) &&
            game.competition.sportType === 'FOOTBALL'
          );

          if (potentialMatches.length === 0) {
            console.log(`⚠️ No matching games found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
            continue;
          }

          console.log(`   Found ${potentialMatches.length} potential match(es) by team names`);

          // Filter by date/time
          let matchesWithDate: Array<{game: typeof potentialMatches[0], timeDiff: number, hoursDiff: number, competitionScore: number}> = [];
          
          if (externalMatch.utcDate) {
            const apiMatchDate = new Date(externalMatch.utcDate);
            
            matchesWithDate = potentialMatches.map(game => {
              const gameDate = new Date(game.date);
              const timeDiff = Math.abs(gameDate.getTime() - apiMatchDate.getTime());
              const hoursDiff = timeDiff / (1000 * 60 * 60);
              
              // Calculate competition score
              let competitionScore = 0;
              if (externalMatch.competition?.name) {
                const apiComp = externalMatch.competition.name.toLowerCase().trim();
                const dbComp = game.competition.name.toLowerCase().trim();
                
                if (dbComp === apiComp) {
                  competitionScore = 1.0;
                } else if (dbComp.includes(apiComp) || apiComp.includes(dbComp)) {
                  competitionScore = 0.8;
                } else {
                  const dbWords = dbComp.split(/\s+/).filter(w => w.length > 3);
                  const apiWords = apiComp.split(/\s+/).filter(w => w.length > 3);
                  const commonWords = dbWords.filter(w => apiWords.includes(w));
                  if (commonWords.length >= 2) {
                    competitionScore = commonWords.length / Math.max(dbWords.length, apiWords.length);
                  }
                }
              }
              
              return { game, timeDiff, hoursDiff, competitionScore };
            });

            // Sort by competition score first, then by date
            matchesWithDate.sort((a, b) => {
              if (b.competitionScore !== a.competitionScore) {
                return b.competitionScore - a.competitionScore;
              }
              return a.timeDiff - b.timeDiff;
            });

            // Filter to matches within 30 minutes with good competition match
            const strictMatches = matchesWithDate.filter(m => m.hoursDiff <= 0.5 && m.competitionScore >= 0.7);
            
            if (strictMatches.length > 0) {
              matchingGame = strictMatches[0].game;
              matchConfidence = 'MEDIUM';
              matchMethod = 'team + date (30min) + competition (≥0.7)';
              console.log(`   ✅ MEDIUM CONFIDENCE: Found match with strict criteria`);
              console.log(`      Competition: ${matchingGame.competition.name} (score: ${strictMatches[0].competitionScore.toFixed(2)})`);
              console.log(`      Date diff: ${strictMatches[0].hoursDiff.toFixed(2)} hours`);
            } else {
              // Require very strict competition match if date is far
              const looseMatches = matchesWithDate.filter(m => {
                if (m.hoursDiff <= 0.5) {
                  return m.competitionScore >= 0.6; // Allow lower competition score if date is close
                } else if (m.hoursDiff <= 2) {
                  return m.competitionScore >= 0.9; // Require very high competition score if date is far
                }
                return false; // Reject matches more than 2 hours apart
              });

              if (looseMatches.length > 0) {
                matchingGame = looseMatches[0].game;
                matchConfidence = 'LOW';
                matchMethod = `team + date (${looseMatches[0].hoursDiff.toFixed(2)}h) + competition (${looseMatches[0].competitionScore.toFixed(2)})`;
                console.log(`   ⚠️ LOW CONFIDENCE: Found match with loose criteria`);
                console.log(`      Competition: ${matchingGame.competition.name} (score: ${looseMatches[0].competitionScore.toFixed(2)})`);
                console.log(`      Date diff: ${looseMatches[0].hoursDiff.toFixed(2)} hours`);
                console.log(`      ⚠️ This match will require additional validation before update`);
              }
            }
          } else {
            // No date in API - require perfect competition match
            if (externalMatch.competition?.name && potentialMatches.length === 1) {
              const apiComp = externalMatch.competition.name.toLowerCase().trim();
              const dbComp = potentialMatches[0].competition.name.toLowerCase().trim();
              
              if (dbComp === apiComp || dbComp.includes(apiComp) || apiComp.includes(dbComp)) {
                matchingGame = potentialMatches[0];
                matchConfidence = 'MEDIUM';
                matchMethod = 'team + competition (no date)';
                console.log(`   ⚠️ MEDIUM CONFIDENCE: Single match with competition match (no date in API)`);
              }
            }
          }
        }

        if (!matchingGame) {
          console.log(`⚠️ No matching football game found for: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
          console.log(`   Searched in ${uniqueGamesToCheck.length} football games`);
          unmatchedMatches.push({
            externalMatch: {
              home: externalMatch.homeTeam.name,
              away: externalMatch.awayTeam.name,
              id: externalMatch.id,
              competition: externalMatch.competition?.name,
            },
            reason: 'No matching game found in database',
          });
          
          // Collect for OpenAI fallback
          const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
          const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);
          failedMatches.push({
            externalMatch,
            homeMatch,
            awayMatch,
            reason: 'no_match_found'
          });
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
        
        // CRITICAL: Confidence-based validation before applying updates
        // LOW confidence matches are rejected to prevent wrong score updates
        const apiMatchDate = externalMatch.utcDate ? new Date(externalMatch.utcDate) : null;
        const dbGameDate = new Date(matchingGame.date);
        const dateDiff = apiMatchDate ? Math.abs(apiMatchDate.getTime() - dbGameDate.getTime()) / (1000 * 60 * 60) : null;
        
        // Additional validation for LOW confidence matches
        if (matchConfidence === 'LOW') {
          // Reject LOW confidence matches if:
          // 1. Trying to set FINISHED status (wrong final score risk)
          // 2. Date difference is large (> 1 hour)
          // 3. Competition doesn't match well
          const isTryingToFinish =
            externalMatch.status === 'FT' || externalMatch.status === 'FINISHED';
          const competitionMatches = externalMatch.competition?.name
            ? (() => {
                const apiComp = externalMatch.competition.name.toLowerCase().trim();
                const dbComp = matchingGame.competition.name.toLowerCase().trim();
                return (
                  dbComp === apiComp ||
                  dbComp.includes(apiComp) ||
                  apiComp.includes(dbComp)
                );
              })()
            : false;

          if (isTryingToFinish || (dateDiff !== null && dateDiff > 1) || !competitionMatches) {
            rejectedCount++;
            const reasons = [];
            if (isTryingToFinish) reasons.push('Trying to set FINISHED status');
            if (dateDiff !== null && dateDiff > 1) reasons.push(`Large date difference (${dateDiff.toFixed(2)}h)`);
            if (!competitionMatches) reasons.push('Competition mismatch');
            
            const rejectionReason = reasons.join(' + ');
            console.log(`   ❌ REJECTING LOW CONFIDENCE MATCH:`);
            console.log(`      Reason: ${rejectionReason}`);
            console.log(`      Match method: ${matchMethod}`);
            console.log(`      This could cause wrong final score - REJECTED for safety`);
            console.log(`   🤖 Will use OpenAI to verify and guarantee 100% match`);
            
            rejectedMatches.push({
              externalMatch: {
                home: externalMatch.homeTeam.name,
                away: externalMatch.awayTeam.name,
                id: externalMatch.id,
                competition: externalMatch.competition?.name,
              },
              reason: rejectionReason,
              details: `Method: ${matchMethod}, Date diff: ${dateDiff?.toFixed(2) || 'N/A'}h`,
            });
            
            // Collect for OpenAI fallback
            const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, uniqueTeams);
            const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, uniqueTeams);
            failedMatches.push({
              externalMatch,
              homeMatch,
              awayMatch,
              reason: 'low_confidence_rejected',
              matchConfidence: 'LOW'
            });
            continue; // Skip this match
          }
        }
        
        // CRITICAL: Don't update games if external API shows NS (Not Started) or TBD
        // Games that haven't started should remain UPCOMING, not be marked as LIVE
        // CRITICAL: Don't update games if external API shows NS (Not Started)
        // Games that haven't started should remain UPCOMING, not be marked as LIVE
        // If game is already LIVE but external API shows NS, reset it back to UPCOMING
        // BUT: Still set externalId if game doesn't have one yet
        if (externalMatch.externalStatus === 'NS' || externalMatch.externalStatus === 'TBD' || externalMatch.externalStatus === 'POST') {
          console.log(`   ⏭️ External API shows ${externalMatch.externalStatus} (Not Started/Postponed)`);
          console.log(`      Game ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} is currently ${matchingGame.status}`);
          
          // If game doesn't have externalId yet, set it (even though game hasn't started)
          const needsExternalId = !matchingGame.externalId || matchingGame.externalId !== externalMatch.id.toString();
          
          // If game is incorrectly marked as LIVE, reset it to UPCOMING
          if (matchingGame.status === 'LIVE') {
            console.log(`   ⚠️ Game is LIVE but external API shows ${externalMatch.externalStatus} - resetting to UPCOMING`);
            try {
              const updateData: any = {
                status: 'UPCOMING',
                externalStatus: externalMatch.externalStatus,
                liveHomeScore: null,
                liveAwayScore: null,
                elapsedMinute: null
              };
              if (needsExternalId) {
                updateData.externalId = externalMatch.id.toString();
                console.log(`   📝 Also setting externalId: ${externalMatch.id}`);
              }
              await prisma.game.update({
                where: { id: matchingGame.id },
                data: updateData
              });
              console.log(`   ✅ Reset game ${matchingGame.id} from LIVE to UPCOMING${needsExternalId ? ' and set externalId' : ''}`);
              updatedGameIds.add(matchingGame.id);
            } catch (error) {
              console.error(`   ❌ Error resetting game status:`, error);
            }
          }
          continue; // Skip further processing - game hasn't started yet
        }
        
        // FINAL VALIDATION: Log full match details before applying update
        matchedCount++;
        console.log(`✅ Matched ${matchedCount}/${allExternalMatches.length}: ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
        console.log(`   🎯 Confidence: ${matchConfidence} | Method: ${matchMethod}`);
        console.log(`   📍 Competition: ${matchingGame.competition.name} (${matchingGame.competition.sportType})`);
        console.log(`   📅 Date: DB=${dbGameDate.toISOString()}, API=${apiMatchDate?.toISOString() || 'N/A'}, Diff=${dateDiff?.toFixed(2) || 'N/A'} hours`);
        console.log(`   👥 Teams: DB=${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name}`);
        console.log(`            API=${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
        console.log(`   📊 Score: External=${externalMatch.score.fullTime.home}-${externalMatch.score.fullTime.away}, DB=${matchingGame.liveHomeScore || 0}-${matchingGame.liveAwayScore || 0}`);
        console.log(`   ⏱️  Elapsed: External=${externalMatch.elapsedMinute} min`);
        
        // Final safety check: If competition doesn't match well and date is far, reject
        if (externalMatch.competition?.name && dateDiff !== null && dateDiff > 1) {
          const apiComp = externalMatch.competition.name.toLowerCase().trim();
          const dbComp = matchingGame.competition.name.toLowerCase().trim();
          if (!apiComp.includes(dbComp) && !dbComp.includes(apiComp)) {
            console.log(`   ❌ REJECTING: Competition mismatch with large date difference!`);
            console.log(`      API: "${externalMatch.competition.name}" vs DB: "${matchingGame.competition.name}"`);
            console.log(`      Date diff: ${dateDiff.toFixed(2)} hours`);
            console.log(`      This is likely the wrong match - REJECTED`);
            continue; // Skip this match
          }
        }

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
        // Use let because we may need to correct it for safety (e.g. HT should never be FINISHED)
        let newStatus = externalMatch.status; // Already mapped by ApiSportsAPI
        const newExternalStatus = externalMatch.externalStatus; // Original external status (HT, 1H, 2H, etc.)
        
        // IMPORTANT: Ensure that HT, 1H, 2H are always treated as LIVE, not FINISHED
        // This prevents matches in half-time from being incorrectly marked as finished
        if ((newExternalStatus === 'HT' || newExternalStatus === '1H' || newExternalStatus === '2H') && newStatus === 'FINISHED') {
          console.log(`⚠️ External status is ${newExternalStatus} (LIVE) but mapping returned FINISHED - correcting to LIVE`);
          newStatus = 'LIVE';
        }
        
        // CRITICAL: Don't update games if external API shows NS (Not Started)
        // Games that haven't started should remain UPCOMING, not be marked as LIVE
        // If game is already LIVE but external API shows NS, reset it back to UPCOMING
        if (newExternalStatus === 'NS' || newExternalStatus === 'TBD' || newExternalStatus === 'POST') {
          console.log(`   ⏭️ External API shows ${newExternalStatus} (Not Started/Postponed)`);
          console.log(`      Game ${matchingGame.homeTeam.name} vs ${matchingGame.awayTeam.name} is currently ${matchingGame.status}`);
          
          // If game is incorrectly marked as LIVE, reset it to UPCOMING
          if (matchingGame.status === 'LIVE') {
            console.log(`   ⚠️ Game is LIVE but external API shows NS - resetting to UPCOMING`);
            try {
              await prisma.game.update({
                where: { id: matchingGame.id },
                data: {
                  status: 'UPCOMING',
                  externalStatus: null,
                  liveHomeScore: null,
                  liveAwayScore: null,
                  elapsedMinute: null
                }
              });
              console.log(`   ✅ Reset game ${matchingGame.id} from LIVE to UPCOMING`);
              updatedGameIds.add(matchingGame.id);
              continue; // Skip further processing
            } catch (error) {
              console.error(`   ❌ Error resetting game status:`, error);
            }
          }
          continue; // Skip this match - game hasn't started yet
        }
        
        // CRITICAL: Prevent invalid status transitions
        // A game cannot "un-start" - once LIVE, it can only go to FINISHED, not back to UPCOMING
        // The external API might show NS/UPCOMING if it's slow to update or the game is delayed
        // CRITICAL: Prevent invalid status transitions
        // A game cannot "un-start" - once LIVE, it can only go to FINISHED, not back to UPCOMING
        // EXCEPTION: If external status is POST/NS/TBD, the game was postponed/not started, so reset to UPCOMING
        if (matchingGame.status === 'LIVE' && newStatus === 'UPCOMING') {
          // Allow transition if game was postponed/not started (POST/NS/TBD)
          if (newExternalStatus === 'POST' || newExternalStatus === 'NS' || newExternalStatus === 'TBD') {
            console.log(`   ✅ ALLOWING status transition: LIVE → UPCOMING (game was ${newExternalStatus})`);
            // Status will be set to UPCOMING below
          } else {
            console.log(`   ⚠️ BLOCKING invalid status transition: LIVE → UPCOMING`);
            console.log(`      External API shows ${newExternalStatus} (mapped to UPCOMING), but game is already LIVE`);
            console.log(`      This can happen if external API is slow to update or game is delayed`);
            console.log(`      Keeping status as LIVE - will update when external API shows game has started`);
            newStatus = 'LIVE'; // Keep it as LIVE
          }
        }
        
        const statusChanged = newStatus !== matchingGame.status;

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
        updateData.liveHomeScore = externalHomeScore;
        updateData.liveAwayScore = externalAwayScore;

        // V2: Add elapsedMinute if available, but NOT during half-time (HT)
        // During half-time, elapsedMinute should be null to show "MT" badge
        if (newExternalStatus === 'HT') {
          // Half-time: set elapsedMinute to null to show "MT" badge
          updateData.elapsedMinute = null;
          console.log(`   ⏱️ Half-time (HT) - setting elapsedMinute to null to show MT badge`);
        } else if (externalMatch.elapsedMinute !== null && externalMatch.elapsedMinute !== undefined) {
          const previousElapsed = (matchingGame as any).elapsedMinute;
          updateData.elapsedMinute = externalMatch.elapsedMinute;
          if (previousElapsed !== externalMatch.elapsedMinute) {
            console.log(`   ⏱️ Chronometer updated: ${previousElapsed ?? 'null'}' → ${externalMatch.elapsedMinute}'`);
          } else {
            console.log(`   ⏱️ Chronometer unchanged: ${externalMatch.elapsedMinute}' (API may not be updating in real-time)`);
          }
        } else {
          console.log(`   ⏱️ No elapsedMinute in external match (value: ${externalMatch.elapsedMinute})`);
        }

        // CRITICAL SAFETY CHECK: Before setting FINISHED status, verify that:
        // - Competition matches strongly
        // - Date is close (≤ 30 minutes)
        // This applies for ALL confidence levels – even HIGH must pass this gate.
        if (newStatus === 'FINISHED') {
          const competitionMatchesForFinish = externalMatch.competition?.name
            ? (() => {
                const apiComp = externalMatch.competition.name.toLowerCase().trim();
                const dbComp = matchingGame.competition.name.toLowerCase().trim();
                return (
                  dbComp === apiComp ||
                  dbComp.includes(apiComp) ||
                  apiComp.includes(dbComp)
                );
              })()
            : false;

          const dateIsVeryClose = dateDiff !== null && dateDiff <= 0.5; // 30 minutes

          if (!competitionMatchesForFinish || !dateIsVeryClose) {
            console.log(
              `   ❌ REJECTING FINISHED STATUS: competition/date validation failed (confidence=${matchConfidence})`
            );
            console.log(
              `      Competition match: ${competitionMatchesForFinish ? 'YES' : 'NO'}`
            );
            console.log(
              `      Date close (≤30min): ${dateIsVeryClose ? 'YES' : 'NO'} (${dateDiff?.toFixed(
                2
              ) || 'N/A'} hours)`
            );
            console.log(
              `      This could set wrong final score - keeping current status ${matchingGame.status}`
            );
            // Don't set FINISHED, but allow LIVE updates (scores/elapsed) to proceed
            newStatus = matchingGame.status;
            updateData.status = matchingGame.status;
          } else {
            console.log(
              `   ✅ FINISHED status validated: competition and date are consistent (confidence=${matchConfidence})`
            );
          }

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
          }
        }
        
        if (matchingGame.status === 'LIVE' && newStatus === 'LIVE') {
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
          
          // Award final winner points if this is the Champions League final
          const { awardFinalWinnerPoints } = await import('../../lib/award-final-winner-points');
          await awardFinalWinnerPoints(
            matchingGame.id,
            matchingGame.competitionId,
            externalHomeScore,
            externalAwayScore
          );
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
    const uniqueRemainingGamesToCheck = remainingGamesToCheck.filter((game, index, self) => 
      index === self.findIndex(g => g.id === game.id)
    );
    
    for (const game of uniqueRemainingGamesToCheck) {
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

    // OpenAI Fallback for FOOTBALL (V2):
    // We currently collect failedMatches but didn't use OpenAI yet.
    // Here we use OpenAI to at least attach the correct externalId to hard-to-match games,
    // so that subsequent syncs can use the more reliable ID-based matching path.
    let openAIMatchedCount = 0;
    let openAIExternalIdSetCount = 0;
    let openAIDebugInfo: any = {
      skippedNoResult: 0,
      skippedNoGameId: 0,
      skippedNoConfidence: 0,
      skippedLowConfidence: 0,
      skippedGameNotFound: 0,
      upcomingGamesCount: 0,
      sampleFailedMatches: [],
      sampleUpcomingGames: []
    };
    if (failedMatches.length > 0) {
      console.log(`\n🤖 FOOTBALL V2: Attempting OpenAI fallback for ${failedMatches.length} failed matches...`);
      const openAIApiKey = process.env.OPENAI_API_KEY || null;
      console.log(`🔑 OpenAI API key present: ${openAIApiKey ? 'YES' : 'NO'}`);

      if (openAIApiKey) {
        try {
          // Log sample of failed matches to see what we're trying to match
          console.log(`🤖 FOOTBALL V2: Sample failed matches (first 5):`);
          openAIDebugInfo.sampleFailedMatches = failedMatches.slice(0, 5).map(fm => ({
            home: fm.externalMatch.homeTeam.name,
            away: fm.externalMatch.awayTeam.name,
            competition: fm.externalMatch.competition?.name || 'Unknown',
            date: fm.externalMatch.utcDate || 'Unknown'
          }));
          failedMatches.slice(0, 5).forEach((fm, idx) => {
            console.log(`   ${idx + 1}. ${fm.externalMatch.homeTeam.name} vs ${fm.externalMatch.awayTeam.name} (Competition: ${fm.externalMatch.competition?.name || 'Unknown'}, Date: ${fm.externalMatch.utcDate || 'Unknown'})`);
          });
          
          // Log sample of games in uniqueGamesToCheck to see if UPCOMING/LIVE games without externalId are included
          const upcomingGames = uniqueGamesToCheck.filter(g => g.status === 'UPCOMING');
          const liveGamesNoExternalId = uniqueGamesToCheck.filter(g => g.status === 'LIVE' && !g.externalId);
          openAIDebugInfo.upcomingGamesCount = upcomingGames.length + liveGamesNoExternalId.length;
          console.log(`🤖 FOOTBALL V2: Found ${upcomingGames.length} UPCOMING games and ${liveGamesNoExternalId.length} LIVE games without externalId in uniqueGamesToCheck (total: ${uniqueGamesToCheck.length})`);
          if (liveGamesNoExternalId.length > 0) {
            console.log(`🤖 FOOTBALL V2: Sample LIVE games without externalId (first 5):`);
            liveGamesNoExternalId.slice(0, 5).forEach((game, idx) => {
              console.log(`   ${idx + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} (ID: ${game.id}, Date: ${game.date?.toISOString() || 'Unknown'})`);
            });
          }
          if (upcomingGames.length > 0) {
            openAIDebugInfo.sampleUpcomingGames = [...liveGamesNoExternalId.slice(0, 3), ...upcomingGames.slice(0, 2)].map(game => ({
              id: game.id,
              home: game.homeTeam.name,
              away: game.awayTeam.name,
              date: game.date?.toISOString() || 'Unknown',
              status: game.status
            }));
            console.log(`🤖 FOOTBALL V2: Sample UPCOMING games (first 5):`);
            upcomingGames.slice(0, 5).forEach((game, idx) => {
              console.log(`   ${idx + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} (ID: ${game.id}, Date: ${game.date?.toISOString() || 'Unknown'})`);
            });
          }

          // Filter failed matches to prioritize important competitions (Champions League, Ligue 1, etc.)
          // This reduces the number of OpenAI calls and focuses on games we actually care about
          // Use more specific patterns to avoid false matches (e.g., "Premier League" matching "Jamaican Premier League")
          const importantCompetitionPatterns = [
            /UEFA Champions League/i,
            /Champions League/i,
            /Ligue 1/i,
            /English Premier League/i,
            /Premier League$/i, // Only match if it ends with "Premier League" (not "Jamaican Premier League")
            /La Liga/i,
            /Serie A/i,
            /Bundesliga/i,
            /UEFA Europa League/i,
            /Europa League/i
          ];
          
          // Also get team names from LIVE games without externalId to prioritize those matches
          const liveGameTeamNames = new Set<string>();
          liveGamesNoExternalId.forEach(game => {
            liveGameTeamNames.add(game.homeTeam.name.toLowerCase());
            liveGameTeamNames.add(game.awayTeam.name.toLowerCase());
            if (game.homeTeam.shortName) liveGameTeamNames.add(game.homeTeam.shortName.toLowerCase());
            if (game.awayTeam.shortName) liveGameTeamNames.add(game.awayTeam.shortName.toLowerCase());
          });
          
          const prioritizedFailedMatches = failedMatches.filter(fm => {
            const compName = fm.externalMatch.competition?.name || '';
            
            // Check if competition matches important patterns
            const matchesImportantComp = importantCompetitionPatterns.some(pattern => pattern.test(compName));
            
            // Check if teams match our LIVE games without externalId
            const homeTeamLower = fm.externalMatch.homeTeam.name.toLowerCase();
            const awayTeamLower = fm.externalMatch.awayTeam.name.toLowerCase();
            const matchesLiveGame = liveGameTeamNames.has(homeTeamLower) || liveGameTeamNames.has(awayTeamLower);
            
            return matchesImportantComp || matchesLiveGame;
          });
          
          // If we have prioritized matches, use those; otherwise use all (but limit to 50 to avoid rate limits)
          const matchesToProcess = prioritizedFailedMatches.length > 0 
            ? prioritizedFailedMatches.slice(0, 50) // Limit to 50 to avoid rate limits
            : failedMatches.slice(0, 50); // Limit to 50 to avoid rate limits
          
          console.log(`🤖 FOOTBALL V2: Filtered ${failedMatches.length} failed matches to ${matchesToProcess.length} prioritized matches`);
          console.log(`🤖 FOOTBALL V2: Sample prioritized matches (first 5):`);
          matchesToProcess.slice(0, 5).forEach((fm, idx) => {
            console.log(`   ${idx + 1}. ${fm.externalMatch.homeTeam.name} vs ${fm.externalMatch.awayTeam.name} (${fm.externalMatch.competition?.name || 'Unknown'})`);
          });
          
          // Prepare OpenAI requests for prioritized matches only
          const prioritizedOpenAIRequests = matchesToProcess.map(fm => ({
            externalHome: fm.externalMatch.homeTeam.name,
            externalAway: fm.externalMatch.awayTeam.name,
            externalDate: fm.externalMatch.utcDate || null,
            externalCompetition: fm.externalMatch.competition?.name || null,
            dbGames: uniqueGamesToCheck.map(game => ({
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
            dbTeams: uniqueTeams,
          }));

          console.log(`🤖 FOOTBALL V2: Calling OpenAI with ${prioritizedOpenAIRequests.length} requests (batched)...`);
          const openAIResults = await matchTeamsWithOpenAI(prioritizedOpenAIRequests, openAIApiKey);
          console.log(`🤖 FOOTBALL V2: OpenAI returned ${openAIResults.size} results`);
          
          // Log sample of what OpenAI returned
          if (openAIResults.size > 0) {
            console.log(`🤖 FOOTBALL V2: Sample OpenAI results (first 5):`);
            let sampleCount = 0;
            for (const [key, result] of openAIResults.entries()) {
              if (sampleCount >= 5) break;
              console.log(`   ${sampleCount + 1}. "${key}": gameId=${result.gameId || 'null'}, overallConfidence=${result.overallConfidence ? (result.overallConfidence * 100).toFixed(1) + '%' : 'null'}`);
              sampleCount++;
            }
          }

          let skippedNoResult = 0;
          let skippedNoGameId = 0;
          let skippedNoConfidence = 0;
          let skippedLowConfidence = 0;
          let skippedGameNotFound = 0;
          
          // Initialize debug counters
          openAIDebugInfo.skippedNoResult = 0;
          openAIDebugInfo.skippedNoGameId = 0;
          openAIDebugInfo.skippedNoConfidence = 0;
          openAIDebugInfo.skippedLowConfidence = 0;
          openAIDebugInfo.skippedGameNotFound = 0;

          // Check for specific games we're debugging (PSG, Union SG, Pafos)
          const debugGames = ['PSG', 'Paris Saint', 'Newcastle', 'Union Saint', 'Atalanta', 'Pafos', 'Slavia'];
          const debugMatches = matchesToProcess.filter(fm => 
            debugGames.some(debug => 
              fm.externalMatch.homeTeam.name.includes(debug) || 
              fm.externalMatch.awayTeam.name.includes(debug)
            )
          );
          if (debugMatches.length > 0) {
            console.log(`\n🔍 DEBUG: Found ${debugMatches.length} debug games in prioritized matches:`);
            debugMatches.forEach(fm => {
              console.log(`   - ${fm.externalMatch.homeTeam.name} vs ${fm.externalMatch.awayTeam.name}`);
            });
          }

          for (const failedMatch of matchesToProcess) {
            const resultKey = `${failedMatch.externalMatch.homeTeam.name}|${failedMatch.externalMatch.awayTeam.name}`;
            const aiResult = openAIResults.get(resultKey);
            
            // Log debug games specifically
            const isDebugGame = debugGames.some(debug => 
              failedMatch.externalMatch.homeTeam.name.includes(debug) || 
              failedMatch.externalMatch.awayTeam.name.includes(debug)
            );
            
            if (!aiResult) {
              skippedNoResult++;
              openAIDebugInfo.skippedNoResult++;
              if (isDebugGame) {
                console.log(`   🔍 DEBUG: No OpenAI result for "${resultKey}"`);
              }
              continue;
            }
            if (!aiResult.gameId) {
              skippedNoGameId++;
              openAIDebugInfo.skippedNoGameId++;
              if (isDebugGame) {
                console.log(`   🔍 DEBUG: OpenAI result for "${resultKey}" has no gameId (overallConfidence: ${aiResult.overallConfidence}, homeMatch: ${aiResult.homeMatch ? 'yes' : 'no'}, awayMatch: ${aiResult.awayMatch ? 'yes' : 'no'})`);
              } else {
                console.log(`   ⚠️ OpenAI result for "${resultKey}" has no gameId`);
              }
              continue;
            }

            // Derive an effective confidence:
            // - Prefer overallConfidence if present
            // - Otherwise average home/away confidences when available
            const homeConf = (aiResult as any).homeMatch?.confidence ?? null;
            const awayConf = (aiResult as any).awayMatch?.confidence ?? null;
            let effectiveConfidence: number | null = aiResult.overallConfidence ?? null;
            if (effectiveConfidence === null && homeConf !== null && awayConf !== null) {
              effectiveConfidence = (homeConf + awayConf) / 2;
            }

            // If we still don't have a numeric confidence, skip
            if (effectiveConfidence === null) {
              skippedNoConfidence++;
              openAIDebugInfo.skippedNoConfidence++;
              if (isDebugGame) {
                console.log(`   🔍 DEBUG: OpenAI result for "${resultKey}" has no confidence score (homeConf: ${homeConf}, awayConf: ${awayConf}, overallConf: ${aiResult.overallConfidence})`);
              } else {
                console.log(`   ⚠️ OpenAI result for "${resultKey}" has no confidence score (homeConf: ${homeConf}, awayConf: ${awayConf}, overallConf: ${aiResult.overallConfidence})`);
              }
              continue;
            }

            // Trust OpenAI when confidence is reasonably high.
            // For testing, relax threshold to 0.6 so we can see if PSG / Union SG / Pafos are being matched.
            // We can tighten this again once we've verified behaviour.
            const MIN_OPENAI_CONFIDENCE = 0.6;
            if (effectiveConfidence < MIN_OPENAI_CONFIDENCE) {
              skippedLowConfidence++;
              openAIDebugInfo.skippedLowConfidence++;
              if (isDebugGame) {
                console.log(`   🔍 DEBUG: OpenAI result for "${resultKey}" has low confidence: ${(effectiveConfidence * 100).toFixed(1)}% (threshold: ${(MIN_OPENAI_CONFIDENCE * 100).toFixed(1)}%, gameId: ${aiResult.gameId})`);
              } else {
                console.log(`   ⚠️ OpenAI result for "${resultKey}" has low confidence: ${(effectiveConfidence * 100).toFixed(1)}% (threshold: ${(MIN_OPENAI_CONFIDENCE * 100).toFixed(1)}%)`);
              }
              continue;
            }

            // Find the matching DB game identified by OpenAI
            const aiMatchingGame = uniqueGamesToCheck.find(
              game => game.id === aiResult.gameId && game.competition.sportType === 'FOOTBALL'
            );

            if (!aiMatchingGame) {
              skippedGameNotFound++;
              openAIDebugInfo.skippedGameNotFound++;
              if (isDebugGame) {
                console.log(`   🔍 DEBUG: OpenAI matched "${resultKey}" to gameId ${aiResult.gameId}, but game not found in uniqueGamesToCheck`);
                console.log(`      Available game IDs: ${uniqueGamesToCheck.slice(0, 10).map(g => g.id).join(', ')}${uniqueGamesToCheck.length > 10 ? '...' : ''}`);
              } else {
                console.log(`   ⚠️ OpenAI matched "${resultKey}" to gameId ${aiResult.gameId}, but game not found in uniqueGamesToCheck (${uniqueGamesToCheck.length} games)`);
              }
              continue;
            }
            
            if (isDebugGame) {
              console.log(`   ✅ DEBUG: Successfully processing OpenAI match for "${resultKey}" -> gameId ${aiResult.gameId}, confidence ${(effectiveConfidence * 100).toFixed(1)}%`);
            }

            console.log(`🤖 FOOTBALL V2: OpenAI matched "${failedMatch.externalMatch.homeTeam.name} vs ${failedMatch.externalMatch.awayTeam.name}"`);
            console.log(`   → Game ID: ${aiResult.gameId}, overallConfidence: ${(aiResult.overallConfidence * 100).toFixed(1)}%`);

            // Attach externalId if missing or different, so next sync can use ID-based matching.
            // CRITICAL SAFETY: Don't overwrite an existing externalId unless confidence is very high (0.95+)
            // This prevents incorrect matches from overwriting correct externalIds
            const externalIdStr = failedMatch.externalMatch.id ? failedMatch.externalMatch.id.toString() : null;
            const hasExistingExternalId = aiMatchingGame.externalId !== null && aiMatchingGame.externalId !== undefined;
            const isHighConfidence = effectiveConfidence >= 0.95;
            
            // CRITICAL: Never overwrite externalId if game is LIVE and has been syncing successfully
            // This prevents overwriting correct externalIds during temporary API inconsistencies
            const isLiveAndSyncing = aiMatchingGame.status === 'LIVE' && 
                                     aiMatchingGame.lastSyncAt && 
                                     (Date.now() - aiMatchingGame.lastSyncAt.getTime()) < 10 * 60 * 1000; // Synced within last 10 minutes
            
            if (externalIdStr && aiMatchingGame.externalId !== externalIdStr) {
              // Never overwrite externalId if game is LIVE and syncing successfully
              if (isLiveAndSyncing) {
                console.log(`   ⚠️ SKIPPING externalId overwrite: Game is LIVE and has been syncing successfully (lastSync: ${aiMatchingGame.lastSyncAt?.toISOString()}, existing externalId: ${aiMatchingGame.externalId}) - might be temporary API inconsistency`);
                // Still count as matched, but don't update externalId
                openAIMatchedCount++;
                continue;
              }
              
              // Only overwrite existing externalId if confidence is very high (0.95+)
              // For games without externalId, use the lower threshold (0.6)
              if (hasExistingExternalId && !isHighConfidence) {
                console.log(`   ⚠️ Skipping externalId update for game ${aiMatchingGame.id}: existing externalId=${aiMatchingGame.externalId}, new=${externalIdStr}, confidence=${(effectiveConfidence * 100).toFixed(1)}% (requires 95%+ to overwrite)`);
                // Still count as matched, but don't update externalId
                openAIMatchedCount++;
                continue;
              }
              
              try {
                await prisma.game.update({
                  where: { id: aiMatchingGame.id },
                  data: {
                    externalId: externalIdStr,
                    externalStatus: failedMatch.externalMatch.externalStatus || aiMatchingGame.externalStatus || null,
                  },
                });
                openAIExternalIdSetCount++;
                if (hasExistingExternalId) {
                  console.log(`   ⚠️ OVERWROTE externalId: ${aiMatchingGame.externalId} -> ${externalIdStr} on game ${aiMatchingGame.id} (confidence: ${(effectiveConfidence * 100).toFixed(1)}%)`);
                } else {
                  console.log(`   ✅ Set externalId=${externalIdStr} on game ${aiMatchingGame.id}`);
                }
              } catch (err) {
                console.error(`   ❌ Error setting externalId via OpenAI fallback:`, err);
              }
            }

            openAIMatchedCount++;
          }

          // Log summary of why matches were skipped
          console.log(`\n🤖 FOOTBALL V2: OpenAI fallback summary:`);
          console.log(`   ✅ Matched: ${openAIMatchedCount}`);
          console.log(`   ⚠️ Skipped - No result: ${skippedNoResult}`);
          console.log(`   ⚠️ Skipped - No gameId: ${skippedNoGameId}`);
          console.log(`   ⚠️ Skipped - No confidence: ${skippedNoConfidence}`);
          console.log(`   ⚠️ Skipped - Low confidence (< 60%): ${skippedLowConfidence}`);
          console.log(`   ⚠️ Skipped - Game not found: ${skippedGameNotFound}`);
        } catch (openAIError) {
          console.error('❌ FOOTBALL V2: Error during OpenAI fallback:', openAIError);
        }
      } else {
        console.log('🤖 FOOTBALL V2: OpenAI API key not present, skipping AI fallback.');
      }
    }

    // Final summary log
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 LIVE SYNC SUMMARY (V2)`);
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ Matched & Updated: ${matchedCount} games`);
    console.log(`❌ Rejected (safety): ${rejectedCount} matches`);
    console.log(`⚠️  Unmatched: ${unmatchedMatches.length} external matches`);
    console.log(`📈 External API provided: ${allExternalMatches.length} matches`);
    console.log(`🎮 Our LIVE games: ${ourLiveGames.length} games`);
    console.log(`🔄 Games updated: ${updatedGames.length} games`);
    
    if (rejectedMatches.length > 0) {
      console.log(`\n❌ REJECTED MATCHES (for safety):`);
      rejectedMatches.forEach((rej, idx) => {
        console.log(`   ${idx + 1}. ${rej.externalMatch.home} vs ${rej.externalMatch.away}`);
        console.log(`      Reason: ${rej.reason}`);
        console.log(`      Details: ${rej.details || 'N/A'}`);
      });
    }
    
    if (unmatchedMatches.length > 0) {
      console.log(`\n⚠️  UNMATCHED EXTERNAL MATCHES:`);
      unmatchedMatches.slice(0, 10).forEach((unm, idx) => {
        console.log(`   ${idx + 1}. ${unm.externalMatch.home} vs ${unm.externalMatch.away} (ID: ${unm.externalMatch.id})`);
        console.log(`      Competition: ${unm.externalMatch.competition || 'N/A'}`);
        console.log(`      Reason: ${unm.reason}`);
      });
      if (unmatchedMatches.length > 10) {
        console.log(`   ... and ${unmatchedMatches.length - 10} more unmatched matches`);
      }
    }
    console.log(`${'='.repeat(80)}\n`);

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
      rejectedMatches: rejectedCount,
      unmatchedMatches: unmatchedMatches.length,
      rejectedDetails: rejectedMatches.slice(0, 20), // Limit to first 20 for response size
      unmatchedDetails: unmatchedMatches.slice(0, 20), // Limit to first 20 for response size
      attribution: apiSports.getAttributionText(),
      apiVersion: 'V2',
      lastSync: new Date().toISOString(),
      hasUpdates: updatedGames.length > 0,
      debug: {
        failedMatchesCount: failedMatches.length,
        openAIAttempted: failedMatches.length > 0,
        openAIKeyPresent: !!process.env.OPENAI_API_KEY,
        openAIMatchedCount,
        openAIExternalIdSetCount,
        openAIDebugInfo
      }
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

