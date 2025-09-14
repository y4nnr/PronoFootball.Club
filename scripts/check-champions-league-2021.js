const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChampionsLeague2021() {
  try {
    // Find the Champions League 2020/21 competition
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: '2020/21'
        }
      }
    });
    
    if (!competition) {
      console.log('No Champions League 2020/21 found');
      return;
    }
    
    console.log('Competition found:', {
      id: competition.id,
      name: competition.name,
      description: competition.description
    });
    
    // Check games
    const games = await prisma.game.findMany({
      where: {
        competitionId: competition.id
      }
    });
    
    console.log('Games count:', games.length);
    
    // Check users in competition
    const competitionUsers = await prisma.competitionUser.findMany({
      where: {
        competitionId: competition.id
      },
      include: {
        user: true
      }
    });
    
    console.log('Users in competition:', competitionUsers.length);
    competitionUsers.forEach(cu => {
      console.log('- User:', cu.user.name);
    });
    
    // Check bets
    const bets = await prisma.bet.findMany({
      where: {
        game: {
          competitionId: competition.id
        }
      }
    });
    
    console.log('Bets count:', bets.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChampionsLeague2021(); 