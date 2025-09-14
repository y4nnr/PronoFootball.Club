const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixExactScoresOnly() {
  try {
    console.log('🔧 Fixing exact scores to only count Champions League 25/26 onwards...');

    // 1. Get all users
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      include: {
        bets: {
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

    console.log(`👥 Processing ${users.length} users...`);

    // 2. Fix exact scores for each user (only Champions League 25/26 onwards)
    for (const user of users) {
      console.log(`\n📊 Fixing exact scores for ${user.name}...`);

      // Get all bets from finished games
      const finishedGameBets = user.bets.filter(bet => 
        bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
      );

      // Calculate basic stats
      const totalBets = finishedGameBets.length;
      const totalPoints = finishedGameBets.reduce((sum, bet) => sum + bet.points, 0);
      const correctPredictions = finishedGameBets.filter(bet => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;

      // Calculate exact scores (3 points) - ONLY from Champions League 25/26 onwards
      const exactScores = finishedGameBets.filter(bet => 
        bet.points === 3 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;

      // Calculate competition wins (only completed competitions)
      const competitionWins = await prisma.competition.count({
        where: {
          winnerId: user.id,
          status: 'COMPLETED'
        }
      });

      // Calculate streaks properly (from all finished games)
      const { longestStreak, exactScoreStreak } = calculateStreaks(finishedGameBets);

      // Update UserStats
      await prisma.userStats.upsert({
        where: { userId: user.id },
        update: {
          totalPredictions: totalBets,
          totalPoints: totalPoints,
          accuracy: Math.round(accuracy * 100) / 100,
          wins: competitionWins,
          longestStreak: longestStreak,
          exactScoreStreak: exactScoreStreak,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          totalPredictions: totalBets,
          totalPoints: totalPoints,
          accuracy: Math.round(accuracy * 100) / 100,
          wins: competitionWins,
          longestStreak: longestStreak,
          exactScoreStreak: exactScoreStreak
        }
      });

      console.log(`   ✅ ${user.name}: ${totalPoints} points, ${exactScores} exact (CL25/26 only), ${longestStreak} streak, ${exactScoreStreak} exact streak, ${accuracy.toFixed(1)}% accuracy`);
    }

    // 3. Display verification
    console.log('\n🔍 Verification - Champions League 25/26 exact scores:');
    
    const clCompetition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 25/26'
        }
      }
    });

    if (clCompetition) {
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

      clUsers.forEach(compUser => {
        const totalPoints = compUser.user.bets.reduce((sum, bet) => sum + bet.points, 0);
        const exactScores = compUser.user.bets.filter(bet => bet.points === 3).length;
        const correctResults = compUser.user.bets.filter(bet => bet.points > 0).length;
        const totalBets = compUser.user.bets.length;
        const accuracy = totalBets > 0 ? (correctResults / totalBets) * 100 : 0;

        console.log(`   ${compUser.user.name}: ${totalPoints} points, ${exactScores} exact, ${correctResults} correct, ${compUser.shooters} shooters, ${accuracy.toFixed(1)}% accuracy`);
      });
    }

    console.log('\n✅ Exact scores fixed to only count Champions League 25/26 onwards!');
    console.log('\n📋 Expected Results:');
    console.log('   - Fifi should have 4 exact scores (from CL 25/26)');
    console.log('   - Admin should have 2 exact scores (from CL 25/26)');
    console.log('   - Others should have 0 exact scores (from CL 25/26)');
    console.log('   - Streaks should be calculated from all finished games');

  } catch (error) {
    console.error('❌ Error during exact scores fix:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to calculate streaks
function calculateStreaks(bets) {
  if (bets.length === 0) {
    return { longestStreak: 0, exactScoreStreak: 0 };
  }

  // Sort bets by game date to ensure chronological order
  const sortedBets = [...bets].sort((a, b) => new Date(a.game.date) - new Date(b.game.date));
  
  let longestStreak = 0;
  let currentStreak = 0;
  let exactScoreStreak = 0;
  let currentExactStreak = 0;

  for (const bet of sortedBets) {
    if (bet.points > 0) {
      // Points streak
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }

    if (bet.points === 3) {
      // Exact score streak
      currentExactStreak++;
      exactScoreStreak = Math.max(exactScoreStreak, currentExactStreak);
    } else {
      currentExactStreak = 0;
    }
  }

  return { longestStreak, exactScoreStreak };
}

// Run the script
fixExactScoresOnly();
