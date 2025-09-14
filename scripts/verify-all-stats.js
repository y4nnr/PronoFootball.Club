const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAllStats() {
  try {
    console.log('🔍 Verifying all statistics...');

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

    // 2. Check competition rankings
    console.log('\n📊 Competition Rankings (Classement en cours):');
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId: competition.id },
      include: {
        user: {
          include: {
            bets: {
              where: {
                game: {
                  competitionId: competition.id,
                  status: { in: ['FINISHED', 'LIVE'] }
                }
              }
            }
          }
        }
      }
    });

    const sortedUsers = competitionUsers.map(compUser => {
      const totalPoints = compUser.user.bets.reduce((sum, bet) => sum + bet.points, 0);
      const exactScores = compUser.user.bets.filter(bet => bet.points === 3).length;
      const correctResults = compUser.user.bets.filter(bet => bet.points > 0).length;
      const totalBets = compUser.user.bets.length;
      const accuracy = totalBets > 0 ? (correctResults / totalBets) * 100 : 0;

      return {
        name: compUser.user.name,
        totalPoints,
        exactScores,
        correctResults,
        shooters: compUser.shooters,
        accuracy,
        totalBets
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    sortedUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name}: ${user.totalPoints} points, ${user.exactScores} exact, ${user.correctResults} correct, ${user.shooters} shooters, ${user.accuracy.toFixed(1)}% accuracy`);
    });

    // 3. Check overall user statistics
    console.log('\n🌍 Overall User Statistics:');
    const allUsers = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      include: {
        stats: true,
        bets: {
          where: {
            game: {
              status: { in: ['FINISHED', 'LIVE'] }
            }
          },
          include: {
            game: {
              include: {
                competition: true
              }
            }
          }
        }
      }
    });

    allUsers.forEach(user => {
      const totalPoints = user.bets.reduce((sum, bet) => sum + bet.points, 0);
      const exactScores = user.bets.filter(bet => 
        bet.points === 3 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;
      const correctResults = user.bets.filter(bet => bet.points > 0).length;
      const totalBets = user.bets.length;
      const accuracy = totalBets > 0 ? (correctResults / totalBets) * 100 : 0;

      console.log(`   ${user.name}: ${totalPoints} total points, ${exactScores} exact scores, ${accuracy.toFixed(1)}% accuracy`);
    });

    // 4. Check recent games performance
    console.log('\n🎮 Recent Games Performance (Last 10 games):');
    const recentGames = await prisma.game.findMany({
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
        date: 'desc'
      },
      take: 10
    });

    recentGames.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} - ${game.homeScore}-${game.awayScore}`);
      game.bets.forEach(bet => {
        const pointsText = bet.points === 3 ? 'EXACT' : bet.points === 1 ? 'CORRECT' : 'WRONG';
        console.log(`      ${bet.user.name}: ${bet.score1}-${bet.score2} (${bet.points} pts - ${pointsText})`);
      });
    });

    // 5. Check global statistics rankings
    console.log('\n🏆 Global Statistics Rankings:');
    
    // Top players by points
    const topByPoints = allUsers
      .map(user => ({
        name: user.name,
        totalPoints: user.bets.reduce((sum, bet) => sum + bet.points, 0),
        exactScores: user.bets.filter(bet => 
          bet.points === 3 && 
          bet.game.competition.name.includes('UEFA Champions League 25/26')
        ).length
      }))
      .filter(user => user.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 5);

    console.log('   Top 5 by Total Points:');
    topByPoints.forEach((user, index) => {
      console.log(`      ${index + 1}. ${user.name}: ${user.totalPoints} points, ${user.exactScores} exact scores`);
    });

    // Top players by exact scores
    const topByExact = allUsers
      .map(user => ({
        name: user.name,
        exactScores: user.bets.filter(bet => 
          bet.points === 3 && 
          bet.game.competition.name.includes('UEFA Champions League 25/26')
        ).length,
        totalPoints: user.bets.reduce((sum, bet) => sum + bet.points, 0)
      }))
      .filter(user => user.exactScores > 0)
      .sort((a, b) => b.exactScores - a.exactScores)
      .slice(0, 5);

    console.log('   Top 5 by Exact Scores:');
    topByExact.forEach((user, index) => {
      console.log(`      ${index + 1}. ${user.name}: ${user.exactScores} exact scores, ${user.totalPoints} total points`);
    });

    console.log('\n✅ Statistics verification completed!');
    console.log('\n📋 Expected Results:');
    console.log('   - Fifi should be #1 with 14 points, 4 exact scores, 16 shooters');
    console.log('   - Admin should be #2 with 10 points, 2 exact scores, 16 shooters');
    console.log('   - Renato should be #3 with 2 points, 0 exact scores, 6 shooters');
    console.log('   - Keke should be #4 with 1 point, 0 exact scores, 5 shooters');
    console.log('   - Yann should be #5 with 0 points, 0 exact scores, 0 shooters');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
verifyAllStats();
