const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function verifyCL2021() {
  try {
    const results = [];
    results.push('=== Champions League 2020/21 Verification ===\n');
    
    // Find the competition
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) {
      results.push('❌ Competition not found');
      fs.writeFileSync('cl-verification.txt', results.join('\n'));
      return;
    }
    
    results.push(`✅ Competition: ${competition.name}`);
    results.push(`   ID: ${competition.id}`);
    results.push(`   Status: ${competition.status}\n`);
    
    // Check games
    const gameCount = await prisma.game.count({
      where: { competitionId: competition.id }
    });
    results.push(`🎮 Games: ${gameCount}`);
    
    // Check users in competition
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId: competition.id },
      include: { user: true }
    });
    results.push(`👥 Users in competition: ${competitionUsers.length}`);
    competitionUsers.forEach(cu => {
      results.push(`   - ${cu.user.name}`);
    });
    
    // Check total bets
    const totalBets = await prisma.bet.count({
      where: { game: { competitionId: competition.id } }
    });
    results.push(`\n🎯 Total bets: ${totalBets}`);
    results.push(`   Expected: ${gameCount * competitionUsers.length} (${gameCount} games × ${competitionUsers.length} users)`);
    
    // Check each user's points and bets
    results.push('\n📊 User Statistics:');
    const userNames = ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'];
    
    for (const userName of userNames) {
      const user = competitionUsers.find(cu => cu.user.name === userName);
      if (!user) {
        results.push(`   ❌ ${userName}: Not found in competition`);
        continue;
      }
      
      const userBets = await prisma.bet.count({
        where: {
          userId: user.user.id,
          game: { competitionId: competition.id }
        }
      });
      
      const userPoints = await prisma.bet.aggregate({
        where: {
          userId: user.user.id,
          game: { competitionId: competition.id }
        },
        _sum: { points: true }
      });
      
      const points = userPoints._sum.points || 0;
      results.push(`   ${userName}: ${points} points, ${userBets} bets`);
    }
    
    // Check if teams are clubs (not national teams)
    const sampleGames = await prisma.game.findMany({
      where: { competitionId: competition.id },
      include: { homeTeam: true, awayTeam: true },
      take: 3
    });
    
    results.push('\n🏟️ Sample games (checking team types):');
    sampleGames.forEach(game => {
      results.push(`   ${game.homeTeam.name} (${game.homeTeam.category}) vs ${game.awayTeam.name} (${game.awayTeam.category})`);
    });
    
    const nationalTeamGames = await prisma.game.count({
      where: {
        competitionId: competition.id,
        OR: [
          { homeTeam: { category: 'NATIONAL' } },
          { awayTeam: { category: 'NATIONAL' } }
        ]
      }
    });
    
    if (nationalTeamGames > 0) {
      results.push(`   ❌ Found ${nationalTeamGames} games with national teams`);
    } else {
      results.push(`   ✅ All games use club teams`);
    }
    
    results.push('\n=== Verification Complete ===');
    
    fs.writeFileSync('cl-verification.txt', results.join('\n'));
    console.log('Verification complete - check cl-verification.txt');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCL2021(); 