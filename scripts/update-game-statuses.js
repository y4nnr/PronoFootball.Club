const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateGameStatuses() {
  try {
    console.log('🔄 Starting automatic game status update...\n');
    
    const now = new Date();
    console.log(`⏰ Current time: ${now.toISOString()}`);
    console.log(`⏰ Local time: ${now.toLocaleString()}\n`);

    // Find games that should be LIVE (UPCOMING games where start time has passed)
    const gamesToUpdate = await prisma.game.findMany({
      where: {
        status: 'UPCOMING',
        date: {
          lte: now // Game time has passed
        }
      },
      select: {
        id: true,
        date: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        competition: { select: { name: true } }
      },
      orderBy: { date: 'asc' }
    });

    console.log(`📊 Found ${gamesToUpdate.length} games that should be LIVE:`);
    
    if (gamesToUpdate.length === 0) {
      console.log('✅ No games need status updates');
      return;
    }

    // Display games that will be updated
    gamesToUpdate.forEach((game, index) => {
      const gameTime = new Date(game.date);
      const timeDiff = Math.round((now.getTime() - gameTime.getTime()) / (1000 * 60));
      console.log(`   ${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`      Competition: ${game.competition.name}`);
      console.log(`      Game time: ${gameTime.toLocaleString()}`);
      console.log(`      Minutes past start: ${timeDiff}\n`);
    });

    // Update games to LIVE status
    const updateResult = await prisma.game.updateMany({
      where: {
        id: {
          in: gamesToUpdate.map(game => game.id)
        }
      },
      data: {
        status: 'LIVE'
      }
    });

    console.log(`✅ Successfully updated ${updateResult.count} games to LIVE status`);
    
    // Show updated games
    console.log('\n🎯 Updated games:');
    gamesToUpdate.forEach((game, index) => {
      const timeDiff = Math.round((now.getTime() - new Date(game.date).getTime()) / (1000 * 60));
      console.log(`   ${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} (${timeDiff} min past start)`);
    });

  } catch (error) {
    console.error('❌ Error updating game statuses:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateGameStatuses();
