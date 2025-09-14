const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateTestStatistics() {
  try {
    console.log('🔄 Updating statistics for test data only...');

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

    console.log(`✅ Found competition: ${competition.name}`);

    // 2. Get only the users who have bets in this competition
    const usersWithBets = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        },
        bets: {
          some: {
            game: {
              competitionId: competition.id
            }
          }
        }
      },
      include: {
        bets: {
          where: {
            game: {
              competitionId: competition.id,
              status: { in: ['FINISHED', 'LIVE'] }
            }
          },
          include: {
            game: true
          }
        }
      }
    });

    console.log(`👥 Processing ${usersWithBets.length} users with bets in this competition...`);

    // 3. Update statistics for each user (only for this competition)
    for (const user of usersWithBets) {
      console.log(`\n📊 Updating stats for ${user.name}...`);

      // Get bets only from this competition's finished games
      const competitionBets = user.bets.filter(bet => 
        bet.game.competitionId === competition.id && 
        (bet.game.status === 'FINISHED' || bet.game.status === 'LIVE')
      );

      // Calculate basic stats for this competition only
      const totalBets = competitionBets.length;
      const totalPoints = competitionBets.reduce((sum, bet) => sum + bet.points, 0);
      const correctPredictions = competitionBets.filter(bet => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;

      // Calculate exact scores (3 points) - only from this competition
      const exactScores = competitionBets.filter(bet => bet.points === 3).length;

      // Calculate correct results (1+ points) - only from this competition
      const correctResults = competitionBets.filter(bet => bet.points > 0).length;

      // Calculate shooters (goals scored in correct predictions) - only from this competition
      let shooters = 0;
      competitionBets.forEach(bet => {
        if (bet.points > 0) { // Correct prediction
          // Add goals from the predicted score
          shooters += bet.score1 + bet.score2;
        }
      });

      // Update CompetitionUser with shooters for this competition
      await prisma.competitionUser.updateMany({
        where: {
          userId: user.id,
          competitionId: competition.id
        },
        data: { shooters: shooters }
      });

      console.log(`   ✅ ${user.name}: ${totalPoints} points, ${exactScores} exact, ${correctResults} correct, ${shooters} shooters, ${accuracy.toFixed(1)}% accuracy`);
    }

    // 4. Update overall user statistics (all competitions)
    console.log('\n🌍 Updating overall user statistics...');
    
    for (const user of usersWithBets) {
      // Get all bets from finished games across all competitions
      const allFinishedBets = await prisma.bet.findMany({
        where: {
          userId: user.id,
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
      });

      // Calculate overall stats
      const totalBets = allFinishedBets.length;
      const totalPoints = allFinishedBets.reduce((sum, bet) => sum + bet.points, 0);
      const correctPredictions = allFinishedBets.filter(bet => bet.points > 0).length;
      const accuracy = totalBets > 0 ? (correctPredictions / totalBets) * 100 : 0;

      // Calculate exact scores (3 points) - only from Champions League 25/26 onwards
      const exactScores = allFinishedBets.filter(bet => 
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

      // Calculate forgotten bets
      const userCompetitions = await prisma.competitionUser.findMany({
        where: { userId: user.id },
        include: {
          competition: {
            include: {
              games: {
                where: {
                  status: { in: ['FINISHED', 'LIVE'] }
                }
              }
            }
          }
        }
      });

      let forgottenBets = 0;
      for (const userComp of userCompetitions) {
        const competitionGames = userComp.competition.games;
        const userBetsInCompetition = allFinishedBets.filter(bet => 
          competitionGames.some(game => game.id === bet.gameId)
        );
        forgottenBets += competitionGames.length - userBetsInCompetition.length;
      }

      // Calculate streaks (simplified for now - all 0 as per current logic)
      const longestStreak = 0;
      const exactScoreStreak = 0;

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

      console.log(`   🌍 ${user.name}: ${totalPoints} total points, ${exactScores} exact scores, ${accuracy.toFixed(1)}% accuracy`);
    }

    // 5. Display final competition rankings
    console.log('\n🏆 Final Competition Rankings:');
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
      },
      orderBy: {
        shooters: 'desc' // Order by shooters for display
      }
    });

    competitionUsers.forEach((compUser, index) => {
      const totalPoints = compUser.user.bets.reduce((sum, bet) => sum + bet.points, 0);
      const exactScores = compUser.user.bets.filter(bet => bet.points === 3).length;
      const correctResults = compUser.user.bets.filter(bet => bet.points > 0).length;
      const totalBets = compUser.user.bets.length;
      const accuracy = totalBets > 0 ? (correctResults / totalBets) * 100 : 0;

      console.log(`   ${index + 1}. ${compUser.user.name}: ${totalPoints} points, ${exactScores} exact, ${correctResults} correct, ${compUser.shooters} shooters, ${accuracy.toFixed(1)}% accuracy`);
    });

    console.log('\n✅ Test statistics updated successfully!');

  } catch (error) {
    console.error('❌ Error during statistics update:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateTestStatistics();
