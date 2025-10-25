const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCurrentGames() {
  try {
    console.log('🔍 Checking current games in database...');
    
    // Get all games
    const games = await prisma.game.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    console.log(`📊 Found ${games.length} total games:`);
    games.forEach((game, index) => {
      console.log(`${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Status: ${game.status}`);
      console.log(`   Date: ${game.date.toISOString().split('T')[0]}`);
      console.log(`   Scores: ${game.homeScore || 'N/A'} - ${game.awayScore || 'N/A'}`);
      console.log(`   Live Scores: ${game.liveHomeScore || 'N/A'} - ${game.liveAwayScore || 'N/A'}`);
      console.log(`   External ID: ${game.externalId || 'None'}`);
      console.log('');
    });

    // Clean up test games
    console.log('🧹 Cleaning up test games...');
    const testGames = await prisma.game.findMany({
      where: {
        OR: [
          { homeTeam: { name: 'France' } },
          { homeTeam: { name: 'Albania' } },
          { awayTeam: { name: 'Romania' } },
          { awayTeam: { name: 'Switzerland' } }
        ]
      }
    });

    if (testGames.length > 0) {
      await prisma.game.deleteMany({
        where: {
          id: { in: testGames.map(g => g.id) }
        }
      });
      console.log(`✅ Deleted ${testGames.length} test games`);
    } else {
      console.log('✅ No test games to clean up');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentGames();
