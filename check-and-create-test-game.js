const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAndCreateTestGame() {
  try {
    console.log('🔍 Checking current games...');
    
    // Get all games
    const games = await prisma.game.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      },
      orderBy: {
        date: 'desc'
      },
      take: 10
    });

    console.log(`📊 Found ${games.length} games in database:`);
    games.forEach((game, index) => {
      console.log(`${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name} - ${game.status} (${game.date.toISOString().split('T')[0]})`);
    });

    // Check if we have any LIVE games
    const liveGames = games.filter(g => g.status === 'LIVE');
    console.log(`\n🎮 LIVE games: ${liveGames.length}`);

    // Check if we have any UPCOMING games from today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const upcomingToday = games.filter(g => 
      g.status === 'UPCOMING' && 
      g.date >= startOfDay && 
      g.date < endOfDay
    );
    console.log(`📅 UPCOMING games today: ${upcomingToday.length}`);

    // If no LIVE games, create a test one
    if (liveGames.length === 0) {
      console.log('\n🧪 Creating test LIVE game...');
      
      // Get the first two teams
      const teams = await prisma.team.findMany({ take: 2 });
      if (teams.length < 2) {
        console.log('❌ Need at least 2 teams to create a test game');
        return;
      }

      // Get the first competition
      const competition = await prisma.competition.findFirst();
      if (!competition) {
        console.log('❌ No competitions found');
        return;
      }

      // Create a test game with LIVE status
      const testGame = await prisma.game.create({
        data: {
          homeTeamId: teams[0].id,
          awayTeamId: teams[1].id,
          competitionId: competition.id,
          date: new Date(), // Now
          status: 'LIVE',
          homeScore: 0,
          awayScore: 0,
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

      console.log(`✅ Created test LIVE game: ${testGame.homeTeam.name} vs ${testGame.awayTeam.name}`);
      console.log(`   Game ID: ${testGame.id}`);
      console.log(`   Status: ${testGame.status}`);
      console.log(`   Date: ${testGame.date.toISOString()}`);
    } else {
      console.log('\n✅ Found existing LIVE games, no need to create test game');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateTestGame();
