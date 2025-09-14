const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing new accuracy calculation...');
    
    // Find Champions League 2018/19
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 2018'
        }
      }
    });
    
    if (!competition) {
      console.log('Competition not found');
      return;
    }
    
    console.log(`Found: ${competition.name}`);
    
    // Get Benouz's bets (the winner)
    const benouz = await prisma.user.findFirst({
      where: { name: 'Benouz' }
    });
    
    if (!benouz) {
      console.log('Benouz not found');
      return;
    }
    
    const bets = await prisma.bet.findMany({
      where: {
        userId: benouz.id,
        game: {
          competitionId: competition.id
        }
      }
    });
    
    const totalPoints = bets.reduce((sum, bet) => sum + bet.points, 0);
    const correctWinners = bets.filter(bet => bet.points === 1).length;
    const exactScores = bets.filter(bet => bet.points === 3).length;
    const totalPredictions = bets.length;
    
    const winnerAccuracy = (correctWinners / totalPredictions) * 100;
    
    console.log(`Benouz stats:`);
    console.log(`- Total Points: ${totalPoints}`);
    console.log(`- Total Predictions: ${totalPredictions}`);
    console.log(`- Correct Winners (1pt): ${correctWinners}`);
    console.log(`- Exact Scores (3pt): ${exactScores}`);
    console.log(`- Winner Accuracy: ${winnerAccuracy.toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 