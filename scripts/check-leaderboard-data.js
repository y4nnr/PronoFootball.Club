const { PrismaClient } = require('@prisma/client');

async function checkLeaderboardData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking leaderboard data for Champions League 2020/21...\n');
    
    // Get all competitions like the API does
    const competitions = await prisma.competition.findMany({
      include: {
        winner: true
      }
    });
    
    console.log(`📊 Total competitions found: ${competitions.length}`);
    console.log('\n📋 All competitions:');
    
    competitions.forEach(comp => {
      console.log(`- ${comp.name} (Winner: ${comp.winner ? comp.winner.name : 'None'})`);
    });
    
    // Specifically check Champions League 2020/21
    const cl2021 = competitions.find(c => c.name.includes('2020') && c.name.includes('Champions League'));
    
    if (cl2021) {
      console.log(`\n✅ Champions League 2020/21 found:`);
      console.log(`   Name: ${cl2021.name}`);
      console.log(`   ID: ${cl2021.id}`);
      console.log(`   Winner ID: ${cl2021.winnerId}`);
      console.log(`   Winner Name: ${cl2021.winner ? cl2021.winner.name : 'None'}`);
      console.log(`   Status: ${cl2021.status}`);
    } else {
      console.log('\n❌ Champions League 2020/21 NOT found in competitions');
    }
    
    // Check Yann's competition wins
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    if (yann) {
      const yannWins = competitions.filter(comp => comp.winner?.id === yann.id);
      console.log(`\n👤 Yann's competition wins: ${yannWins.length}`);
      yannWins.forEach(comp => {
        console.log(`   - ${comp.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLeaderboardData(); 