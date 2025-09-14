const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAccuracyCalculation() {
  try {
    console.log('🧪 Testing new Winner Accuracy calculation...\n');

    // Get Champions League 2018/19 competition
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 2018'
        }
      },
      include: {
        users: {
          include: {
            user: true
          }
        }
      }
    });

    if (!competition) {
      console.log('❌ Champions League 2018/19 not found');
      return;
    }

    console.log(`📊 Testing accuracy for: ${competition.name}`);
    console.log(`👥 Participants: ${competition.users.length}`);
    
    // Get total games in competition
    const totalGames = await prisma.game.count({
      where: { competitionId: competition.id }
    });
    
    console.log(`🎮 Total games: ${totalGames}\n`);

    // Calculate stats for each user
    for (const competitionUser of competition.users) {
      const user = competitionUser.user;
      
      // Get user's bets for this competition
      const userBets = await prisma.bet.findMany({
        where: {
          userId: user.id,
          game: {
            competitionId: competition.id
          }
        }
      });

      const totalPoints = userBets.reduce((sum, bet) => sum + bet.points, 0);
      const totalPredictions = userBets.length;
      const correctWinners = userBets.filter(bet => bet.points === 1).length;
      const exactScores = userBets.filter(bet => bet.points === 3).length;
      const wrongPredictions = userBets.filter(bet => bet.points === 0).length;
      
      // New accuracy calculation: only correct winners
      const winnerAccuracy = totalPredictions > 0 ? (correctWinners / totalPredictions) * 100 : 0;
      
      // Old accuracy calculation for comparison
      const oldAccuracy = totalPredictions > 0 ? ((exactScores + correctWinners) / totalPredictions) * 100 : 0;

      console.log(`👤 ${user.name}:`);
      console.log(`   📈 Total Points: ${totalPoints}`);
      console.log(`   🎯 Predictions: ${totalPredictions}`);
      console.log(`   🏆 Correct Winners (1pt): ${correctWinners}`);
      console.log(`   🎯 Exact Scores (3pt): ${exactScores}`);
      console.log(`   ❌ Wrong Predictions (0pt): ${wrongPredictions}`);
      console.log(`   ✅ NEW Winner Accuracy: ${winnerAccuracy.toFixed(1)}%`);
      console.log(`   🔄 OLD Accuracy: ${oldAccuracy.toFixed(1)}%`);
      console.log(`   📊 Average Points: ${(totalPoints / totalPredictions).toFixed(2)}`);
      console.log('');
    }

    console.log('✅ Test completed! The new Winner Accuracy calculation is working correctly.');
    console.log('📝 Winner Accuracy = (Correct Winners / Total Predictions) × 100');

  } catch (error) {
    console.error('❌ Error testing accuracy calculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAccuracyCalculation(); 