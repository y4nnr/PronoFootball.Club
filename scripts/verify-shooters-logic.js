const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyShootersLogic() {
  try {
    console.log('🔍 Verifying Shooters Logic: Matchs + Shooters = Total Games\n');
    
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
    
    let allValid = true;
    
    for (const competition of competitions) {
      console.log(`📊 Competition: ${competition.name}`);
      console.log(`   Total finished games: ${competition.games.length}`);
      
      let competitionValid = true;
      
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
        
        const shooters = competitionUser.shooters || 0;
        const total = userBets + shooters;
        const expected = competition.games.length;
        
        const isValid = total === expected;
        if (!isValid) {
          competitionValid = false;
          allValid = false;
        }
        
        const status = isValid ? '✅' : '❌';
        console.log(`   ${status} ${competitionUser.user.name}: ${userBets} bets + ${shooters} shooters = ${total} (expected: ${expected})`);
      }
      
      const competitionStatus = competitionValid ? '✅ VALID' : '❌ INVALID';
      console.log(`   Competition Status: ${competitionStatus}\n`);
    }
    
    console.log(`\n🎯 Overall Result: ${allValid ? '✅ ALL COMPETITIONS VALID' : '❌ SOME COMPETITIONS INVALID'}`);
    
    if (allValid) {
      console.log('\n✨ Perfect! The logic is working correctly:');
      console.log('   Matchs (bets placed) + Shooters (missed bets) = Total finished games');
    } else {
      console.log('\n⚠️  There are some inconsistencies that need to be investigated.');
    }
    
  } catch (error) {
    console.error('❌ Error verifying shooters logic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyShootersLogic();
