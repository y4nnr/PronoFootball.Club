const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllCompetitions() {
  try {
    console.log('📊 Checking all competitions...\n');
    
    const competitions = await prisma.competition.findMany({
      orderBy: { startDate: 'desc' }
    });
    
    for (const competition of competitions) {
      console.log(`🏆 ${competition.name}`);
      console.log(`   ID: ${competition.id}`);
      console.log(`   Status: ${competition.status}`);
      
      // Count games
      const gameCount = await prisma.game.count({
        where: { competitionId: competition.id }
      });
      
      // Count users
      const userCount = await prisma.competitionUser.count({
        where: { competitionId: competition.id }
      });
      
      // Count bets
      const betCount = await prisma.bet.count({
        where: { game: { competitionId: competition.id } }
      });
      
      console.log(`   Games: ${gameCount}`);
      console.log(`   Users: ${userCount}`);
      console.log(`   Bets: ${betCount}`);
      
      if (userCount > 0) {
        const users = await prisma.competitionUser.findMany({
          where: { competitionId: competition.id },
          include: { user: true }
        });
        console.log(`   Participants: ${users.map(u => u.user.name).join(', ')}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllCompetitions(); 