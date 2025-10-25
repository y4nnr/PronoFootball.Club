const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestGamesWithMock() {
  try {
    console.log('🧪 Creating test games that match mock external API...');
    
    // Get teams that match our mock API
    const teams = await prisma.team.findMany();
    console.log(`📊 Found ${teams.length} teams in database`);

    // Find teams that match our mock data
    const realMadrid = teams.find(t => t.name.toLowerCase().includes('real madrid') || t.name.toLowerCase().includes('madrid'));
    const barcelona = teams.find(t => t.name.toLowerCase().includes('barcelona'));
    const manCity = teams.find(t => t.name.toLowerCase().includes('manchester city') || t.name.toLowerCase().includes('city'));
    const bayern = teams.find(t => t.name.toLowerCase().includes('bayern') || t.name.toLowerCase().includes('munich'));
    const psg = teams.find(t => t.name.toLowerCase().includes('paris') || t.name.toLowerCase().includes('psg'));
    const liverpool = teams.find(t => t.name.toLowerCase().includes('liverpool'));

    // Get the first competition
    const competition = await prisma.competition.findFirst();
    if (!competition) {
      console.log('❌ No competitions found');
      return;
    }

    const testGames = [];

    // Create test game 1: Real Madrid vs Barcelona (LIVE)
    if (realMadrid && barcelona) {
      const game1 = await prisma.game.create({
        data: {
          homeTeamId: realMadrid.id,
          awayTeamId: barcelona.id,
          competitionId: competition.id,
          date: new Date(),
          status: 'LIVE',
          homeScore: null,
          awayScore: null,
          liveHomeScore: 0,
          liveAwayScore: 0,
          matchday: 1
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });
      testGames.push(game1);
      console.log(`✅ Created: ${game1.homeTeam.name} vs ${game1.awayTeam.name} (LIVE)`);
    }

    // Create test game 2: Manchester City vs Bayern Munich (LIVE)
    if (manCity && bayern) {
      const game2 = await prisma.game.create({
        data: {
          homeTeamId: manCity.id,
          awayTeamId: bayern.id,
          competitionId: competition.id,
          date: new Date(),
          status: 'LIVE',
          homeScore: null,
          awayScore: null,
          liveHomeScore: 0,
          liveAwayScore: 0,
          matchday: 1
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });
      testGames.push(game2);
      console.log(`✅ Created: ${game2.homeTeam.name} vs ${game2.awayTeam.name} (LIVE)`);
    }

    // Create test game 3: PSG vs Liverpool (UPCOMING - will be updated to FINISHED)
    if (psg && liverpool) {
      const game3 = await prisma.game.create({
        data: {
          homeTeamId: psg.id,
          awayTeamId: liverpool.id,
          competitionId: competition.id,
          date: new Date(),
          status: 'UPCOMING',
          homeScore: null,
          awayScore: null,
          liveHomeScore: null,
          liveAwayScore: null,
          matchday: 1
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });
      testGames.push(game3);
      console.log(`✅ Created: ${game3.homeTeam.name} vs ${game3.awayTeam.name} (UPCOMING)`);
    }

    // If we couldn't find exact matches, create games with available teams
    if (testGames.length === 0) {
      console.log('⚠️ Could not find exact team matches, creating games with available teams...');
      
      const availableTeams = teams.slice(0, 6);
      for (let i = 0; i < 3; i += 2) {
        if (availableTeams[i] && availableTeams[i + 1]) {
          const game = await prisma.game.create({
            data: {
              homeTeamId: availableTeams[i].id,
              awayTeamId: availableTeams[i + 1].id,
              competitionId: competition.id,
              date: new Date(),
              status: i === 0 ? 'LIVE' : 'UPCOMING',
              homeScore: null,
              awayScore: null,
              liveHomeScore: i === 0 ? 0 : null,
              liveAwayScore: i === 0 ? 0 : null,
              matchday: 1
            },
            include: {
              homeTeam: true,
              awayTeam: true
            }
          });
          testGames.push(game);
          console.log(`✅ Created: ${game.homeTeam.name} vs ${game.awayTeam.name} (${game.status})`);
        }
      }
    }

    console.log(`\n🎯 Created ${testGames.length} test games:`);
    testGames.forEach((game, index) => {
      console.log(`${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Status: ${game.status}`);
      console.log(`   Live Scores: ${game.liveHomeScore || 'N/A'} - ${game.liveAwayScore || 'N/A'}`);
      console.log(`   Game ID: ${game.id}`);
      console.log('');
    });

    console.log('🚀 Ready to test live sync with mock external API!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestGamesWithMock();
