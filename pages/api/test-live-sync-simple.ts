import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { FootballDataAPI } from '../../lib/football-data-api';

// Helper function to normalize team names for better matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(fc|cf|ac|sc|united|city|town|rovers|wanderers|athletic|sporting)\b/g, '') // Remove common suffixes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

// Helper function to map external status to internal status with details
function mapExternalStatus(externalStatus: string): {
  status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  detail?: string;
  decidedBy?: string;
} {
  switch (externalStatus) {
    case 'SCHEDULED':
    case 'TIMED':
      return { status: 'UPCOMING' };

    case 'IN_PLAY':
      return { status: 'LIVE' };

    case 'PAUSED':
      return { status: 'LIVE', detail: 'HT' };

    case 'AET':
      return { status: 'FINISHED', detail: 'AET', decidedBy: 'AET' };

    case 'PEN':
      return { status: 'FINISHED', detail: 'PEN', decidedBy: 'PEN' };

    case 'FINISHED':
      return { status: 'FINISHED', decidedBy: 'FT' };

    case 'POSTPONED':
      return { status: 'UPCOMING', detail: 'PPD' };

    case 'SUSPENDED':
      return { status: 'LIVE', detail: 'SUS' };

    case 'CANCELED':
    case 'CANCELLED':
      return { status: 'FINISHED', detail: 'CANC', decidedBy: 'FT' };

    default:
      return { status: 'UPCOMING' };
  }
}

