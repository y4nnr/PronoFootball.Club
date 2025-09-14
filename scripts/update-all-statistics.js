const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAllStatistics() {
  try {
    console.log('🔄 Starting comprehensive statistics update...');

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

    // 2. Get all users
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

    // 3. Update statistics for each user
    for (const user of users) {
      console.log(`\n📊 Updating stats for ${user.name}...`);

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
      const exactScores = user.bets.filter(bet => 
        bet.points === 3 && 
        bet.game.competition.name.includes('UEFA Champions League 25/26')
      ).length;

      // Calculate correct results (1+ points) - only from finished games
      const correctResults = finishedGameBets.filter(bet => bet.points > 0).length;

      // Calculate shooters (goals scored in correct predictions)
      let shooters = 0;
      finishedGameBets.forEach(bet => {
        if (bet.points > 0) { // Correct prediction
          // Add goals from the predicted score
          shooters += bet.score1 + bet.score2;
        }
      });

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
        const userBetsInCompetition = user.bets.filter(bet => 
          competitionGames.some(game => game.id === bet.gameId)
        );
        forgottenBets += competitionGames.length - userBetsInCompetition.length;
      }

      // Calculate streaks (simplified for now - all 0 as per current logic)
      const longestStreak = 0;
      const exactScoreStreak = 0;

      // Update or create UserStats
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

      // Update CompetitionUser with shooters
      for (const userComp of userCompetitions) {
        await prisma.competitionUser.update({
          where: { id: userComp.id },
          data: { shooters: shooters }
        });
      }

      console.log(`   ✅ ${user.name}: ${totalPoints} points, ${exactScores} exact, ${correctResults} correct, ${shooters} shooters, ${accuracy.toFixed(1)}% accuracy`);
    }

    // 4. Update competition statistics
    console.log('\n🏆 Updating competition statistics...');
    
    // Get all finished games in this competition
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId: competition.id,
        status: 'FINISHED'
      },
      include: {
        bets: true
      }
    });

    // Calculate competition stats
    const totalGames = finishedGames.length;
    const totalBets = finishedGames.reduce((sum, game) => sum + game.bets.length, 0);
    const totalPoints = finishedGames.reduce((sum, game) => 
      sum + game.bets.reduce((gameSum, bet) => gameSum + bet.points, 0), 0
    );
    const totalExactScores = finishedGames.reduce((sum, game) => 
      sum + game.bets.filter(bet => bet.points === 3).length, 0
    );

    console.log(`   📊 Competition stats: ${totalGames} games, ${totalBets} bets, ${totalPoints} total points, ${totalExactScores} exact scores`);

    // 5. Update user rankings for the competition
    console.log('\n📈 Updating competition rankings...');
    
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

    // Calculate points for each user in this competition
    const userRankings = competitionUsers.map(compUser => {
      const totalPoints = compUser.user.bets.reduce((sum, bet) => sum + bet.points, 0);
      const exactScores = compUser.user.bets.filter(bet => bet.points === 3).length;
      const correctResults = compUser.user.bets.filter(bet => bet.points > 0).length;
      const totalBets = compUser.user.bets.length;
      const accuracy = totalBets > 0 ? (correctResults / totalBets) * 100 : 0;

      return {
        userId: compUser.user.id,
        name: compUser.user.name,
        totalPoints,
        exactScores,
        correctResults,
        accuracy,
        totalBets
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    console.log('   🏆 Competition Rankings:');
    userRankings.forEach((user, index) => {
      console.log(`      ${index + 1}. ${user.name}: ${user.totalPoints} points (${user.exactScores} exact, ${user.correctResults} correct, ${user.accuracy.toFixed(1)}% accuracy)`);
    });

    console.log('\n✅ All statistics updated successfully!');
    console.log('📊 Summary:');
    console.log(`   - Users processed: ${users.length}`);
    console.log(`   - Competition: ${competition.name}`);
    console.log(`   - Finished games: ${finishedGames.length}`);

  } catch (error) {
    console.error('❌ Error during statistics update:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateAllStatistics();
