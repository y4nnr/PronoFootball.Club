const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to normalize team names for better matching
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(fc|cf|ac|sc|united|city|town|rovers|wanderers|athletic|sporting)\b/g, '') // Remove common suffixes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

async function debugLiveSync() {
  try {
    console.log('🔍 Debugging live sync step by step...');
    
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

    // Get mock external matches
    const mockMatches = [
      {
        id: 12345,
        utcDate: new Date().toISOString(),
        status: 'IN_PLAY',
        score: {
          fullTime: { home: 2, away: 1 },
          halfTime: { home: 1, away: 0 }
        },
        homeTeam: { name: 'Real Madrid' },
        awayTeam: { name: 'Barcelona' },
        competition: { name: 'Champions League' }
      },
      {
        id: 12346,
        utcDate: new Date().toISOString(),
        status: 'IN_PLAY',
        score: {
          fullTime: { home: 0, away: 2 },
          halfTime: { home: 0, away: 1 }
        },
        homeTeam: { name: 'Manchester City' },
        awayTeam: { name: 'Bayern Munich' },
        competition: { name: 'Champions League' }
      },
      {
        id: 12347,
        utcDate: new Date().toISOString(),
        status: 'FINISHED',
        score: {
          fullTime: { home: 3, away: 1 },
          halfTime: { home: 2, away: 0 }
        },
        homeTeam: { name: 'Paris Saint-Germain' },
        awayTeam: { name: 'Liverpool' },
        competition: { name: 'Champions League' }
      }
    ];

    console.log(`📊 Found ${mockMatches.length} mock external matches`);

    // Test matching for each game
    const updatedGames = [];
    
    for (const game of gamesToSync) {
      console.log(`\n🔍 Processing game: ${game.homeTeam.name} vs ${game.awayTeam.name} (${game.status})`);
      
      // Try to find match by team names and date
      const gameDate = new Date(game.date);
      const dateStr = gameDate.toISOString().split('T')[0];

      const externalMatch = mockMatches.find(match => {
        const matchDate = new Date(match.utcDate).toISOString().split('T')[0];
        console.log(`  📅 Comparing dates: ${dateStr} vs ${matchDate}`);
        
        if (matchDate !== dateStr) return false;

        // Normalize team names for better matching
        const normalizedHomeTeam = normalizeTeamName(game.homeTeam.name);
        const normalizedAwayTeam = normalizeTeamName(game.awayTeam.name);
        const normalizedExternalHome = normalizeTeamName(match.homeTeam.name);
        const normalizedExternalAway = normalizeTeamName(match.awayTeam.name);

        console.log(`  🏷️ Team names: ${normalizedHomeTeam} vs ${normalizedAwayTeam}`);
        console.log(`  🏷️ External: ${normalizedExternalHome} vs ${normalizedExternalAway}`);

        const directMatch = normalizedHomeTeam === normalizedExternalHome && normalizedAwayTeam === normalizedExternalAway;
        const swappedMatch = normalizedHomeTeam === normalizedExternalAway && normalizedAwayTeam === normalizedExternalHome;
        
        console.log(`  ✅ Direct match: ${directMatch}`);
        console.log(`  ✅ Swapped match: ${swappedMatch}`);

        return directMatch || swappedMatch;
      });

      if (externalMatch) {
        console.log(`  🎯 FOUND MATCH: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
        console.log(`  📊 Score: ${externalMatch.score.fullTime.home} - ${externalMatch.score.fullTime.away}`);
        console.log(`  🏁 Status: ${externalMatch.status}`);
        
        updatedGames.push({
          gameId: game.id,
          homeTeam: game.homeTeam.name,
          awayTeam: game.awayTeam.name,
          externalMatch: externalMatch
        });
      } else {
        console.log(`  ❌ NO MATCH FOUND`);
      }
    }

    console.log(`\n🎯 Summary: Found ${updatedGames.length} matches out of ${gamesToSync.length} games`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLiveSync();
