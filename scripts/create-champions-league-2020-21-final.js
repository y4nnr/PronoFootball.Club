const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🏆 Creating UEFA Champions League 2020/21...');

    // Final standings
    const standings = [
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

    // First, clean up any existing Champions League 2020/21
    const existing = await prisma.competition.findMany({
      where: { name: 'UEFA Champions League 2020/21' }
    });

    for (const comp of existing) {
      console.log(`Deleting existing competition ${comp.id}...`);
      await prisma.bet.deleteMany({
        where: { game: { competitionId: comp.id } }
      });
      await prisma.game.deleteMany({
        where: { competitionId: comp.id }
      });
      await prisma.competitionUser.deleteMany({
        where: { competitionId: comp.id }
      });
      await prisma.competition.delete({
        where: { id: comp.id }
      });
    }

    // Get users
    const users = await prisma.user.findMany({
      where: { name: { in: standings.map(s => s.name) } }
    });
    console.log(`Found ${users.length} users`);

    // Create competition
    const competition = await prisma.competition.create({
      data: {
        name: 'UEFA Champions League 2020/21',
        description: 'UEFA Champions League 2020/21 season - 125 games played',
        startDate: new Date('2020-09-20'),
        endDate: new Date('2021-05-29'),
        status: 'FINISHED'
      }
    });
    console.log(`Created competition: ${competition.id}`);

    // Add users to competition
    for (const user of users) {
      await prisma.competitionUser.create({
        data: {
          competitionId: competition.id,
          userId: user.id
        }
      });
    }
    console.log('Added users to competition');

    // Get teams
    const teams = await prisma.team.findMany({ take: 32 });

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
          date: new Date(2020, 8, 20 + Math.floor(i / 5)),
          status: 'FINISHED',
          homeScore: Math.floor(Math.random() * 4),
          awayScore: Math.floor(Math.random() * 4)
        }
      });
      games.push(game);
    }
    console.log(`Created ${games.length} games`);

    // Create bets for exact points
    for (const standing of standings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) continue;

      console.log(`Creating bets for ${user.name} (target: ${standing.points} points)...`);

      const targetPoints = standing.points;
      const betsData = [];

      // Calculate how many 3-point, 1-point, and 0-point bets we need
      const maxPossible = 125 * 3; // 375 max points
      const threePointBets = Math.floor(targetPoints / 3);
      const remainder = targetPoints % 3;
      const onePointBets = remainder;
      const zeroPointBets = 125 - threePointBets - onePointBets;

      console.log(`  ${threePointBets} bets with 3 points, ${onePointBets} bets with 1 point, ${zeroPointBets} bets with 0 points`);

      // Create bet data
      let betIndex = 0;
      
      // Add 3-point bets
      for (let i = 0; i < threePointBets; i++) {
        betsData.push({
          userId: user.id,
          gameId: games[betIndex].id,
          homeScore: games[betIndex].homeScore,
          awayScore: games[betIndex].awayScore,
          points: 3,
          exactScore: 0
        });
        betIndex++;
      }

      // Add 1-point bets
      for (let i = 0; i < onePointBets; i++) {
        betsData.push({
          userId: user.id,
          gameId: games[betIndex].id,
          homeScore: games[betIndex].homeScore,
          awayScore: games[betIndex].awayScore,
          points: 1,
          exactScore: 0
        });
        betIndex++;
      }

      // Add 0-point bets
      for (let i = 0; i < zeroPointBets; i++) {
        betsData.push({
          userId: user.id,
          gameId: games[betIndex].id,
          homeScore: games[betIndex].homeScore,
          awayScore: games[betIndex].awayScore,
          points: 0,
          exactScore: 0
        });
        betIndex++;
      }

      // Create all bets
      await prisma.bet.createMany({
        data: betsData
      });

      const actualTotal = betsData.reduce((sum, bet) => sum + bet.points, 0);
      console.log(`  ✅ Created ${betsData.length} bets, total: ${actualTotal} points`);
    }

    console.log('\n🎉 Champions League 2020/21 created successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 