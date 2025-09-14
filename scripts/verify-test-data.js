const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyTestData() {
  try {
    console.log('🔍 Verifying test data...');

    // 1. Get the Champions League 25/26 competition
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 25/26'
        }
      }
    });

    if (!competition) {
      console.log('❌ Champions League 25/26 competition not found');
      return;
    }

    console.log(`✅ Competition: ${competition.name}`);

    // 2. Get all finished games with their bets
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId: competition.id,
        status: 'FINISHED'
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        bets: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`\n📊 Found ${finishedGames.length} finished games:`);
    
    finishedGames.forEach((game, index) => {
      console.log(`\n${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Result: ${game.homeScore}-${game.awayScore}`);
      console.log(`   Bets:`);
      
      game.bets.forEach(bet => {
        const pointsText = bet.points === 3 ? 'EXACT' : bet.points === 1 ? 'CORRECT' : 'WRONG';
        console.log(`     ${bet.user.name}: ${bet.score1}-${bet.score2} (${bet.points} pts - ${pointsText})`);
      });
    });

    // 3. Calculate user rankings
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      include: {
        bets: {
          where: {
            game: {
              competitionId: competition.id,
              status: 'FINISHED'
            }
          }
        }
      }
    });

    const rankings = users.map(user => {
      const totalPoints = user.bets.reduce((sum, bet) => sum + bet.points, 0);
      const exactScores = user.bets.filter(bet => bet.points === 3).length;
      const correctResults = user.bets.filter(bet => bet.points > 0).length;
      const accuracy = user.bets.length > 0 ? (correctResults / user.bets.length) * 100 : 0;

      return {
        name: user.name,
        totalPoints,
        exactScores,
        accuracy,
        totalBets: user.bets.length
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    console.log('\n🏆 Final Rankings:');
    rankings.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name}: ${user.totalPoints} points (${user.exactScores} exact, ${user.accuracy.toFixed(1)}% accuracy, ${user.totalBets} bets)`);
    });

    console.log('\n✅ Test data verification completed!');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
verifyTestData();
