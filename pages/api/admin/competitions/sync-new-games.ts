import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";
import { ApiSportsV2 } from "../../../../lib/api-sports-api-v2";
import { RugbyAPI } from "../../../../lib/api-rugby-v1";
import { API_CONFIG } from "../../../../lib/api-config";

/**
 * Extract season year from competition name (e.g., "Champions League 2024-25" -> "2024")
 */
function extractSeasonFromName(name: string): string | null {
  // Try to match patterns like "2024-25", "2024-2025", "2024"
  const patterns = [
    /(\d{4})-(\d{2,4})/, // "2024-25" or "2024-2025"
    /(\d{4})$/, // "2024" at the end
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1]; // Return the start year
    }
  }

  return null;
}

/**
 * Get base competition name without season (e.g., "Champions League 2024-25" -> "Champions League")
 */
function getBaseCompetitionName(name: string): string {
  // Remove season suffix
  return name.replace(/\s+\d{4}(-\d{2,4})?$/, '').trim();
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
    const apiKey = API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: "API-FOOTBALL key not configured" });
    }

    // Get all active competitions (status: UPCOMING or ACTIVE)
    const activeCompetitions = await prisma.competition.findMany({
      where: {
        status: {
          in: ['UPCOMING', 'ACTIVE'],
        },
      },
      select: {
        id: true,
        name: true,
        sportType: true,
        games: {
          select: {
            externalId: true,
            date: true,
          },
        },
      },
    });

    console.log(`🔍 Found ${activeCompetitions.length} active competitions to check`);

    const results: any[] = [];

    for (const competition of activeCompetitions) {
      try {
        // Extract season from competition name
        const season = extractSeasonFromName(competition.name);
        if (!season) {
          console.log(`⚠️ Could not extract season from competition name: ${competition.name}`);
          results.push({
            competitionId: competition.id,
            competitionName: competition.name,
            status: 'skipped',
            reason: 'Could not extract season from name',
            newGames: 0,
          });
          continue;
        }

        // Use appropriate API based on sport type
        const isRugby = competition.sportType === 'RUGBY';
        const apiSports = isRugby ? new RugbyAPI(apiKey) : new ApiSportsV2(apiKey);
        
        // Get base name to find external competition
        const baseName = getBaseCompetitionName(competition.name);
        
        // Get all external competitions and find matching one
        const externalCompetitions = await apiSports.getCompetitions();
        const matchingCompetition = externalCompetitions.find(c => 
          c.name.toLowerCase() === baseName.toLowerCase()
        );

        if (!matchingCompetition) {
          console.log(`⚠️ Could not find external competition for: ${baseName}`);
          results.push({
            competitionId: competition.id,
            competitionName: competition.name,
            status: 'skipped',
            reason: 'External competition not found',
            newGames: 0,
          });
          continue;
        }

        // Get existing external IDs
        const existingExternalIds = new Set(
          competition.games
            .map(g => g.externalId)
            .filter((id): id is string => id !== null)
        );

        // Get all fixtures for this competition and season (future only)
        const fixtures = await apiSports.getFixturesByCompetition(
          matchingCompetition.id,
          season,
          true // only future games
        );

        // Filter out fixtures we already have
        const newFixtures = fixtures.filter(f => 
          !existingExternalIds.has(f.fixture.id.toString())
        );

        if (newFixtures.length === 0) {
          console.log(`✅ No new games for ${competition.name}`);
          results.push({
            competitionId: competition.id,
            competitionName: competition.name,
            status: 'no_new_games',
            newGames: 0,
          });
          continue;
        }

        console.log(`📥 Found ${newFixtures.length} new games for ${competition.name}`);

        // Get all teams for this competition
        const externalTeams = await apiSports.getTeamsByCompetition(
          matchingCompetition.id,
          season
        );

        // Create team map
        const teamMap = new Map<number, string>(); // externalId -> ourTeamId

        for (const externalTeam of externalTeams) {
          // Use findFirst since we're searching by name only
          // The unique constraint is name_sportType, so we need to also filter by sportType
          const team = await prisma.team.findFirst({
            where: { 
              name: externalTeam.name,
              sportType: competition.sportType,
            },
          });
          if (team) {
            teamMap.set(externalTeam.id, team.id);
          }
        }

        // Create new games
        let createdCount = 0;
        let skippedCount = 0;
        const skippedReasons: string[] = [];

        for (const fixture of newFixtures) {
          const homeTeamId = teamMap.get(fixture.teams.home.id);
          const awayTeamId = teamMap.get(fixture.teams.away.id);

          if (!homeTeamId || !awayTeamId) {
            skippedCount++;
            skippedReasons.push(
              `Team not found: ${fixture.teams.home.name} or ${fixture.teams.away.name}`
            );
            continue;
          }

          // Map status (both APIs have the same mapStatus method signature)
          const status = (apiSports as any).mapStatus(fixture.fixture.status.short);
          
          // Skip LIVE matches during sync
          if (status === 'LIVE') {
            skippedCount++;
            skippedReasons.push(`Skipping LIVE match: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
            continue;
          }

          try {
            await prisma.game.create({
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
            createdCount++;
          } catch (error) {
            console.error(`❌ Error creating game for fixture ${fixture.fixture.id}:`, error);
            skippedCount++;
          }
        }

        console.log(`✅ Created ${createdCount} new games for ${competition.name} (${skippedCount} skipped)`);

        results.push({
          competitionId: competition.id,
          competitionName: competition.name,
          status: 'success',
          newGames: createdCount,
          skipped: skippedCount,
          skippedReasons: skippedReasons.slice(0, 5), // Limit to first 5 reasons
        });

      } catch (error) {
        console.error(`❌ Error syncing competition ${competition.name}:`, error);
        results.push({
          competitionId: competition.id,
          competitionName: competition.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          newGames: 0,
        });
      }
    }

    const totalNewGames = results.reduce((sum, r) => sum + (r.newGames || 0), 0);
    const successCount = results.filter(r => r.status === 'success').length;

    res.status(200).json({
      success: true,
      message: `Synchronized ${activeCompetitions.length} competitions`,
      summary: {
        totalCompetitions: activeCompetitions.length,
        successful: successCount,
        totalNewGames,
      },
      results,
      attribution: apiSports.getAttributionText(),
    });

  } catch (error) {
    console.error('Error syncing new games:', error);
    res.status(500).json({ 
      error: 'Failed to sync new games',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

