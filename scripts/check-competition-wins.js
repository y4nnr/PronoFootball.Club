const { PrismaClient } = require('@prisma/client');

async function checkCompetitionWins() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🏆 Checking competition wins for all users...\n');
    
    // Get all competitions with their winners
    const competitions = await prisma.competition.findMany({
      include: {
        winner: true
      }
    });
    
    console.log(`📊 Total competitions: ${competitions.length}\n`);
    
    // Count wins per user
    const winCounts = {};
    
    competitions.forEach(comp => {
      if (comp.winner) {
        const winnerName = comp.winner.name;
        winCounts[winnerName] = (winCounts[winnerName] || 0) + 1;
      }
    });
    
    // Sort by wins
    const sortedWins = Object.entries(winCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([name, wins], index) => ({ rank: index + 1, name, wins }));
    
    console.log('🏅 Competition wins ranking:');
    console.log('===========================');
    sortedWins.forEach(player => {
      console.log(`${player.rank}. ${player.name}: ${player.wins} wins`);
    });
    
    // Show competitions won by each user
    console.log('\n📋 Detailed breakdown:');
    console.log('======================');
    
    for (const [userName, winCount] of Object.entries(winCounts)) {
      const userWins = competitions.filter(comp => comp.winner?.name === userName);
      console.log(`\n👤 ${userName} (${winCount} wins):`);
      userWins.forEach(comp => {
        console.log(`   - ${comp.name}`);
      });
    }
    
    // Check specifically for Yann
    const yannWins = competitions.filter(comp => comp.winner?.name === 'Yann');
    console.log(`\n🎯 Yann specifically:`);
    console.log(`   Wins: ${yannWins.length}`);
    if (yannWins.length > 0) {
      yannWins.forEach(comp => {
        console.log(`   - ${comp.name} (ID: ${comp.id})`);
      });
    } else {
      console.log('   No wins found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompetitionWins(); 