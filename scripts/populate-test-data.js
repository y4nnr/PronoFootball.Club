const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function populateTestData() {
  try {
    console.log('🎯 Starting test data population...');

    // 1. Get 4 non-admin users
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      take: 4,
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (users.length < 4) {
      console.error('❌ Need at least 4 non-admin users. Found:', users.length);
      return;
    }

    console.log(`✅ Found ${users.length} users:`, users.map(u => u.name));

    // 2. Get the Champions League 25/26 competition
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 25/26'
        }
      }
    });

    if (!competition) {
      console.error('❌ Champions League 25/26 competition not found');
      return;
    }

    console.log(`✅ Found competition: ${competition.name}`);

    // 3. Get the next 6 upcoming games
    const upcomingGames = await prisma.game.findMany({
      where: {
        competitionId: competition.id,
        status: 'UPCOMING'
      },
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: {
        date: 'asc'
      },
      take: 6
    });

    if (upcomingGames.length < 6) {
      console.error(`❌ Need at least 6 upcoming games. Found: ${upcomingGames.length}`);
      return;
    }

    console.log(`✅ Found ${upcomingGames.length} upcoming games:`);
    upcomingGames.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} (${game.date.toISOString().split('T')[0]})`);
    });

    // 4. Ensure all users are in the competition
    for (const user of users) {
      await prisma.competitionUser.upsert({
        where: {
          competitionId_userId: {
            competitionId: competition.id,
            userId: user.id
          }
        },
        update: {},
        create: {
          competitionId: competition.id,
          userId: user.id
        }
      });
    }

    console.log('✅ Users added to competition');

    // 5. Create realistic betting data for each game
    const gameResults = [
      { homeScore: 2, awayScore: 1 }, // Game 1: Home win
      { homeScore: 1, awayScore: 1 }, // Game 2: Draw
      { homeScore: 0, awayScore: 3 }, // Game 3: Away win
      { homeScore: 3, awayScore: 0 }, // Game 4: Home win
      { homeScore: 2, awayScore: 2 }, // Game 5: Draw
      { homeScore: 1, awayScore: 0 }  // Game 6: Home win
    ];

    // 6. Create bets for each user and game
    for (let gameIndex = 0; gameIndex < upcomingGames.length; gameIndex++) {
      const game = upcomingGames[gameIndex];
      const actualResult = gameResults[gameIndex];
      
      console.log(`\n🎮 Processing Game ${gameIndex + 1}: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Actual result: ${actualResult.homeScore}-${actualResult.awayScore}`);

      for (let userIndex = 0; userIndex < users.length; userIndex++) {
        const user = users[userIndex];
        
        // Create different betting patterns for each user
        let predictedScore;
        let points = 0;

        switch (userIndex) {
          case 0: // User 1: Conservative bettor (often gets result right, rarely exact)
            predictedScore = getConservativePrediction(actualResult);
            break;
          case 1: // User 2: Aggressive bettor (tries for exact scores)
            predictedScore = getAggressivePrediction(actualResult);
            break;
          case 2: // User 3: Random bettor (mixed results)
            predictedScore = getRandomPrediction();
            break;
          case 3: // User 4: Expert bettor (good at exact scores)
            predictedScore = getExpertPrediction(actualResult);
            break;
        }

        // Calculate points based on prediction vs actual result
        if (predictedScore.homeScore === actualResult.homeScore && predictedScore.awayScore === actualResult.awayScore) {
          points = 3; // Exact score
        } else {
          const actualResultType = actualResult.homeScore > actualResult.awayScore ? 'home' : 
                                 actualResult.homeScore < actualResult.awayScore ? 'away' : 'draw';
          const predictedResultType = predictedScore.homeScore > predictedScore.awayScore ? 'home' : 
                                    predictedScore.homeScore < predictedScore.awayScore ? 'away' : 'draw';
          
          if (actualResultType === predictedResultType) {
            points = 1; // Correct result
          } else {
            points = 0; // Wrong result
          }
        }

        // Create the bet
        await prisma.bet.create({
          data: {
            userId: user.id,
            gameId: game.id,
            score1: predictedScore.homeScore,
            score2: predictedScore.awayScore,
            points: points
          }
        });

        console.log(`   ${user.name}: ${predictedScore.homeScore}-${predictedScore.awayScore} (${points} points)`);
      }

      // Update the game with actual results and mark as finished
      await prisma.game.update({
        where: { id: game.id },
        data: {
          homeScore: actualResult.homeScore,
          awayScore: actualResult.awayScore,
          status: 'FINISHED'
        }
      });

      console.log(`   ✅ Game marked as finished with result: ${actualResult.homeScore}-${actualResult.awayScore}`);
    }

    // 7. Calculate and display final rankings
    console.log('\n🏆 Final Rankings:');
    const finalRankings = await calculateRankings(competition.id, users);
    
    finalRankings.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name}: ${user.totalPoints} points (${user.exactScores} exact scores, ${user.accuracy.toFixed(1)}% accuracy)`);
    });

    console.log('\n✅ Test data population completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Games: ${upcomingGames.length}`);
    console.log(`   - Total bets: ${users.length * upcomingGames.length}`);

  } catch (error) {
    console.error('❌ Error during test data population:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Helper functions for different betting strategies
function getConservativePrediction(actualResult) {
  // Conservative: often gets result right, rarely exact
  const resultType = actualResult.homeScore > actualResult.awayScore ? 'home' : 
                    actualResult.homeScore < actualResult.awayScore ? 'away' : 'draw';
  
  switch (resultType) {
    case 'home':
      return { homeScore: 2, awayScore: 1 };
    case 'away':
      return { homeScore: 1, awayScore: 2 };
    case 'draw':
      return { homeScore: 1, awayScore: 1 };
  }
}

function getAggressivePrediction(actualResult) {
  // Aggressive: tries for exact scores, sometimes gets them
  const random = Math.random();
  if (random < 0.3) {
    // 30% chance of exact score
    return { homeScore: actualResult.homeScore, awayScore: actualResult.awayScore };
  } else {
    // Otherwise random prediction
    return getRandomPrediction();
  }
}

function getRandomPrediction() {
  // Random: completely random predictions
  return {
    homeScore: Math.floor(Math.random() * 4),
    awayScore: Math.floor(Math.random() * 4)
  };
}

function getExpertPrediction(actualResult) {
  // Expert: good at exact scores, very accurate
  const random = Math.random();
  if (random < 0.6) {
    // 60% chance of exact score
    return { homeScore: actualResult.homeScore, awayScore: actualResult.awayScore };
  } else if (random < 0.9) {
    // 30% chance of correct result
    const resultType = actualResult.homeScore > actualResult.awayScore ? 'home' : 
                      actualResult.homeScore < actualResult.awayScore ? 'away' : 'draw';
    switch (resultType) {
      case 'home':
        return { homeScore: 2, awayScore: 1 };
      case 'away':
        return { homeScore: 1, awayScore: 2 };
      case 'draw':
        return { homeScore: 1, awayScore: 1 };
    }
  } else {
    // 10% chance of wrong result
    return getRandomPrediction();
  }
}

async function calculateRankings(competitionId, users) {
  const rankings = [];
  
  for (const user of users) {
    const bets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        game: {
          competitionId: competitionId,
          status: 'FINISHED'
        }
      }
    });

    const totalPoints = bets.reduce((sum, bet) => sum + bet.points, 0);
    const exactScores = bets.filter(bet => bet.points === 3).length;
    const correctResults = bets.filter(bet => bet.points > 0).length;
    const accuracy = bets.length > 0 ? (correctResults / bets.length) * 100 : 0;

    rankings.push({
      name: user.name,
      totalPoints,
      exactScores,
      accuracy
    });
  }

  return rankings.sort((a, b) => b.totalPoints - a.totalPoints);
}

// Run the script
populateTestData();
