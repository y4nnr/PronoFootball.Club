const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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

async function fixAllStatistics() {
  try {
    console.log('🔧 Fixing all statistics with proper calculations...');

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

    // 2. Fix statistics for each user
    for (const user of users) {
      console.log(`\n📊 Fixing stats for ${user.name}...`);

      // Get all bets from finished games
      const finishedGameBets = user.bets.filter(bet => 
        bet.game.status === 'FINISHED' || bet.game.status === 'LIVE'
      );

      // Calculate basic stats
      const totalBets = finishedGameBets.length;
      const totalPoints = finishedGameBets.reduce((sum, bet) => sum + bet.points, 0);
      const correctPredictions = finishedGameBets.filter(bet => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;

      // Calculate exact scores (3 points) - only from Champions League 25/26 onwards
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

      // Calculate streaks properly
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

      console.log(`   ✅ ${user.name}: ${totalPoints} points, ${exactScores} exact, ${longestStreak} streak, ${exactScoreStreak} exact streak, ${accuracy.toFixed(1)}% accuracy`);
    }

    // 3. Fix competition-specific statistics
    console.log('\n🏆 Fixing competition statistics...');
    
    const competitions = await prisma.competition.findMany({
      include: {
        users: {
          include: {
            user: {
              include: {
                bets: {
                  where: {
                    game: {
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

    for (const competition of competitions) {
      console.log(`\n📊 Fixing stats for competition: ${competition.name}`);

      for (const compUser of competition.users) {
        const user = compUser.user;
        
        // Get bets only from this competition's finished games
        const competitionBets = user.bets.filter(bet => 
          bet.game.competitionId === competition.id && 
          (bet.game.status === 'FINISHED' || bet.game.status === 'LIVE')
        );

        // Calculate shooters (goals scored in correct predictions) - only from this competition
        let shooters = 0;
        competitionBets.forEach(bet => {
          if (bet.points > 0) { // Correct prediction
            // Add goals from the predicted score
            shooters += bet.score1 + bet.score2;
          }
        });

        // Update CompetitionUser with shooters for this competition
        await prisma.competitionUser.update({
          where: { id: compUser.id },
          data: { shooters: shooters }
        });

        const totalPoints = competitionBets.reduce((sum, bet) => sum + bet.points, 0);
        const exactScores = competitionBets.filter(bet => bet.points === 3).length;
        const correctResults = competitionBets.filter(bet => bet.points > 0).length;

        console.log(`   ✅ ${user.name}: ${totalPoints} points, ${exactScores} exact, ${correctResults} correct, ${shooters} shooters`);
      }
    }

    // 4. Display final verification
    console.log('\n🔍 Final verification...');
    
    // Check Champions League 25/26 specifically
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

    if (clCompetition) {
      // Update the competition ID for the query
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

      console.log(`\n🏆 Champions League 25/26 Rankings:`);
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
          totalBets,
          longestStreak: compUser.user.stats?.longestStreak || 0,
          exactScoreStreak: compUser.user.stats?.exactScoreStreak || 0
        };
      }).sort((a, b) => b.totalPoints - a.totalPoints);

      sortedUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name}: ${user.totalPoints} points, ${user.exactScores} exact, ${user.correctResults} correct, ${user.shooters} shooters, ${user.accuracy.toFixed(1)}% accuracy`);
        console.log(`      Streaks: ${user.longestStreak} points, ${user.exactScoreStreak} exact scores`);
      });
    }

    console.log('\n✅ All statistics fixed successfully!');
    console.log('\n📋 What should now be correct:');
    console.log('   - Total Scores Exacts: Should show correct counts for Champions League 25/26');
    console.log('   - Plus Longue Série (Points): Should show actual longest streak of consecutive points');
    console.log('   - Plus Longue Série (Score Exact): Should show actual longest streak of exact scores');
    console.log('   - All global rankings should be properly calculated');

  } catch (error) {
    console.error('❌ Error during statistics fix:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixAllStatistics();
