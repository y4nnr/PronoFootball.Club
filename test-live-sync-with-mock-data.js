const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLiveSyncWithMockData() {
  try {
    console.log('🧪 Testing live sync with mock external data...');
    
    // Get our test LIVE game
    const testGame = await prisma.game.findFirst({
      where: { status: 'LIVE' },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    if (!testGame) {
      console.log('❌ No LIVE game found');
      return;
    }

    console.log(`📊 Test game: ${testGame.homeTeam.name} vs ${testGame.awayTeam.name}`);
    console.log(`   Current status: ${testGame.status}`);
    console.log(`   Current scores: ${testGame.liveHomeScore || 0} - ${testGame.liveAwayScore || 0}`);

    // Simulate what would happen if we had external match data
    console.log('\n🔄 Simulating external API response...');
    
    // Update the game as if we received external data
    const updatedGame = await prisma.game.update({
      where: { id: testGame.id },
      data: {
        liveHomeScore: 2,
        liveAwayScore: 1,
        externalStatus: 'IN_PLAY',
        status: 'LIVE',
        lastSyncAt: new Date(),
        externalId: 'mock-12345'
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    console.log(`✅ Updated game with mock external data:`);
    console.log(`   Live scores: ${updatedGame.liveHomeScore} - ${updatedGame.liveAwayScore}`);
    console.log(`   External status: ${updatedGame.externalStatus}`);
    console.log(`   Internal status: ${updatedGame.status}`);
    console.log(`   External ID: ${updatedGame.externalId}`);
    console.log(`   Last sync: ${updatedGame.lastSyncAt.toISOString()}`);

    // Now simulate the game finishing
    console.log('\n🏁 Simulating game finish...');
    
    const finishedGame = await prisma.game.update({
      where: { id: testGame.id },
      data: {
        liveHomeScore: 2,
        liveAwayScore: 1,
        homeScore: 2, // Final score
        awayScore: 1, // Final score
        externalStatus: 'FINISHED',
        status: 'FINISHED',
        decidedBy: 'FT',
        finishedAt: new Date(),
        lastSyncAt: new Date()
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    console.log(`✅ Game finished:`);
    console.log(`   Final scores: ${finishedGame.homeScore} - ${finishedGame.awayScore}`);
    console.log(`   Status: ${finishedGame.status}`);
    console.log(`   Decided by: ${finishedGame.decidedBy}`);
    console.log(`   Finished at: ${finishedGame.finishedAt?.toISOString()}`);

    console.log('\n🎯 Live sync simulation completed successfully!');
    console.log('   This demonstrates how the API would work with real external data.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLiveSyncWithMockData();
