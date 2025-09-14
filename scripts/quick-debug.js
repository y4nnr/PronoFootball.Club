const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  
  try {
    // List all competitions to see what we have
    const competitions = await prisma.competition.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            games: true,
            users: true
          }
        }
      }
    });
    
    console.log('Available competitions:');
    competitions.forEach(comp => {
      console.log(`- ${comp.name} (${comp._count.games} games, ${comp._count.users} users)`);
    });
    
    // Find the one that might be Champions League 2020/21
    const cl2021 = competitions.find(c => c.name.includes('2020') || c.name.includes('2021'));
    
    if (cl2021) {
      console.log(`\nChecking: ${cl2021.name}`);
      
      // Get Steph's bets
      const steph = await prisma.user.findFirst({ where: { name: 'Steph' } });
      if (steph) {
        const bets = await prisma.bet.findMany({
          where: {
            userId: steph.id,
            game: { competitionId: cl2021.id }
          }
        });
        
        const totalPoints = bets.reduce((sum, bet) => sum + bet.points, 0);
        const onePointBets = bets.filter(bet => bet.points === 1).length;
        const threePointBets = bets.filter(bet => bet.points === 3).length;
        const zeroPointBets = bets.filter(bet => bet.points === 0).length;
        
        console.log(`Steph in ${cl2021.name}:`);
        console.log(`- Total bets: ${bets.length}`);
        console.log(`- Total points: ${totalPoints}`);
        console.log(`- 1-point bets: ${onePointBets}`);
        console.log(`- 3-point bets: ${threePointBets}`);
        console.log(`- 0-point bets: ${zeroPointBets}`);
        console.log(`- Winner accuracy: ${((onePointBets / bets.length) * 100).toFixed(1)}%`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})(); 