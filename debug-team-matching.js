const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to normalize team names for better matching
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(fc|cf|ac|sc|united|city|town|rovers|wanderers|athletic|sporting)\b/g, '') // Remove common suffixes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

async function debugTeamMatching() {
  try {
    console.log('🔍 Debugging team name matching...');
    
    // Get our test games
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { status: 'LIVE' },
          { status: 'UPCOMING' }
        ]
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    console.log('📊 Our test games:');
    games.forEach((game, index) => {
      console.log(`${index + 1}. ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Normalized: ${normalizeTeamName(game.homeTeam.name)} vs ${normalizeTeamName(game.awayTeam.name)}`);
      console.log('');
    });

    // Mock external API data
    const mockMatches = [
      {
        id: 12345,
        homeTeam: { name: 'Real Madrid' },
        awayTeam: { name: 'Barcelona' }
      },
      {
        id: 12346,
        homeTeam: { name: 'Manchester City' },
        awayTeam: { name: 'Bayern Munich' }
      },
      {
        id: 12347,
        homeTeam: { name: 'Paris Saint-Germain' },
        awayTeam: { name: 'Liverpool' }
      }
    ];

    console.log('📊 Mock external matches:');
    mockMatches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      console.log(`   Normalized: ${normalizeTeamName(match.homeTeam.name)} vs ${normalizeTeamName(match.awayTeam.name)}`);
      console.log('');
    });

    // Test matching
    console.log('🔍 Testing matches:');
    games.forEach(game => {
      const normalizedHomeTeam = normalizeTeamName(game.homeTeam.name);
      const normalizedAwayTeam = normalizeTeamName(game.awayTeam.name);
      
      const match = mockMatches.find(m => {
        const normalizedExternalHome = normalizeTeamName(m.homeTeam.name);
        const normalizedExternalAway = normalizeTeamName(m.awayTeam.name);
        
        const directMatch = normalizedHomeTeam === normalizedExternalHome && normalizedAwayTeam === normalizedExternalAway;
        const swappedMatch = normalizedHomeTeam === normalizedExternalAway && normalizedAwayTeam === normalizedExternalHome;
        
        return directMatch || swappedMatch;
      });
      
      if (match) {
        console.log(`✅ MATCH: ${game.homeTeam.name} vs ${game.awayTeam.name} → ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      } else {
        console.log(`❌ NO MATCH: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTeamMatching();
