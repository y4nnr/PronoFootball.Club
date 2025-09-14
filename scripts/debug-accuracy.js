const { PrismaClient } = require('@prisma/client');

async function debugAccuracy() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Debugging accuracy calculation...\n');
    
    // Find Champions League 2020/21 (the one mentioned)
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 2020'
        }
      }
    });
    
    if (!competition) {
      console.log('❌ Competition not found');
      return;
    }
    
    console.log(`📊 Competition: ${competition.name}`);
    
    // Get Steph's data
    const steph = await prisma.user.findFirst({
      where: { name: 'Steph' }
    });
    
    if (!steph) {
      console.log('❌ Steph not found');
      return;
    }
    
    // Get all of Steph's bets for this competition
    const bets = await prisma.bet.findMany({
      where: {
        userId: steph.id,
        game: {
          competitionId: competition.id
        }
      },
      include: {
        game: true
      }
    });
    
    console.log(`\n👤 Steph's betting data:`);
    console.log(`📝 Total bets: ${bets.length}`);
    
    // Analyze point distribution
    const pointDistribution = {};
    let totalPoints = 0;
    
    bets.forEach(bet => {
      const points = bet.points;
      totalPoints += points;
      pointDistribution[points] = (pointDistribution[points] || 0) + 1;
    });
    
    console.log(`📈 Total points: ${totalPoints}`);
    console.log(`📊 Point distribution:`);
    
    Object.keys(pointDistribution).sort((a, b) => Number(b) - Number(a)).forEach(points => {
      console.log(`   ${points} points: ${pointDistribution[points]} bets`);
    });
    
    // Calculate accuracies
    const correctWinners = bets.filter(bet => bet.points === 1).length;
    const exactScores = bets.filter(bet => bet.points === 3).length;
    const wrongPredictions = bets.filter(bet => bet.points === 0).length;
    
    const winnerAccuracy = bets.length > 0 ? (correctWinners / bets.length) * 100 : 0;
    
    console.log(`\n🎯 Accuracy breakdown:`);
    console.log(`   🏆 Correct winners (1pt): ${correctWinners}`);
    console.log(`   🎯 Exact scores (3pt): ${exactScores}`);
    console.log(`   ❌ Wrong predictions (0pt): ${wrongPredictions}`);
    console.log(`   ✅ Winner accuracy: ${winnerAccuracy.toFixed(1)}%`);
    
    // Verify the math
    const calculatedTotal = (correctWinners * 1) + (exactScores * 3) + (wrongPredictions * 0);
    console.log(`\n🧮 Math verification:`);
    console.log(`   Calculated total: ${calculatedTotal}`);
    console.log(`   Actual total: ${totalPoints}`);
    console.log(`   Match: ${calculatedTotal === totalPoints ? '✅' : '❌'}`);
    
    // Show some sample bets
    console.log(`\n📋 Sample bets (first 10):`);
    bets.slice(0, 10).forEach((bet, index) => {
      console.log(`   ${index + 1}. Game ${bet.gameId}: ${bet.points} points`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugAccuracy(); 