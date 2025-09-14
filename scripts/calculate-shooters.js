const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function calculateShooters() {
  try {
    console.log('🎯 Calculating shooters (forgotten bets) for all competitions...\n');
    
    // Get all competitions
    const competitions = await prisma.competition.findMany({
      include: {
        users: {
          include: {
            user: true
          }
        },
        games: {
          where: {
            status: { in: ['FINISHED', 'LIVE'] } // Only count finished/live games
          }
        }
      }
    });
    
    let totalUpdated = 0;
    
    for (const competition of competitions) {
      console.log(`📊 Processing competition: ${competition.name}`);
      console.log(`   Games: ${competition.games.length} (finished/live)`);
      console.log(`   Users: ${competition.users.length}`);
      
      for (const competitionUser of competition.users) {
        // Count how many games this user bet on in this competition
        const userBets = await prisma.bet.count({
          where: {
            userId: competitionUser.userId,
            game: {
              competitionId: competition.id,
              status: { in: ['FINISHED', 'LIVE'] }
            }
          }
        });
        
        // Calculate shooters (forgotten bets)
        const shooters = competition.games.length - userBets;
        
        // Update the CompetitionUser record
        await prisma.competitionUser.update({
          where: {
            id: competitionUser.id
          },
          data: {
            shooters: shooters
          }
        });
        
        console.log(`   ${competitionUser.user.name}: ${userBets} bets, ${shooters} shooters`);
        totalUpdated++;
      }
      
      console.log('');
    }
    
    console.log(`✅ Successfully updated ${totalUpdated} user-competition relationships`);
    
    // Show summary by competition
    console.log('\n📈 Summary by competition:');
    for (const competition of competitions) {
      const avgShooters = competition.users.reduce((sum, cu) => sum + cu.shooters, 0) / competition.users.length;
      const maxShooters = Math.max(...competition.users.map(cu => cu.shooters));
      const minShooters = Math.min(...competition.users.map(cu => cu.shooters));
      
      console.log(`   ${competition.name}:`);
      console.log(`     Average shooters: ${avgShooters.toFixed(1)}`);
      console.log(`     Max shooters: ${maxShooters}`);
      console.log(`     Min shooters: ${minShooters}`);
    }
    
  } catch (error) {
    console.error('❌ Error calculating shooters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

calculateShooters();
