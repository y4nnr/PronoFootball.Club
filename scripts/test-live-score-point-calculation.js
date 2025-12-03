const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to update shooters (copied from update-live-scores.ts)
async function updateShootersForCompetition(competitionId) {
  try {
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: true }
    });

    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] }
      }
    });

    const totalGames = finishedGames.length;

    for (const competitionUser of competitionUsers) {
      const userBets = await prisma.bet.count({
        where: {
          userId: competitionUser.userId,
          game: {
            competitionId,
            status: { in: ['FINISHED', 'LIVE'] }
          }
        }
      });

      const shooters = totalGames - userBets;

      await prisma.competitionUser.update({
        where: { id: competitionUser.id },
        data: { shooters }
      });
    }
  } catch (error) {
    console.error('Error updating shooters for competition:', error);
  }
}

async function testPointCalculation() {
  try {
    console.log('🧪 Testing Live Score Point Calculation\n');

    // 1. Get or create a test competition
    let competition = await prisma.competition.findFirst({
      where: {
        name: { contains: 'Champions League 25/26' }
      }
    });

    if (!competition) {
      console.log('⚠️  Champions League 25/26 not found, using first competition');
      competition = await prisma.competition.findFirst();
      if (!competition) {
        console.error('❌ No competitions found');
        return;
      }
    }

    console.log(`✅ Using competition: ${competition.name}`);

    // 2. Get test users
    const users = await prisma.user.findMany({
      where: { role: { not: 'ADMIN' } },
      take: 4
    });

    if (users.length < 2) {
      console.error('❌ Need at least 2 users for testing');
      return;
    }

    console.log(`✅ Found ${users.length} test users`);

    // 3. Ensure users are in competition
    for (const user of users) {
      const existing = await prisma.competitionUser.findFirst({
        where: {
          competitionId: competition.id,
          userId: user.id
        }
      });

      if (!existing) {
        await prisma.competitionUser.create({
          data: {
            competitionId: competition.id,
            userId: user.id
          }
        });
      }
    }

    // 4. Get two teams
    const teams = await prisma.team.findMany({ take: 2 });
    if (teams.length < 2) {
      console.error('❌ Need at least 2 teams');
      return;
    }

    console.log(`✅ Using teams: ${teams[0].name} vs ${teams[1].name}\n`);

    // 5. Create a LIVE game
    const testGame = await prisma.game.create({
      data: {
        competitionId: competition.id,
        homeTeamId: teams[0].id,
        awayTeamId: teams[1].id,
        date: new Date(),
        status: 'LIVE',
        homeScore: null,
        awayScore: null,
        liveHomeScore: 0,
        liveAwayScore: 0
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`✅ Created test game: ${testGame.homeTeam.name} vs ${testGame.awayTeam.name}`);
    console.log(`   Game ID: ${testGame.id}`);
    console.log(`   Status: ${testGame.status}\n`);

    // 6. Create test bets with different predictions
    const testBets = [
      { user: users[0], score1: 2, score2: 1, description: 'Exact score match (should get 3 points)' },
      { user: users[1], score1: 1, score2: 0, description: 'Correct result (home win) but wrong score (should get 1 point)' },
      { user: users[2], score1: 0, score2: 2, description: 'Wrong result (away win predicted, home win actual) (should get 0 points)' },
      { user: users[3], score1: 1, score2: 1, description: 'Wrong result (draw predicted, home win actual) (should get 0 points)' }
    ];

    // Final score will be 2-1 (home win)
    const finalHomeScore = 2;
    const finalAwayScore = 1;

    console.log('📝 Creating test bets:');
    for (const betData of testBets) {
      const bet = await prisma.bet.create({
        data: {
          userId: betData.user.id,
          gameId: testGame.id,
          score1: betData.score1,
          score2: betData.score2,
          points: 0 // Start with 0 points
        }
      });
      console.log(`   ${betData.user.name}: ${betData.score1}-${betData.score2} - ${betData.description}`);
    }

    console.log(`\n🏁 Simulating game finish with final score: ${finalHomeScore}-${finalAwayScore}\n`);

    // 7. Update game to FINISHED (simulating what update-live-scores.ts does)
    const updatedGame = await prisma.game.update({
      where: { id: testGame.id },
      data: {
        status: 'FINISHED',
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        liveHomeScore: finalHomeScore,
        liveAwayScore: finalAwayScore,
        decidedBy: 'FT',
        finishedAt: new Date()
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`✅ Game updated to FINISHED\n`);

    // 8. Calculate points (same logic as update-live-scores.ts)
    if (updatedGame.status === 'FINISHED' && finalHomeScore !== null && finalHomeScore !== undefined && finalAwayScore !== null && finalAwayScore !== undefined) {
      const bets = await prisma.bet.findMany({ where: { gameId: testGame.id } });
      
      console.log('💰 Calculating points for bets:');
      
      for (const bet of bets) {
        let points = 0;
        if (bet.score1 === finalHomeScore && bet.score2 === finalAwayScore) {
          points = 3;
        } else {
          const actualResult = finalHomeScore > finalAwayScore ? 'home' : finalHomeScore < finalAwayScore ? 'away' : 'draw';
          const predictedResult = bet.score1 > bet.score2 ? 'home' : bet.score1 < bet.score2 ? 'away' : 'draw';
          if (actualResult === predictedResult) {
            points = 1;
          }
        }
        
        await prisma.bet.update({ where: { id: bet.id }, data: { points } });
        
        const user = users.find(u => u.id === bet.userId);
        console.log(`   ${user?.name || 'Unknown'}: ${bet.score1}-${bet.score2} → ${points} points`);
      }
      
      // Update shooters
      await updateShootersForCompetition(updatedGame.competitionId);
      
      console.log(`\n✅ Calculated points for ${bets.length} bets`);
    }

    // 9. Verify results
    console.log('\n📊 Verification:');
    const finalBets = await prisma.bet.findMany({
      where: { gameId: testGame.id },
      include: { user: true }
    });

    let allCorrect = true;
    const expectedPoints = [3, 1, 0, 0]; // Expected points for each bet

    for (let i = 0; i < finalBets.length; i++) {
      const bet = finalBets[i];
      const expected = expectedPoints[i];
      const actual = bet.points;
      const status = expected === actual ? '✅' : '❌';
      
      console.log(`   ${status} ${bet.user.name}: Expected ${expected} points, Got ${actual} points`);
      
      if (expected !== actual) {
        allCorrect = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allCorrect) {
      console.log('✅ TEST PASSED: All points calculated correctly!');
    } else {
      console.log('❌ TEST FAILED: Some points are incorrect');
    }
    console.log('='.repeat(60));

    // 10. Cleanup (optional - comment out if you want to keep test data)
    console.log('\n🧹 Cleaning up test data...');
    await prisma.bet.deleteMany({ where: { gameId: testGame.id } });
    await prisma.game.delete({ where: { id: testGame.id } });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPointCalculation()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });




