const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDBSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Try to query a game with the new fields
    const game = await prisma.game.findFirst({
      select: {
        id: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        status: true,
        externalId: true,
        liveHomeScore: true,
        liveAwayScore: true,
        lastSyncAt: true,
        externalStatus: true,
        statusDetail: true,
        decidedBy: true,
        finishedAt: true
      }
    });

    if (game) {
      console.log('✅ Database schema includes new fields:');
      console.log(`  externalId: ${game.externalId}`);
      console.log(`  liveHomeScore: ${game.liveHomeScore}`);
      console.log(`  liveAwayScore: ${game.liveAwayScore}`);
      console.log(`  lastSyncAt: ${game.lastSyncAt}`);
      console.log(`  externalStatus: ${game.externalStatus}`);
      console.log(`  statusDetail: ${game.statusDetail}`);
      console.log(`  decidedBy: ${game.decidedBy}`);
      console.log(`  finishedAt: ${game.finishedAt}`);
    } else {
      console.log('❌ No games found');
    }

    // Try to update a game with new fields
    console.log('\n🧪 Testing update with new fields...');
    const testGame = await prisma.game.findFirst();
    if (testGame) {
      try {
        const updated = await prisma.game.update({
          where: { id: testGame.id },
          data: {
            externalId: 'test-123',
            liveHomeScore: 1,
            liveAwayScore: 0,
            lastSyncAt: new Date(),
            externalStatus: 'IN_PLAY'
          }
        });
        console.log('✅ Successfully updated game with new fields');
        console.log(`  externalId: ${updated.externalId}`);
        console.log(`  liveHomeScore: ${updated.liveHomeScore}`);
        console.log(`  liveAwayScore: ${updated.liveAwayScore}`);
      } catch (error) {
        console.log('❌ Failed to update game with new fields:');
        console.log(error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDBSchema();
