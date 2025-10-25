import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

// Real live games from Football-Data.org API
const realLiveGames = [
  {
    id: 537863,
    utcDate: "2025-10-19T13:00:00Z",
    status: "IN_PLAY",
    score: {
      fullTime: { home: 1, away: 2 },
      halfTime: { home: 1, away: 1 }
    },
    homeTeam: { name: "Tottenham Hotspur FC" },
    awayTeam: { name: "Aston Villa FC" },
    competition: { name: "Premier League" }
  },
  {
    id: 536879,
    utcDate: "2025-10-19T13:00:00Z",
    status: "IN_PLAY",
    score: {
      fullTime: { home: 0, away: 0 },
      halfTime: { home: 0, away: 0 }
    },
    homeTeam: { name: "Genoa CFC" },
    awayTeam: { name: "Parma Calcio 1913" },
    competition: { name: "Serie A" }
  },
  {
    id: 542475,
    utcDate: "2025-10-19T13:00:00Z",
    status: "IN_PLAY",
    score: {
      fullTime: { home: 2, away: 1 },
      halfTime: { home: 1, away: 1 }
    },
    homeTeam: { name: "Racing Club de Lens" },
    awayTeam: { name: "Paris FC" },
    competition: { name: "Ligue 1" }
  },
  {
    id: 544296,
    utcDate: "2025-10-19T16:30:00Z",
    status: "IN_PLAY",
    score: {
      fullTime: { home: 0, away: 3 },
      halfTime: { home: 0, away: 2 }
    },
    homeTeam: { name: "Levante UD" },
    awayTeam: { name: "Rayo Vallecano de Madrid" },
    competition: { name: "Primera Division" }
  }
];

// Helper function to normalize team names for better matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(fc|cf|ac|sc|united|city|town|rovers|wanderers|athletic|sporting|hotspur|calcio|racing|club|de|ud)\b/g, '') // Remove common suffixes
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
    console.log('🧪 Testing live sync with REAL external data...');
    console.log('📊 Real live games from Football-Data.org:');
    realLiveGames.forEach((game, index) => {
      console.log(`${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} - ${game.score.fullTime.home}:${game.score.fullTime.away} (${game.status})`);
    });

    // Get our test games (the ones we created earlier)
    const testGames = await prisma.game.findMany({
      where: {
        OR: [
          { homeTeam: { name: 'Real Madrid' } },
          { homeTeam: { name: 'Manchester City' } },
          { homeTeam: { name: 'Paris Saint-Germain' } }
        ]
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`\n📊 Found ${testGames.length} test games in database:`);
    testGames.forEach((game, index) => {
      console.log(`${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} (${game.status})`);
    });

    const updatedGames: any[] = [];
    const errors: any[] = [];

    // Map real games to our test games (1:1 mapping)
    const mappings = [
      { realGame: realLiveGames[0], testGame: testGames[0] }, // Tottenham vs Villa → Real Madrid vs Barcelona
      { realGame: realLiveGames[1], testGame: testGames[1] }, // Genoa vs Parma → Manchester City vs Bayern Munich
      { realGame: realLiveGames[2], testGame: testGames[2] }  // RC Lens vs Paris FC → PSG vs Liverpool
    ];

    console.log('\n🔄 Testing live sync with real data...');

    for (const mapping of mappings) {
      if (!mapping.realGame || !mapping.testGame) continue;

      try {
        const realGame = mapping.realGame;
        const testGame = mapping.testGame;

        console.log(`\n🔍 Processing: ${testGame.homeTeam.name} vs ${testGame.awayTeam.name}`);
        console.log(`   Real data: ${realGame.homeTeam.name} vs ${realGame.awayTeam.name} - ${realGame.score.fullTime.home}:${realGame.score.fullTime.away}`);

        // Map external status to internal status
        const statusMapping = mapExternalStatus(realGame.status);

        // Prepare new data
        const newLiveHomeScore = realGame.score.fullTime.home;
        const newLiveAwayScore = realGame.score.fullTime.away;
        const newExternalStatus = realGame.status;
        const newStatus = statusMapping.status;
        const newStatusDetail = statusMapping.detail;
        const newDecidedBy = statusMapping.decidedBy;

        // Check if data has changed
        const currentData = {
          liveHomeScore: testGame.liveHomeScore,
          liveAwayScore: testGame.liveAwayScore,
          externalStatus: testGame.externalStatus,
          status: testGame.status,
          statusDetail: testGame.statusDetail || '',
          decidedBy: testGame.decidedBy || ''
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
          console.log(`   ⏭️ No changes needed`);
          continue;
        }

        // Prepare update data
        const updateData: any = {
          externalId: realGame.id.toString(),
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
          where: { id: testGame.id },
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
          lastSyncAt: updatedGame.lastSyncAt.toISOString(),
          realGame: `${realGame.homeTeam.name} vs ${realGame.awayTeam.name}`
        });

        console.log(`   ✅ Updated: ${updatedGame.homeTeam.name} ${updatedGame.liveHomeScore}–${updatedGame.liveAwayScore} ${updatedGame.awayTeam.name} (${updatedGame.status})`);
        console.log(`   📊 Real data: ${realGame.homeTeam.name} ${realGame.score.fullTime.home}–${realGame.score.fullTime.away} ${realGame.awayTeam.name}`);

      } catch (error) {
        console.error(`   ❌ Error syncing game:`, error);
        errors.push({
          gameId: mapping.testGame?.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`\n✅ Real live sync completed. Updated ${updatedGames.length} games`);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${updatedGames.length} games with REAL external data`,
      updatedGames,
      errors: errors.length > 0 ? errors : undefined,
      realGamesCount: realLiveGames.length,
      testGamesCount: testGames.length
    });

  } catch (error) {
    console.error('❌ Real live sync failed:', error);
    return res.status(500).json({
      error: 'Real live sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
