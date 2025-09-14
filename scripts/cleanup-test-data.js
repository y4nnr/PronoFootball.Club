const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestData() {
  try {
    console.log('🧹 Starting test data cleanup...');

    // 1. Get the Champions League 25/26 competition
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 25/26'
        }
      }
    });

    if (!competition) {
      console.log('ℹ️  Champions League 25/26 competition not found');
      return;
    }

    console.log(`✅ Found competition: ${competition.name}`);

    // 2. Get all games for this competition
    const games = await prisma.game.findMany({
      where: {
        competitionId: competition.id
      }
    });

    console.log(`📊 Found ${games.length} games in competition`);

    // 3. Delete all bets for these games
    const deletedBets = await prisma.bet.deleteMany({
      where: {
        game: {
          competitionId: competition.id
        }
      }
    });

    console.log(`🗑️  Deleted ${deletedBets.count} bets`);

    // 4. Reset all games to UPCOMING status and clear scores
    const resetGames = await prisma.game.updateMany({
      where: {
        competitionId: competition.id
      },
      data: {
        status: 'UPCOMING',
        homeScore: null,
        awayScore: null
      }
    });

    console.log(`🔄 Reset ${resetGames.count} games to UPCOMING status`);

    // 5. Remove all users from the competition
    const removedUsers = await prisma.competitionUser.deleteMany({
      where: {
        competitionId: competition.id
      }
    });

    console.log(`👥 Removed ${removedUsers.count} users from competition`);

    // 6. Optionally delete the entire competition (uncomment if needed)
    // await prisma.competition.delete({
    //   where: { id: competition.id }
    // });
    // console.log('🗑️  Deleted competition');

    console.log('\n✅ Test data cleanup completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Bets deleted: ${deletedBets.count}`);
    console.log(`   - Games reset: ${resetGames.count}`);
    console.log(`   - Users removed: ${removedUsers.count}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
cleanupTestData();
