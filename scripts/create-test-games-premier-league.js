const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestGames() {
  try {
    console.log('⚽ Creating Premier League test games...');

    // Team names to find or create
    const teamsToCreate = [
      { name: 'Brentford', shortName: 'BRE' },
      { name: 'Tottenham', shortName: 'TOT' },
      { name: 'Sunderland', shortName: 'SUN' },
      { name: 'Manchester City', shortName: 'MCI' }
    ];

    // Find or create teams
    const teams = {};
    for (const teamData of teamsToCreate) {
      let team = await prisma.team.findFirst({
        where: {
          OR: [
            { name: { contains: teamData.name, mode: 'insensitive' } },
            { shortName: { contains: teamData.shortName, mode: 'insensitive' } }
          ]
        }
      });

      if (!team) {
        // Try exact match first
        team = await prisma.team.findFirst({
          where: {
            name: teamData.name
          }
        });
      }

      if (!team) {
        // Create team if not found
        team = await prisma.team.create({
          data: {
            name: teamData.name,
            shortName: teamData.shortName,
            category: 'CLUB'
          }
        });
        console.log(`✅ Created team: ${teamData.name}`);
      } else {
        console.log(`ℹ️  Team already exists: ${team.name}`);
      }

      teams[teamData.name] = team;
    }

    // Find or create Premier League competition
    let competition = await prisma.competition.findFirst({
      where: {
        OR: [
          { name: { contains: 'Premier League', mode: 'insensitive' } },
          { name: { contains: 'Premier', mode: 'insensitive' } }
        ]
      }
    });

    if (!competition) {
      // Create Premier League competition
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear() + 1, 4, 31); // End of May next year

      competition = await prisma.competition.create({
        data: {
          name: 'Premier League',
          description: 'English Premier League',
          startDate: startDate,
          endDate: endDate,
          status: 'ACTIVE'
        }
      });
      console.log(`✅ Created competition: ${competition.name}`);
    } else {
      console.log(`ℹ️  Competition already exists: ${competition.name}`);
    }

    // Create games for today at 21:00 (9 PM) - adjust timezone as needed
    const today = new Date();
    const gameDate1 = new Date(today);
    gameDate1.setHours(21, 0, 0, 0); // 21:00 today

    const gameDate2 = new Date(today);
    gameDate2.setHours(21, 0, 0, 0); // 21:00 today (same time)

    // Game 1: Brentford vs Tottenham
    const game1 = await prisma.game.create({
      data: {
        competitionId: competition.id,
        homeTeamId: teams['Brentford'].id,
        awayTeamId: teams['Tottenham'].id,
        date: gameDate1,
        status: 'UPCOMING'
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`✅ Created game 1: ${game1.homeTeam.name} vs ${game1.awayTeam.name}`);
    console.log(`   Date: ${game1.date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    console.log(`   Status: ${game1.status}`);

    // Game 2: Sunderland vs Manchester City
    const game2 = await prisma.game.create({
      data: {
        competitionId: competition.id,
        homeTeamId: teams['Sunderland'].id,
        awayTeamId: teams['Manchester City'].id,
        date: gameDate2,
        status: 'UPCOMING'
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`✅ Created game 2: ${game2.homeTeam.name} vs ${game2.awayTeam.name}`);
    console.log(`   Date: ${game2.date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    console.log(`   Status: ${game2.status}`);

    console.log('\n✅ All test games created successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Competition: ${competition.name}`);
    console.log(`   - Games created: 2`);
    console.log(`   - Date: ${gameDate1.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} at 21:00`);

  } catch (error) {
    console.error('❌ Error creating test games:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestGames();

