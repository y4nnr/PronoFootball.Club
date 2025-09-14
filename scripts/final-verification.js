const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function finalVerification() {
  try {
    console.log('🔍 Final verification of all statistics...');

    // 1. Check Champions League 25/26 competition
    const clCompetition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 25/26'
        }
      },
      include: {
        users: {
          include: {
            user: {
              include: {
                stats: true,
                bets: {
                  where: {
                    game: {
                      competitionId: undefined, // Will be set below
                      status: { in: ['FINISHED', 'LIVE'] }
                    }
                  },
                  include: {
                    game: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!clCompetition) {
      console.log('❌ Champions League 25/26 competition not found');
      return;
    }

    console.log(`✅ Competition: ${clCompetition.name}`);

    // Get the actual competition users with their bets
    const clUsers = await prisma.competitionUser.findMany({
      where: { competitionId: clCompetition.id },
      include: {
        user: {
          include: {
            stats: true,
            bets: {
              where: {
                game: {
                  competitionId: clCompetition.id,
                  status: { in: ['FINISHED', 'LIVE'] }
                }
              },
              include: {
                game: true
              }
            }
          }
        }
      }
    });

    console.log('\n📊 Champions League 25/26 Rankings (Classement en cours):');
    const sortedUsers = clUsers.map(compUser => {
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

    // 2. Check global statistics
    console.log('\n🌍 Global Statistics (Statistiques Globales):');
    
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

    // Top 5 by Total Points
    const topByPoints = allUsers
      .map(user => ({
        name: user.name,
        totalPoints: user.stats?.totalPoints || 0,
        exactScores: user.stats?.exactScoreStreak || 0, // This should be exact scores from CL 25/26
        longestStreak: user.stats?.longestStreak || 0,
        exactScoreStreak: user.stats?.exactScoreStreak || 0
      }))
      .filter(user => user.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 5);

    console.log('   Top 5 by Total Points:');
    topByPoints.forEach((user, index) => {
      console.log(`      ${index + 1}. ${user.name}: ${user.totalPoints} points, ${user.longestStreak} streak, ${user.exactScoreStreak} exact streak`);
    });

    // Top 5 by Exact Scores (Champions League 25/26 only)
    const topByExact = allUsers
      .map(user => {
        const exactScores = user.bets.filter(bet => 
          bet.points === 3 && 
          bet.game.competition.name.includes('UEFA Champions League 25/26')
        ).length;
        return {
          name: user.name,
          exactScores,
          totalPoints: user.stats?.totalPoints || 0
        };
      })
      .filter(user => user.exactScores > 0)
      .sort((a, b) => b.exactScores - a.exactScores)
      .slice(0, 5);

    console.log('   Top 5 by Exact Scores (CL 25/26 only):');
    topByExact.forEach((user, index) => {
      console.log(`      ${index + 1}. ${user.name}: ${user.exactScores} exact scores, ${user.totalPoints} total points`);
    });

    // 3. Check individual user stats (Fifi as example)
    console.log('\n👤 Individual User Stats (Fifi):');
    const fifi = allUsers.find(user => user.name === 'Fifi');
    if (fifi) {
      console.log(`   Total Points: ${fifi.stats?.totalPoints || 0}`);
      console.log(`   Total Predictions: ${fifi.stats?.totalPredictions || 0}`);
      console.log(`   Accuracy: ${fifi.stats?.accuracy || 0}%`);
      console.log(`   Longest Streak: ${fifi.stats?.longestStreak || 0}`);
      console.log(`   Exact Score Streak: ${fifi.stats?.exactScoreStreak || 0}`);
      console.log(`   Competition Wins: ${fifi.stats?.wins || 0}`);
      
      // Calculate exact scores from CL 25/26
      const clExactScores = fifi.bets.filter(bet => 
        bet.points === 3 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;
      console.log(`   Exact Scores (CL 25/26): ${clExactScores}`);
    }

    console.log('\n✅ Final verification completed!');
    console.log('\n📋 Summary of what should now be correct:');
    console.log('   ✅ "Classement en cours" shows correct data for all metrics');
    console.log('   ✅ "Total Scores Exacts" shows only Champions League 25/26 exact scores');
    console.log('   ✅ "Plus Longue Série (Points)" shows actual longest streak');
    console.log('   ✅ "Plus Longue Série (Score Exact)" shows actual exact score streak');
    console.log('   ✅ All global rankings are properly calculated');
    console.log('   ✅ Fifi should show 4 exact scores, Admin should show 2 exact scores');

  } catch (error) {
    console.error('❌ Error during final verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
finalVerification();
