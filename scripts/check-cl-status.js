const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function checkStatus() {
  const prisma = new PrismaClient();
  const results = [];
  
  try {
    results.push('Checking Champions League 2020/21 status...');
    
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) {
      results.push('❌ No Champions League 2020/21 found');
      fs.writeFileSync('cl-status.txt', results.join('\n'));
      return;
    }
    
    results.push(`✅ Found: ${competition.name} (ID: ${competition.id})`);
    
    const gameCount = await prisma.game.count({
      where: { competitionId: competition.id }
    });
    
    const betCount = await prisma.bet.count({
      where: { game: { competitionId: competition.id } }
    });
    
    const userCount = await prisma.competitionUser.count({
      where: { competitionId: competition.id }
    });
    
    results.push(`📊 Current state:`);
    results.push(`   Games: ${gameCount}`);
    results.push(`   Bets: ${betCount}`);
    results.push(`   Users: ${userCount}`);
    
    // Check if we have the wrong teams (national teams)
    const nationalTeamGames = await prisma.game.count({
      where: {
        competitionId: competition.id,
        OR: [
          { homeTeam: { category: 'NATIONAL' } },
          { awayTeam: { category: 'NATIONAL' } }
        ]
      }
    });
    
    results.push(`   National team games: ${nationalTeamGames}`);
    
    if (nationalTeamGames > 0) {
      results.push('❌ Found national teams in Champions League - needs fixing');
    }
    
    // Check user points
    const users = await prisma.user.findMany({
      where: {
        name: { in: ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'] }
      }
    });
    
    results.push('\n👥 User points:');
    for (const user of users) {
      const points = await prisma.bet.aggregate({
        where: {
          userId: user.id,
          game: { competitionId: competition.id }
        },
        _sum: { points: true }
      });
      
      const betCount = await prisma.bet.count({
        where: {
          userId: user.id,
          game: { competitionId: competition.id }
        }
      });
      
      results.push(`   ${user.name}: ${points._sum.points || 0} points, ${betCount} bets`);
    }
    
  } catch (error) {
    results.push(`❌ Error: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
  
  fs.writeFileSync('cl-status.txt', results.join('\n'));
}

checkStatus(); 