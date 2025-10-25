const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createNewLiveGame() {
  try {
    console.log('🧪 Creating new LIVE game for testing...');
    
    // Get two different teams
    const teams = await prisma.team.findMany({ take: 4 });
    if (teams.length < 4) {
      console.log('❌ Need at least 4 teams to create a test game');
      return;
    }

    // Get the first competition
    const competition = await prisma.competition.findFirst();
    if (!competition) {
      console.log('❌ No competitions found');
      return;
    }

    // Create a new LIVE game
    const newLiveGame = await prisma.game.create({
      data: {
        homeTeamId: teams[2].id,
        awayTeamId: teams[3].id,
        competitionId: competition.id,
        date: new Date(), // Now
        status: 'LIVE',
        homeScore: null,
        awayScore: null,
        liveHomeScore: 0,
        liveAwayScore: 0,
        matchday: 1
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    console.log(`✅ Created new LIVE game: ${newLiveGame.homeTeam.name} vs ${newLiveGame.awayTeam.name}`);
    console.log(`   Game ID: ${newLiveGame.id}`);
    console.log(`   Status: ${newLiveGame.status}`);
    console.log(`   Live scores: ${newLiveGame.liveHomeScore} - ${newLiveGame.liveAwayScore}`);
    console.log(`   Date: ${newLiveGame.date.toISOString()}`);

    // Now let's test the live sync API
    console.log('\n🔄 Testing live sync API...');
    
    const response = await fetch('http://localhost:3000/api/trigger-live-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('📊 Live sync API response:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createNewLiveGame();
