const { PrismaClient } = require('@prisma/client');

async function checkCL2021Winner() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking Champions League 2020/21 winner...\n');
    
    // Find Champions League 2020/21
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 2020'
        }
      },
      include: {
        winner: true,
        users: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!competition) {
      console.log('❌ Champions League 2020/21 not found');
      return;
    }
    
    console.log(`📊 Competition: ${competition.name}`);
    console.log(`🆔 ID: ${competition.id}`);
    console.log(`🏆 Winner ID: ${competition.winnerId}`);
    console.log(`🏆 Winner: ${competition.winner ? competition.winner.name : 'No winner set'}`);
    console.log(`👥 Participants: ${competition.users.length}`);
    
    // Get final standings
    console.log('\n📈 Final standings:');
    
    const standings = await Promise.all(
      competition.users.map(async (competitionUser) => {
        const user = competitionUser.user;
        
        const bets = await prisma.bet.findMany({
          where: {
            userId: user.id,
            game: {
              competitionId: competition.id
            }
          }
        });
        
        const totalPoints = bets.reduce((sum, bet) => sum + bet.points, 0);
        
        return {
          name: user.name,
          id: user.id,
          points: totalPoints
        };
      })
    );
    
    // Sort by points
    standings.sort((a, b) => b.points - a.points);
    
    standings.forEach((player, index) => {
      const isWinner = index === 0;
      const isSetAsWinner = competition.winnerId === player.id;
      console.log(`${index + 1}. ${player.name}: ${player.points} points ${isWinner ? '🏆' : ''} ${isSetAsWinner ? '(SET AS WINNER)' : ''}`);
    });
    
    // Check if Yann is the winner
    const yann = standings.find(p => p.name === 'Yann');
    if (yann && standings[0].name === 'Yann') {
      console.log('\n✅ Yann should be the winner (highest points)');
      if (competition.winnerId === yann.id) {
        console.log('✅ Yann is correctly set as winner in database');
      } else {
        console.log('❌ Yann is NOT set as winner in database');
        console.log(`Current winner ID: ${competition.winnerId}`);
        console.log(`Yann's ID: ${yann.id}`);
      }
    } else {
      console.log('\n❌ Yann is not the winner based on points');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCL2021Winner(); 