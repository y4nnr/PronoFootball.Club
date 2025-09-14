const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateShooters() {
  try {
    console.log('🎯 Updating shooters count for all competitions...\n');
    
    // Get all competitions with their users and games
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
        
        // Only update if the value has changed
        if (competitionUser.shooters !== shooters) {
          await prisma.competitionUser.update({
            where: {
              id: competitionUser.id
            },
            data: {
              shooters: shooters
            }
          });
          
          console.log(`   ${competitionUser.user.name}: ${userBets} bets, ${shooters} shooters (updated)`);
          totalUpdated++;
        } else {
          console.log(`   ${competitionUser.user.name}: ${userBets} bets, ${shooters} shooters (no change)`);
        }
      }
      
      console.log('');
    }
    
    console.log(`✅ Successfully updated ${totalUpdated} user-competition relationships`);
    
  } catch (error) {
    console.error('❌ Error updating shooters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  updateShooters();
}

module.exports = { updateShooters };
