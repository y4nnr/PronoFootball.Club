const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createChampionsLeague202021() {
  try {
    console.log('🏆 Creating UEFA Champions League 2020/21...');

    // Final standings as provided by the user
    const finalStandings = [
      { name: 'Yann', points: 108 },
      { name: 'Benouz', points: 102 },
      { name: 'Keke', points: 101 },
      { name: 'Fifi', points: 97 },
      { name: 'Francky', points: 93 },
      { name: 'Renato', points: 91 },
      { name: 'Nono', points: 83 },
      { name: 'Baptiste', points: 75 },
      { name: 'Steph', points: 60 }
    ];

    // Get all users by name
    const users = await prisma.user.findMany({
      where: {
        name: {
          in: finalStandings.map(s => s.name)
        }
      }
    });

    console.log(`Found ${users.length} users:`, users.map(u => u.name));

    if (users.length !== finalStandings.length) {
      throw new Error(`Expected ${finalStandings.length} users, found ${users.length}`);
    }

    // Create the competition
    const competition = await prisma.competition.create({
      data: {
        name: 'UEFA Champions League 2020/21',
        description: 'UEFA Champions League 2020/21 season - 125 games played',
        startDate: new Date('2020-09-20'),
        endDate: new Date('2021-05-29'),
        status: 'FINISHED'
      }
    });

    console.log('✅ Competition created:', competition.name);

    // Add users to competition
    for (const user of users) {
      await prisma.competitionUser.create({
        data: {
          competitionId: competition.id,
          userId: user.id
        }
      });
    }

    console.log('✅ Users added to competition');

    // Get some teams for the games (we'll use existing teams)
    const teams = await prisma.team.findMany({
      take: 32,
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${teams.length} teams for games`);

    // Create 125 games
    const games = [];
    for (let i = 0; i < 125; i++) {
      const homeTeam = teams[i % teams.length];
      const awayTeam = teams[(i + 1) % teams.length];
      
      const game = await prisma.game.create({
        data: {
          competitionId: competition.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          date: new Date(2020, 8, 20 + Math.floor(i / 5)), // Spread games over time
          status: 'FINISHED',
          homeScore: Math.floor(Math.random() * 4),
          awayScore: Math.floor(Math.random() * 4)
        }
      });
      games.push(game);
    }

    console.log(`✅ Created ${games.length} games`);

    // Create bets for each user to achieve their exact point totals
    for (const standing of finalStandings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) continue;

      console.log(`Creating bets for ${user.name} to achieve ${standing.points} points...`);

      let totalPoints = 0;
      const targetPoints = standing.points;

      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        let points = 0;

        // Calculate how many points we still need
        const remainingGames = games.length - i - 1;
        const pointsNeeded = targetPoints - totalPoints;

        if (remainingGames === 0) {
          // Last game - assign exact points needed
          points = pointsNeeded;
        } else {
          // Distribute points strategically
          const avgPointsNeeded = pointsNeeded / (remainingGames + 1);
          
          if (avgPointsNeeded <= 0) {
            points = 0;
          } else if (avgPointsNeeded >= 3) {
            points = 3;
          } else {
            // Randomly assign 0, 1, or 3 points based on what we need
            const rand = Math.random();
            if (avgPointsNeeded < 0.5) {
              points = 0;
            } else if (avgPointsNeeded < 1.5) {
              points = rand < 0.7 ? 1 : 0;
            } else if (avgPointsNeeded < 2.5) {
              points = rand < 0.4 ? 3 : (rand < 0.8 ? 1 : 0);
            } else {
              points = rand < 0.8 ? 3 : 1;
            }
          }
        }

        // Ensure we don't exceed target
        if (totalPoints + points > targetPoints) {
          points = Math.max(0, targetPoints - totalPoints);
        }

        await prisma.bet.create({
          data: {
            userId: user.id,
            gameId: game.id,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            points: points,
            exactScore: 0 // As requested, all exact scores should be 0
          }
        });

        totalPoints += points;
      }

      console.log(`✅ ${user.name}: Created ${games.length} bets, total points: ${totalPoints}`);

      // Adjust if we're not exactly at target (fine-tuning)
      if (totalPoints !== targetPoints) {
        console.log(`⚠️  Adjusting ${user.name} from ${totalPoints} to ${targetPoints} points...`);
        
        const userBets = await prisma.bet.findMany({
          where: {
            userId: user.id,
            game: { competitionId: competition.id }
          },
          orderBy: { id: 'asc' }
        });

        const difference = targetPoints - totalPoints;
        
        if (difference > 0) {
          // Need to add points
          for (let i = 0; i < userBets.length && difference > 0; i++) {
            const bet = userBets[i];
            if (bet.points < 3) {
              const addPoints = Math.min(3 - bet.points, difference);
              await prisma.bet.update({
                where: { id: bet.id },
                data: { points: bet.points + addPoints }
              });
              difference -= addPoints;
            }
          }
        } else if (difference < 0) {
          // Need to remove points
          for (let i = userBets.length - 1; i >= 0 && Math.abs(difference) > 0; i--) {
            const bet = userBets[i];
            if (bet.points > 0) {
              const removePoints = Math.min(bet.points, Math.abs(difference));
              await prisma.bet.update({
                where: { id: bet.id },
                data: { points: bet.points - removePoints }
              });
              difference += removePoints;
            }
          }
        }
      }
    }

    // Verify final points
    console.log('\n📊 Final verification:');
    for (const standing of finalStandings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) continue;

      const actualPoints = await prisma.bet.aggregate({
        where: {
          userId: user.id,
          game: { competitionId: competition.id }
        },
        _sum: { points: true }
      });

      const actualTotal = actualPoints._sum.points || 0;
      console.log(`${user.name}: Expected ${standing.points}, Got ${actualTotal} ${actualTotal === standing.points ? '✅' : '❌'}`);
    }

    console.log('\n🎉 UEFA Champions League 2020/21 created successfully!');
    console.log(`Competition ID: ${competition.id}`);
    console.log(`Games: ${games.length}`);
    console.log(`Participants: ${users.length}`);

  } catch (error) {
    console.error('❌ Error creating Champions League 2020/21:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createChampionsLeague202021(); 