// Helper function to check if game data has changed
function hasGameDataChanged(
  current: any,
  newData: {
    liveHomeScore: number | null;
    liveAwayScore: number | null;
    externalStatus: string;
    status: string;
    statusDetail?: string;
    decidedBy?: string;
  }
): boolean {
  return (
    current.liveHomeScore !== newData.liveHomeScore ||
    current.liveAwayScore !== newData.liveAwayScore ||
    current.externalStatus !== newData.externalStatus ||
    current.status !== newData.status ||
    (current.statusDetail || '') !== (newData.statusDetail || '') ||
    (current.decidedBy || '') !== (newData.decidedBy || '')
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 Testing live sync logic (simple test)...');

    // Initialize Football-Data.org API
    const footballAPI = new FootballDataAPI();

    // Test API connection first
    const isConnected = await footballAPI.testConnection();
    if (!isConnected) {
      return res.status(500).json({
        error: 'Failed to connect to Football-Data.org API',
        details: 'Please check your API key and try again'
      });
    }

    // Get LIVE games and UPCOMING games from today only
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const gamesToSync = await prisma.game.findMany({
      where: {
        OR: [
          { status: 'LIVE' },
          {
            status: 'UPCOMING',
            date: {
              gte: startOfDay,
              lt: endOfDay
            }
          }
        ]
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`📊 Found ${gamesToSync.length} games to sync (LIVE + UPCOMING today)`);

    if (gamesToSync.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No games to sync',
        updatedGames: [],
        gamesFound: 0
      });
    }

    // Get all relevant matches from Football-Data.org in one call
    const allMatches = await footballAPI.getAllRelevantMatches();
    console.log(`📊 Found ${allMatches.length} total matches from external API`);

    const updatedGames: any[] = [];
    const errors: any[] = [];

    // Sync each game
    for (const game of gamesToSync) {
      try {
        // If we have an external ID, use it to find the match
        let externalMatch: any = null;

        if (game.externalId) {
          externalMatch = allMatches.find(match => match.id.toString() === game.externalId);
        } else {
          // Try to find match by team names and date
          const gameDate = new Date(game.date);
          const dateStr = gameDate.toISOString().split('T')[0];

          externalMatch = allMatches.find(match => {
            const matchDate = new Date(match.utcDate).toISOString().split('T')[0];
            if (matchDate !== dateStr) return false;

            // Normalize team names for better matching
            const normalizedHomeTeam = normalizeTeamName(game.homeTeam.name);
            const normalizedAwayTeam = normalizeTeamName(game.awayTeam.name);
            const normalizedExternalHome = normalizeTeamName(match.homeTeam.name);
            const normalizedExternalAway = normalizeTeamName(match.awayTeam.name);

            return (
              (normalizedHomeTeam === normalizedExternalHome && normalizedAwayTeam === normalizedExternalAway) ||
              (normalizedHomeTeam === normalizedExternalAway && normalizedAwayTeam === normalizedExternalHome) // Handle swapped teams
            );
          });
        }

        if (!externalMatch) {
          console.log(`⚠️ Skipped: No external match found for game ${game.id} (${game.homeTeam.name} vs ${game.awayTeam.name})`);
          continue;
        }

        // Map external status to internal status
        const statusMapping = mapExternalStatus(externalMatch.status);

        // Prepare new data
        const newLiveHomeScore = externalMatch.score.fullTime.home;
        const newLiveAwayScore = externalMatch.score.fullTime.away;
        const newExternalStatus = externalMatch.status;
        const newStatus = statusMapping.status;
        const newStatusDetail = statusMapping.detail;
        const newDecidedBy = statusMapping.decidedBy;

        // Check if data has changed
        const currentData = {
          liveHomeScore: game.liveHomeScore,
          liveAwayScore: game.liveAwayScore,
          externalStatus: game.externalStatus,
          status: game.status,
          statusDetail: game.statusDetail || '',
          decidedBy: game.decidedBy || ''
        };

        const newData = {
          liveHomeScore: newLiveHomeScore,
          liveAwayScore: newLiveAwayScore,
          externalStatus: newExternalStatus,
          status: newStatus,
          statusDetail: newStatusDetail || '',
          decidedBy: newDecidedBy || ''
        };

        if (!hasGameDataChanged(currentData, newData)) {
          continue; // Skip if no changes
        }

        // Prepare update data
        const updateData: any = {
          externalId: externalMatch.id.toString(), // Persist external ID if matched by name
          liveHomeScore: newLiveHomeScore,
          liveAwayScore: newLiveAwayScore,
          externalStatus: newExternalStatus,
          status: newStatus,
          lastSyncAt: new Date()
        };

        // Add optional fields if they exist in the schema
        if (newStatusDetail) {
          updateData.statusDetail = newStatusDetail;
        }
        if (newDecidedBy) {
          updateData.decidedBy = newDecidedBy;
        }

        // Update final scores if game is finished
        if (newStatus === 'FINISHED') {
          updateData.homeScore = newLiveHomeScore;
          updateData.awayScore = newLiveAwayScore;
          updateData.finishedAt = new Date();
        }

        // Update game in database
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
          liveHomeScore: updatedGame.liveHomeScore,
          liveAwayScore: updatedGame.liveAwayScore,
          status: updatedGame.status,
          externalStatus: updatedGame.externalStatus,
          statusDetail: updatedGame.statusDetail,
          decidedBy: updatedGame.decidedBy,
          finishedAt: updatedGame.finishedAt?.toISOString(),
          lastSyncAt: updatedGame.lastSyncAt.toISOString()
        });

        console.log(`✅ Updated: ${updatedGame.homeTeam.name} ${updatedGame.liveHomeScore}–${updatedGame.liveAwayScore} ${updatedGame.awayTeam.name} (${updatedGame.status})`);

      } catch (error) {
        console.error(`❌ Error syncing game ${game.id}:`, error);
        errors.push({
          gameId: game.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Live sync completed. Updated ${updatedGames.length} games`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${updatedGames.length} games`,
      updatedGames,
      errors: errors.length > 0 ? errors : undefined,
      gamesFound: gamesToSync.length,
      externalMatchesFound: allMatches.length
    });

  } catch (error) {
    console.error('❌ Live sync failed:', error);
    return res.status(500).json({
      error: 'Live sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
