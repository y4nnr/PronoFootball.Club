import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";
import { ApiSportsV2 } from "../../../../lib/api-sports-api-v2";
import { RugbyAPI } from "../../../../lib/api-rugby-v1";
import { API_CONFIG } from "../../../../lib/api-config";

/**
 * Generate competition name with season suffix
 * If competition already exists, increment with season (e.g., "Champions League 2024-25")
 */
async function generateCompetitionName(baseName: string, season: any): Promise<string> {
  // Convert season to string first
  const seasonStr = String(season || '');
  
  // Try to find existing competitions with similar names
  const existingCompetitions = await prisma.competition.findMany({
    where: {
      name: {
        startsWith: baseName,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Format season suffix (e.g., "2024" -> "2024-25", "2024-2025" -> "2024-25")
  let seasonSuffix = seasonStr;
  if (seasonStr.length === 4) {
    // Single year, assume it's the start year
    const startYear = parseInt(seasonStr);
    if (!isNaN(startYear)) {
      const endYear = startYear + 1;
      seasonSuffix = `${startYear}-${endYear.toString().slice(-2)}`;
    }
  } else if (seasonStr.includes('-')) {
    // Already formatted, extract years
    const parts = seasonStr.split('-');
    if (parts.length === 2) {
      const startYear = parts[0];
      const endYear = parts[1].length === 4 ? parts[1].slice(-2) : parts[1];
      seasonSuffix = `${startYear}-${endYear}`;
    }
  }

  const newName = `${baseName} ${seasonSuffix}`;

  // Check if this exact name already exists
  const nameExists = existingCompetitions.some(c => c.name === newName);
  if (nameExists) {
    // If it exists, we still use it (user might be re-importing)
    console.log(`⚠️ Competition name "${newName}" already exists, using it anyway`);
  }

  return newName;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated and is an admin
  if (!session || typeof session.user !== 'object' || session.user === null || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Only allow V2 API
  if (!API_CONFIG.useV2) {
    return res.status(400).json({ error: "This endpoint is only available with API V2 enabled" });
  }

  try {
    const { externalCompetitionId, season, importOnlyFutureGames = true, sportType = 'FOOTBALL' } = req.body;

    if (!externalCompetitionId || !season) {
      return res.status(400).json({ error: "Missing required fields: externalCompetitionId, season" });
    }

    // Use appropriate API key based on sport type
    const isRugby = sportType === 'RUGBY';
    const apiKey = isRugby ? (API_CONFIG.rugbyApiKey || API_CONFIG.apiSportsApiKey) : API_CONFIG.apiSportsApiKey;
    
    console.log(`[IMPORT] API Key check:`, {
      isRugby,
      rugbyApiKey: API_CONFIG.rugbyApiKey ? `SET (${API_CONFIG.rugbyApiKey.substring(0, 10)}...)` : 'NOT SET',
      apiSportsApiKey: API_CONFIG.apiSportsApiKey ? `SET (${API_CONFIG.apiSportsApiKey.substring(0, 10)}...)` : 'NOT SET',
      finalApiKey: apiKey ? `SET (${apiKey.substring(0, 10)}...)` : 'NOT SET',
      apiKeyLength: apiKey ? apiKey.length : 0,
      envVars: {
        'API-RUGBY': process.env['API-RUGBY'] ? 'SET' : 'NOT SET',
        'API-FOOTBALL': process.env['API-FOOTBALL'] ? 'SET' : 'NOT SET'
      }
    });
    
    if (!apiKey) {
      console.error(`[IMPORT] ❌ No API key available!`);
      return res.status(500).json({ 
        error: isRugby 
          ? "API-RUGBY or API-FOOTBALL key not configured for Rugby competitions" 
          : "API-FOOTBALL key not configured for Football competitions" 
      });
    }

    // Use appropriate API based on sport type
    const apiSports = isRugby ? new RugbyAPI(apiKey) : new ApiSportsV2(apiKey);
    console.log(`[IMPORT] ✅ Created ${isRugby ? 'RugbyAPI' : 'ApiSportsV2'} instance with API key`);
    
    console.log(`[IMPORT] Importing ${sportType} competition ${externalCompetitionId}, season ${season}`);

    // Normalize season comparison (handle both "2024" and "2024-2025" formats)
    const normalizeSeason = (s: any): string => {
      // Convert to string first
      const seasonStr = String(s || '');
      if (seasonStr.includes('-')) {
        return seasonStr.split('-')[0]; // Extract start year
      }
      return seasonStr.replace(/\D/g, ''); // Keep only digits
    };
    
    // Get competition details
    // For Rugby, season is determined dynamically from games, not from league metadata
    let selectedSeason = await apiSports.getCurrentOrNextSeason(externalCompetitionId);
    
    let seasonForApi: string;
    
    if (!selectedSeason) {
      if (isRugby) {
        // For Rugby, if no season found from games, use the requested season
        console.warn(`⚠️ No season found from games for Rugby competition ${externalCompetitionId}, using requested season`);
        seasonForApi = normalizeSeason(season);
        console.log(`[IMPORT] Rugby: Using requested season ${seasonForApi} (no season found from games)`);
      } else {
        return res.status(400).json({ 
          error: `No season found for competition ID ${externalCompetitionId}`,
          details: 'Please check if the competition has an ongoing or upcoming season'
        });
      }
    } else {
      const normalizedSelectedSeason = normalizeSeason(selectedSeason.year);
      const normalizedRequestedSeason = normalizeSeason(season);
      
      console.log(`[IMPORT] Season normalization:`, {
        selectedSeasonYear: selectedSeason.year,
        selectedSeasonCurrent: selectedSeason.current,
        selectedSeasonStart: selectedSeason.start,
        selectedSeasonEnd: selectedSeason.end,
        requestedSeason: season,
        normalizedSelected: normalizedSelectedSeason,
        normalizedRequested: normalizedRequestedSeason
      });
      
      // For Rugby, ALWAYS use the detected season if it's marked as current
      // The detected season is based on actual game data, so it's more reliable
      if (isRugby) {
        if (selectedSeason.current) {
          // Always use detected current season - it's based on actual game data
          seasonForApi = normalizedSelectedSeason;
          console.log(`[IMPORT] ✅ Using detected CURRENT season: ${seasonForApi} (more reliable than requested: ${normalizedRequestedSeason})`);
        } else {
          // Detected season is not current, but still use it if it has games
          // Only use requested season if it's explicitly for historical data (in the past)
          const requestedYear = parseInt(normalizedRequestedSeason);
          const selectedYear = parseInt(normalizedSelectedSeason);
          
          if (requestedYear < selectedYear) {
            // Requested season is in the past - user wants historical data
            console.log(`[IMPORT] ⚠️ Requested season ${requestedYear} is in the past (detected: ${selectedYear}). Using requested season for historical import.`);
            seasonForApi = normalizedRequestedSeason;
          } else {
            // Use detected season (even if not current, it has games)
            seasonForApi = normalizedSelectedSeason;
            console.log(`[IMPORT] Using detected season: ${seasonForApi} (has games, more reliable)`);
          }
        }
      } else if (!isRugby && normalizedSelectedSeason !== normalizedRequestedSeason) {
        // For Football, strict matching
        return res.status(400).json({ 
          error: `Season mismatch`,
          details: `Requested season: ${season}, Available season: ${selectedSeason.year}. Please select the correct season.`
        });
      } else {
        // Seasons match
        seasonForApi = normalizedSelectedSeason;
      }
    }
    
    console.log(`[IMPORT] Using season for API calls: ${seasonForApi}`);

    // Get competition info (name, etc.)
    // Try to get competition info from the list, but if not found, we can still proceed with the ID
    let competitionInfo: any = null;
    try {
      const competitions = await apiSports.getCompetitions();
      competitionInfo = competitions.find(c => c.id === externalCompetitionId);
    } catch (error) {
      console.log('⚠️ Could not fetch competition list, proceeding with ID only');
    }
    
    // If competition info not found, we'll use a default name
    const competitionName = competitionInfo 
      ? competitionInfo.name 
      : `Competition ${externalCompetitionId}`;

    // Generate competition name with season
    const finalCompetitionName = await generateCompetitionName(competitionName, season);

    // Get teams - for Rugby, try multiple seasons if the first one fails
    console.log(`📥 Fetching teams for competition ${externalCompetitionId}, season ${seasonForApi} (original: ${season}, sportType: ${sportType}, isRugby: ${isRugby})...`);
    let externalTeams: any[] = [];
    let teamsSeasonUsed = seasonForApi;
    let teamsFound = false;
    
    // For Rugby, build list of seasons to try (detected season first, then previous seasons)
    const seasonsToTry: string[] = [];
    if (isRugby) {
      const detectedYear = parseInt(seasonForApi);
      seasonsToTry.push(seasonForApi); // Try detected season first
      // Add previous seasons (up to 3 years back)
      for (let i = 1; i <= 3; i++) {
        const year = detectedYear - i;
        if (year >= 2020) {
          seasonsToTry.push(String(year));
        }
      }
      console.log(`📥 Will try ${seasonsToTry.length} seasons for teams: ${seasonsToTry.join(', ')}`);
    } else {
      seasonsToTry.push(seasonForApi);
    }
    
    // Try each season until we find teams
    for (const trySeason of seasonsToTry) {
      try {
        console.log(`📥 Trying season ${trySeason} for teams...`);
        externalTeams = await apiSports.getTeamsByCompetition(externalCompetitionId, trySeason);
        console.log(`📥 ✅ getTeamsByCompetition returned ${externalTeams.length} teams for season ${trySeason}`);
        if (externalTeams.length > 0) {
          teamsSeasonUsed = trySeason;
          seasonForApi = trySeason; // Update seasonForApi for subsequent calls
          teamsFound = true;
          console.log(`📥 ✅ Found ${externalTeams.length} teams in season ${trySeason}, using this season`);
          console.log(`📥 Sample teams:`, externalTeams.slice(0, 3).map(t => ({ id: t.id, name: t.name, hasLogo: !!t.logo, logo: t.logo })));
          const teamsWithLogos = externalTeams.filter(t => t.logo).length;
          console.log(`📥 📸 Teams with logos: ${teamsWithLogos}/${externalTeams.length}`);
          break;
        } else {
          console.warn(`📥 Season ${trySeason} returned 0 teams, trying next season...`);
        }
      } catch (teamsError) {
        console.warn(`📥 Season ${trySeason} failed:`, teamsError instanceof Error ? teamsError.message : String(teamsError));
        // Continue to next season
        continue;
      }
    }
    
    if (!teamsFound) {
      console.error(`❌ No teams found in any of the tried seasons: ${seasonsToTry.join(', ')}`);
      // Will try to extract from fixtures below
    }
    
    // If no teams found (especially for Rugby), try to extract from fixtures
    // IMPORTANT: For team extraction, we need ALL fixtures, not just future ones
    if (externalTeams.length === 0 && isRugby) {
      console.log(`⚠️ No teams found via API, attempting to extract from fixtures...`);
      console.log(`📥 Will try to fetch fixtures from multiple seasons to extract teams...`);
      
      // Try to get fixtures from multiple seasons
      let allFixtures: any[] = [];
      let fixturesFound = false;
      
      for (const trySeason of seasonsToTry) {
        try {
          console.log(`📥 Trying to fetch ALL fixtures from season ${trySeason} for team extraction...`);
          const fixtures = await apiSports.getFixturesByCompetition(
            externalCompetitionId,
            trySeason,
            false // Get all fixtures, not just future ones
          );
          
          if (fixtures.length > 0) {
            allFixtures = fixtures;
            seasonForApi = trySeason; // Update seasonForApi
            fixturesFound = true;
            console.log(`📥 ✅ Found ${fixtures.length} fixtures in season ${trySeason}`);
            break;
          } else {
            console.warn(`📥 Season ${trySeason} has no fixtures, trying next season...`);
          }
        } catch (fixtureError) {
          console.warn(`📥 Season ${trySeason} fixtures failed:`, fixtureError instanceof Error ? fixtureError.message : String(fixtureError));
          continue;
        }
      }
      
      if (fixturesFound && allFixtures.length > 0) {
        try {
          console.log(`📥 Found ${allFixtures.length} fixtures, extracting teams...`);
          console.log(`📥 Sample fixture structure:`, JSON.stringify(allFixtures[0], null, 2).substring(0, 500));
          
          const teamsMap = new Map<number, { id: number; name: string; logo?: string }>();
          
          for (const fixture of allFixtures) {
            // Extract home team
            if (fixture.teams?.home?.id && fixture.teams?.home?.name) {
              teamsMap.set(fixture.teams.home.id, {
                id: fixture.teams.home.id,
                name: fixture.teams.home.name,
                logo: fixture.teams.home.logo || undefined,
              });
            } else {
              console.warn(`⚠️ Fixture ${fixture.fixture?.id} missing home team data:`, {
                hasTeams: !!fixture.teams,
                hasHome: !!fixture.teams?.home,
                homeId: fixture.teams?.home?.id,
                homeName: fixture.teams?.home?.name
              });
            }
            // Extract away team
            if (fixture.teams?.away?.id && fixture.teams?.away?.name) {
              teamsMap.set(fixture.teams.away.id, {
                id: fixture.teams.away.id,
                name: fixture.teams.away.name,
                logo: fixture.teams.away.logo || undefined,
              });
            } else {
              console.warn(`⚠️ Fixture ${fixture.fixture?.id} missing away team data:`, {
                hasTeams: !!fixture.teams,
                hasAway: !!fixture.teams?.away,
                awayId: fixture.teams?.away?.id,
                awayName: fixture.teams?.away?.name
              });
            }
          }
          
          externalTeams = Array.from(teamsMap.values()).map(team => ({
            id: team.id,
            name: team.name,
            code: undefined,
            logo: team.logo,
          }));
          
          console.log(`✅ Extracted ${externalTeams.length} teams from ${allFixtures.length} fixtures`);
        } catch (extractionError) {
          console.error(`❌ Error extracting teams from fixtures:`, extractionError);
          if (extractionError instanceof Error) {
            console.error(`❌ Error message: ${extractionError.message}`);
            console.error(`❌ Error stack: ${extractionError.stack}`);
          }
        }
      } else {
        console.warn(`⚠️ No fixtures found in any of the tried seasons: ${seasonsToTry.join(', ')}`);
        console.warn(`⚠️ This could mean:`);
        console.warn(`   - The competition has no games for any of these seasons`);
        console.warn(`   - The API endpoint is not working correctly`);
        console.warn(`   - The competition ID is incorrect`);
      }
    }

    // Now get fixtures for import (filtered by importOnlyFutureGames if needed)
    console.log(`📥 Fetching fixtures for competition ${externalCompetitionId}, season ${seasonForApi} (original: ${season}, future only: ${importOnlyFutureGames})...`);
    let externalFixtures: any[] = [];
    
    try {
      externalFixtures = await apiSports.getFixturesByCompetition(
        externalCompetitionId,
        seasonForApi,
        importOnlyFutureGames
      );
      console.log(`📥 ✅ getFixturesByCompetition returned ${externalFixtures.length} fixtures (future only: ${importOnlyFutureGames})`);
    } catch (fixturesError) {
      console.warn(`📥 ⚠️ Failed to fetch fixtures with future only=${importOnlyFutureGames}:`, fixturesError instanceof Error ? fixturesError.message : String(fixturesError));
      
      // If future-only failed and importOnlyFutureGames is true, try fetching all fixtures
      if (importOnlyFutureGames) {
        console.log(`📥 Trying to fetch ALL fixtures (not just future) as fallback...`);
        try {
          externalFixtures = await apiSports.getFixturesByCompetition(
            externalCompetitionId,
            seasonForApi,
            false // Get all fixtures
          );
          console.log(`📥 ✅ Fallback: Found ${externalFixtures.length} total fixtures (all dates)`);
        } catch (allFixturesError) {
          console.error(`📥 ❌ Failed to fetch all fixtures:`, allFixturesError instanceof Error ? allFixturesError.message : String(allFixturesError));
          throw allFixturesError;
        }
      } else {
        throw fixturesError;
      }
    }
    
    if (externalTeams.length === 0) {
      // Try one more time: fetch fixtures without date filter to see if any exist
      if (isRugby) {
        console.log(`⚠️ Still no teams found. Attempting to fetch fixtures without date filter...`);
        try {
          const testFixtures = await apiSports.getFixturesByCompetition(
            externalCompetitionId,
            seasonForApi,
            false // Get all fixtures
          );
          console.log(`📊 Found ${testFixtures.length} total fixtures (all dates)`);
          
          if (testFixtures.length === 0) {
            return res.status(400).json({ 
              error: "No teams found for this competition and season",
              details: "No fixtures found for this competition and season. The competition might not have any matches scheduled yet, or the season might be incorrect."
            });
          } else {
            return res.status(400).json({ 
              error: "No teams found for this competition and season",
              details: `Found ${testFixtures.length} fixtures but could not extract teams. Please check the fixture data structure or try a different season.`
            });
          }
        } catch (fixtureError) {
          console.error('Error fetching fixtures for team extraction:', fixtureError);
        }
      }
      
      return res.status(400).json({ 
        error: "No teams found for this competition and season",
        details: isRugby
          ? "Rugby API v1 might not support team endpoints and no fixtures were found to extract teams from. Please check if the competition has fixtures for this season."
          : "Please check if the competition has teams for this season."
      });
    }

    // Filter out LIVE matches during import
    let fixturesToImport = externalFixtures.filter(f => (apiSports as any).mapStatus(f.fixture.status.short) !== 'LIVE');

    // If no fixtures found and we're looking for future games only, try to get all fixtures and filter recent past ones
    if (fixturesToImport.length === 0 && importOnlyFutureGames) {
      console.log(`📥 ⚠️ No future fixtures found, trying to fetch all fixtures and include recent past ones...`);
      try {
        const allFixtures = await apiSports.getFixturesByCompetition(
          externalCompetitionId,
          seasonForApi,
          false // Get all fixtures
        );
        
        // Filter to include recent past games (within last 6 months) and future games
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const now = new Date();
        
        fixturesToImport = allFixtures.filter(f => {
          const gameDate = new Date(f.fixture?.date || f.date);
          const isRecentPast = gameDate >= sixMonthsAgo && gameDate < now;
          const isFuture = gameDate >= now;
          const isNotLive = (apiSports as any).mapStatus(f.fixture.status.short) !== 'LIVE';
          return (isRecentPast || isFuture) && isNotLive;
        });
        
        console.log(`📥 ✅ Found ${fixturesToImport.length} fixtures (recent past + future) after filtering`);
      } catch (allFixturesError) {
        console.warn(`📥 ⚠️ Failed to fetch all fixtures as fallback:`, allFixturesError instanceof Error ? allFixturesError.message : String(allFixturesError));
      }
    }
    
    // If still no fixtures, try previous seasons (for Rugby)
    if (fixturesToImport.length === 0 && isRugby) {
      console.log(`📥 ⚠️ No fixtures found in season ${seasonForApi}, trying previous seasons...`);
      const currentSeasonYear = parseInt(seasonForApi);
      const previousSeasons = [currentSeasonYear - 1, currentSeasonYear - 2];
      
      for (const trySeason of previousSeasons) {
        if (trySeason < 2020) break;
        
        try {
          console.log(`📥 Trying season ${trySeason} for fixtures...`);
          const previousFixtures = await apiSports.getFixturesByCompetition(
            externalCompetitionId,
            String(trySeason),
            false // Get all fixtures
          );
          
          if (previousFixtures.length > 0) {
            // Filter to only include recent past games (within last 6 months) and future games
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const now = new Date();
            
            fixturesToImport = previousFixtures.filter(f => {
              const gameDate = new Date(f.fixture?.date || f.date);
              const isRecentPast = gameDate >= sixMonthsAgo && gameDate < now;
              const isFuture = gameDate >= now;
              const isNotLive = (apiSports as any).mapStatus(f.fixture.status.short) !== 'LIVE';
              return (isRecentPast || isFuture) && isNotLive;
            });
            
            if (fixturesToImport.length > 0) {
              seasonForApi = String(trySeason); // Update season for API
              console.log(`📥 ✅ Found ${fixturesToImport.length} recent fixtures in season ${trySeason}`);
              break;
            }
          }
        } catch (error) {
          console.warn(`📥 Season ${trySeason} also has no fixtures:`, error instanceof Error ? error.message : String(error));
          continue;
        }
      }
    }

    if (fixturesToImport.length === 0) {
      // If we tried future-only and got nothing, suggest trying without the filter
      const suggestion = importOnlyFutureGames 
        ? " Try unchecking 'Importer uniquement les matchs futurs' to import past matches as well."
        : "";
      
      return res.status(400).json({ 
        error: `No fixtures found${importOnlyFutureGames ? ' (future games only)' : ''} for this competition and season`,
        details: `Live matches are ignored during import. Tried current season (${seasonForApi}) and previous seasons. Please ensure there are upcoming or finished matches.${suggestion}`
      });
    }

    // Start transaction: create competition, teams, and games
    const result = await prisma.$transaction(async (tx) => {
      // Determine start and end dates
      // For Rugby, selectedSeason might be null or have empty start/end
      let startDate: Date;
      let endDate: Date;
      
      if (selectedSeason && selectedSeason.start && selectedSeason.end) {
        startDate = new Date(selectedSeason.start);
        endDate = new Date(selectedSeason.end);
      } else {
        // Default dates: current year September to next year June (Rugby season)
        const currentYear = new Date().getFullYear();
        const seasonYear = parseInt(seasonForApi) || currentYear;
        startDate = new Date(seasonYear, 8, 1); // September 1st
        endDate = new Date(seasonYear + 1, 5, 30); // June 30th of next year
        console.log(`[IMPORT] Using default dates for competition: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      }
      
      // Create competition
      // For Rugby, store the season partition key in externalSeason field
      const competition = await tx.competition.create({
        data: {
          name: finalCompetitionName,
          description: `${competitionName} - Season ${season}`,
          startDate: startDate,
          endDate: endDate,
          status: 'UPCOMING',
          logo: competitionInfo?.logo || undefined,
          sportType: sportType as any, // FOOTBALL or RUGBY
          externalSeason: isRugby ? seasonForApi : undefined, // Cache season partition key for Rugby
        },
      });
      
      if (isRugby) {
        console.log(`[IMPORT] ✅ Cached Rugby season partition key: ${seasonForApi} for competition ${competition.id}`);
      }

      console.log(`✅ Created competition: ${competition.name}`);

      // Create or find teams
      const teamMap = new Map<number, string>(); // externalId -> ourTeamId
      const createdTeams: string[] = [];
      const foundTeams: string[] = [];

      // Determine if competition is international or local (for team category)
      // Default: if competition has a country, it's LOCAL (CLUB), otherwise check keywords
      let isInternationalCompetition = false;
      const competitionCountry = competitionInfo?.country || undefined;
      const compNameForCheck = competitionInfo?.name || competitionName || '';
      
      if (competitionInfo) {
        // Check if it's international based on country and name
        isInternationalCompetition = (
          !competitionCountry || 
          competitionCountry === '' || 
          competitionCountry === 'World' ||
          compNameForCheck.toLowerCase().includes('world cup') ||
          compNameForCheck.toLowerCase().includes('euro') ||
          compNameForCheck.toLowerCase().includes('champions league') ||
          compNameForCheck.toLowerCase().includes('europa league') ||
          compNameForCheck.toLowerCase().includes('copa america') ||
          compNameForCheck.toLowerCase().includes('africa cup') ||
          compNameForCheck.toLowerCase().includes('asia cup')
        );
      } else {
        // If no competitionInfo, default to CLUB (local) if we have a country from API
        // For Rugby API, we might not have competitionInfo, so we'll default to CLUB
        // Most local competitions (Ligue 1, Top 14, etc.) are CLUB
        isInternationalCompetition = false;
      }
      
      const teamCategory = isInternationalCompetition ? 'NATIONAL' : 'CLUB';
      
      console.log(`[IMPORT] Competition: ${compNameForCheck}, Country: ${competitionCountry || 'N/A'}, Type: ${isInternationalCompetition ? 'International' : 'Local'}, Team category: ${teamCategory}`);
      
      const teamsWithLogos = externalTeams.filter(t => t.logo).length;
      console.log(`📥 📸 Teams with logos from API: ${teamsWithLogos}/${externalTeams.length}`);

      for (const externalTeam of externalTeams) {
        // CRITICAL: Try to find existing team by name AND sportType to avoid conflicts
        // NEVER reuse a team from a different sport
        let team = await tx.team.findFirst({
          where: { 
            name: externalTeam.name,
            sportType: sportType as any,
          },
        });
        
        // If not found with sportType, check if there's a team with different sportType
        // If yes, we MUST create a new team to avoid conflicts
        if (!team) {
          // Use findFirst instead of findUnique since we're searching by name only
          // (findUnique requires the unique constraint which is name_sportType)
          const existingTeamDifferentSport = await tx.team.findFirst({
            where: { name: externalTeam.name },
          });
          
          if (existingTeamDifferentSport && existingTeamDifferentSport.sportType && existingTeamDifferentSport.sportType !== sportType) {
            // Team exists but with different sport - create a new one
            console.log(`⚠️ Team "${externalTeam.name}" exists with sport ${existingTeamDifferentSport.sportType}, creating new team for ${sportType}`);
            team = null; // Force creation of new team
          } else if (existingTeamDifferentSport && !existingTeamDifferentSport.sportType) {
            // Team exists but has no sportType - we can update it
            team = existingTeamDifferentSport;
            console.log(`ℹ️ Team "${externalTeam.name}" exists without sportType, will update to ${sportType}`);
          } else {
            // No team exists at all
            team = null;
          }
        }

        if (!team) {
          // Create new team with correct category and sportType
          team = await tx.team.create({
            data: {
              name: externalTeam.name,
              shortName: externalTeam.code || undefined,
              logo: externalTeam.logo || undefined,
              category: teamCategory as any,
              sportType: sportType as any,
              country: competitionCountry,
            },
          });
          createdTeams.push(team.name);
          console.log(`✅ Created team: ${team.name} (${teamCategory}, ${sportType}, ${competitionCountry || 'N/A'}, logo: ${externalTeam.logo ? '✅' : '❌'})`);
        } else {
          // Update existing team if needed (sportType, category, country, logo)
          // BUT: Never change sportType if it's already set and different
          const updateData: any = {};
          let needsUpdate = false;
          
          // Only update sportType if it's null or matches
          if (!team.sportType || team.sportType === sportType) {
            if (team.sportType !== sportType) {
              updateData.sportType = sportType as any;
              needsUpdate = true;
            }
          } else {
            // SportType is different - this shouldn't happen due to check above, but log it
            console.warn(`⚠️ Cannot update team ${team.name}: sportType mismatch (existing: ${team.sportType}, new: ${sportType})`);
          }
          
          if (team.category !== teamCategory) {
            updateData.category = teamCategory as any;
            needsUpdate = true;
          }
          
          if (competitionCountry && team.country !== competitionCountry) {
            updateData.country = competitionCountry;
            needsUpdate = true;
          }
          
          // Update logo if provided and different (or if team has no logo)
          if (externalTeam.logo) {
            if (team.logo !== externalTeam.logo) {
              updateData.logo = externalTeam.logo;
              needsUpdate = true;
              console.log(`📸 Logo update for ${team.name}: ${team.logo || 'none'} → ${externalTeam.logo}`);
            } else {
              console.log(`📸 Logo for ${team.name} already up to date: ${externalTeam.logo}`);
            }
          } else {
            console.log(`⚠️ No logo provided for ${team.name} in API response`);
          }
          
          if (needsUpdate) {
            team = await tx.team.update({
              where: { id: team.id },
              data: updateData,
            });
            console.log(`🔄 Updated team: ${team.name} (${updateData.sportType || team.sportType}, ${updateData.category || team.category}, ${updateData.country || team.country || 'N/A'}, logo: ${updateData.logo ? 'updated' : 'unchanged'})`);
          }
          
          foundTeams.push(team.name);
        }

        teamMap.set(externalTeam.id, team.id);
      }

      console.log(`📊 Teams: ${createdTeams.length} created, ${foundTeams.length} found`);

      // Create games
      const createdGames: any[] = [];
      const skippedGames: any[] = [];

      for (const fixture of fixturesToImport) {
        const homeTeamId = teamMap.get(fixture.teams.home.id);
        const awayTeamId = teamMap.get(fixture.teams.away.id);

        if (!homeTeamId || !awayTeamId) {
          console.log(`⚠️ Skipping fixture ${fixture.fixture.id}: team not found`);
          skippedGames.push({
            fixtureId: fixture.fixture.id,
            reason: 'Team not found',
            home: fixture.teams.home.name,
            away: fixture.teams.away.name,
          });
          continue;
        }

                // Map status (both APIs have the same mapStatus method signature)
                const status = (apiSports as any).mapStatus(fixture.fixture.status.short);

        // Create game
        const game = await tx.game.create({
          data: {
            competitionId: competition.id,
            homeTeamId,
            awayTeamId,
            date: new Date(fixture.fixture.date),
            status: status as any,
            externalId: fixture.fixture.id.toString(),
            externalStatus: fixture.fixture.status.short,
          },
        });

        createdGames.push({
          id: game.id,
          home: fixture.teams.home.name,
          away: fixture.teams.away.name,
          date: fixture.fixture.date,
        });
      }

      console.log(`📊 Games: ${createdGames.length} created, ${skippedGames.length} skipped`);

      return {
        competition,
        teams: {
          created: createdTeams.length,
          found: foundTeams.length,
          total: externalTeams.length,
        },
        games: {
          created: createdGames.length,
          skipped: skippedGames.length,
          total: fixturesToImport.length,
        },
        skippedGames,
      };
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported competition "${finalCompetitionName}"`,
      competition: result.competition,
      teams: result.teams,
      games: result.games,
      skippedGames: result.skippedGames,
      attribution: apiSports.getAttributionText(),
    });

  } catch (error) {
    console.error('Error importing competition:', error);
    res.status(500).json({ 
      error: 'Failed to import competition',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

