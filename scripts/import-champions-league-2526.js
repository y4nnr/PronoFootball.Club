const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Load the JSON data
const dataPath = path.join(__dirname, '..', 'Competitions_Data_import', 'ucl_2025_26_league_phase.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

async function importChampionsLeague() {
  try {
    console.log('🏆 Starting Champions League 2025/26 import...');

    // 1. Create the competition
    console.log('📅 Creating competition...');
    const competition = await prisma.competition.create({
      data: {
        name: `${data.competition} ${data.season}`,
        description: `${data.competition} ${data.season} - Compétition complète avec phase de groupes et phases finales`,
        startDate: new Date('2025-09-16'),
        endDate: new Date('2026-01-28'),
        status: 'UPCOMING',
        logo: 'https://img.uefa.com/imgml/uefaorg/new/uefa-org-logo.png'
      }
    });
    console.log(`✅ Competition created: ${competition.name} (ID: ${competition.id})`);

    // 2. Create or find teams
    console.log('⚽ Processing teams...');
    const teamMap = new Map();
    
    for (const teamName of data.teams) {
      // Check if team already exists
      let team = await prisma.team.findUnique({
        where: { name: teamName }
      });

      if (!team) {
        // Create new team
        team = await prisma.team.create({
          data: {
            name: teamName,
            shortName: getShortName(teamName),
            logo: getTeamLogo(teamName),
            category: 'CLUB'
          }
        });
        console.log(`✅ Created team: ${teamName}`);
      } else {
        console.log(`ℹ️  Team already exists: ${teamName}`);
      }
      
      teamMap.set(teamName, team.id);
    }

    // 3. Create games
    console.log('🎮 Creating games...');
    let gameCount = 0;
    
    for (const fixture of data.fixtures) {
      const matchDate = new Date(fixture.date);
      
      for (const match of fixture.matches) {
        // Parse time and create full datetime
        const [hours, minutes] = match.time.split(':');
        const gameDateTime = new Date(matchDate);
        gameDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const homeTeamId = teamMap.get(match.home);
        const awayTeamId = teamMap.get(match.away);
        
        if (!homeTeamId || !awayTeamId) {
          console.error(`❌ Missing team data for ${match.home} vs ${match.away}`);
          continue;
        }

        // Check if game already exists
        const existingGame = await prisma.game.findFirst({
          where: {
            competitionId: competition.id,
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId,
            date: gameDateTime
          }
        });

        if (existingGame) {
          console.log(`ℹ️  Game already exists: ${match.home} vs ${match.away}`);
          continue;
        }

        await prisma.game.create({
          data: {
            competitionId: competition.id,
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId,
            date: gameDateTime,
            status: 'UPCOMING'
          }
        });
        
        gameCount++;
        console.log(`✅ Created game: ${match.home} vs ${match.away} (${fixture.date} ${match.time})`);
      }
    }

    console.log(`🎉 Import completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Competition: ${competition.name}`);
    console.log(`   - Teams: ${data.teams.length}`);
    console.log(`   - Games: ${gameCount}`);

  } catch (error) {
    console.error('❌ Error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to generate short names
function getShortName(teamName) {
  const shortNames = {
    'Arsenal': 'ARS',
    'Atalanta': 'ATA',
    'Athletic Club': 'ATH',
    'Atlético de Madrid': 'ATM',
    'Barcelona': 'BAR',
    'Bayer Leverkusen': 'LEV',
    'Bayern München': 'BAY',
    'Benfica': 'BEN',
    'Bodø/Glimt': 'BOD',
    'Borussia Dortmund': 'BVB',
    'Chelsea': 'CHE',
    'Club Brugge': 'BRU',
    'Copenhagen': 'COP',
    'Eintracht Frankfurt': 'FRA',
    'Galatasaray': 'GAL',
    'Inter': 'INT',
    'Juventus': 'JUV',
    'Kairat Almaty': 'KAI',
    'Liverpool': 'LIV',
    'Manchester City': 'MCI',
    'Marseille': 'MAR',
    'Monaco': 'MON',
    'Napoli': 'NAP',
    'Newcastle United': 'NEW',
    'Olympiacos': 'OLY',
    'PSV Eindhoven': 'PSV',
    'Pafos': 'PAF',
    'Paris Saint-Germain': 'PSG',
    'Qarabağ': 'QAR',
    'Real Madrid': 'RMA',
    'Slavia Praha': 'SLA',
    'Sporting CP': 'SPO',
    'Tottenham': 'TOT',
    'Union Saint-Gilloise': 'USG',
    'Villarreal': 'VIL',
    'Ajax': 'AJX'
  };
  
  return shortNames[teamName] || teamName.substring(0, 3).toUpperCase();
}

// Helper function to get team logos
function getTeamLogo(teamName) {
  const logos = {
    'Arsenal': 'https://logos-world.net/wp-content/uploads/2020/06/Arsenal-Logo.png',
    'Atalanta': 'https://logos-world.net/wp-content/uploads/2020/06/Atalanta-Logo.png',
    'Athletic Club': 'https://logos-world.net/wp-content/uploads/2020/06/Athletic-Bilbao-Logo.png',
    'Atlético de Madrid': 'https://logos-world.net/wp-content/uploads/2020/06/Atletico-Madrid-Logo.png',
    'Barcelona': 'https://logos-world.net/wp-content/uploads/2020/06/Barcelona-Logo.png',
    'Bayer Leverkusen': 'https://logos-world.net/wp-content/uploads/2020/06/Bayer-Leverkusen-Logo.png',
    'Bayern München': 'https://logos-world.net/wp-content/uploads/2020/06/Bayern-Munich-Logo.png',
    'Benfica': 'https://logos-world.net/wp-content/uploads/2020/06/Benfica-Logo.png',
    'Bodø/Glimt': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/FK_Bod%C3%B8%2FGlimt_logo.svg/1200px-FK_Bod%C3%B8%2FGlimt_logo.svg.png',
    'Borussia Dortmund': 'https://logos-world.net/wp-content/uploads/2020/06/Borussia-Dortmund-Logo.png',
    'Chelsea': 'https://logos-world.net/wp-content/uploads/2020/06/Chelsea-Logo.png',
    'Club Brugge': 'https://logos-world.net/wp-content/uploads/2020/06/Club-Brugge-Logo.png',
    'Copenhagen': 'https://logos-world.net/wp-content/uploads/2020/06/FC-Copenhagen-Logo.png',
    'Eintracht Frankfurt': 'https://logos-world.net/wp-content/uploads/2020/06/Eintracht-Frankfurt-Logo.png',
    'Galatasaray': 'https://logos-world.net/wp-content/uploads/2020/06/Galatasaray-Logo.png',
    'Inter': 'https://logos-world.net/wp-content/uploads/2020/06/Inter-Milan-Logo.png',
    'Juventus': 'https://logos-world.net/wp-content/uploads/2020/06/Juventus-Logo.png',
    'Kairat Almaty': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/FC_Kairat_logo.svg/1200px-FC_Kairat_logo.svg.png',
    'Liverpool': 'https://logos-world.net/wp-content/uploads/2020/06/Liverpool-Logo.png',
    'Manchester City': 'https://logos-world.net/wp-content/uploads/2020/06/Manchester-City-Logo.png',
    'Marseille': 'https://logos-world.net/wp-content/uploads/2020/06/Olympique-Marseille-Logo.png',
    'Monaco': 'https://logos-world.net/wp-content/uploads/2020/06/AS-Monaco-Logo.png',
    'Napoli': 'https://logos-world.net/wp-content/uploads/2020/06/Napoli-Logo.png',
    'Newcastle United': 'https://logos-world.net/wp-content/uploads/2020/06/Newcastle-United-Logo.png',
    'Olympiacos': 'https://logos-world.net/wp-content/uploads/2020/06/Olympiacos-Logo.png',
    'PSV Eindhoven': 'https://logos-world.net/wp-content/uploads/2020/06/PSV-Eindhoven-Logo.png',
    'Pafos': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/Pafos_FC_logo.svg/1200px-Pafos_FC_logo.svg.png',
    'Paris Saint-Germain': 'https://logos-world.net/wp-content/uploads/2020/06/Paris-Saint-Germain-Logo.png',
    'Qarabağ': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/Qaraba%C4%9F_FK_logo.svg/1200px-Qaraba%C4%9F_FK_logo.svg.png',
    'Real Madrid': 'https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png',
    'Slavia Praha': 'https://logos-world.net/wp-content/uploads/2020/06/Slavia-Prague-Logo.png',
    'Sporting CP': 'https://logos-world.net/wp-content/uploads/2020/06/Sporting-CP-Logo.png',
    'Tottenham': 'https://logos-world.net/wp-content/uploads/2020/06/Tottenham-Logo.png',
    'Union Saint-Gilloise': 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/Union_Saint-Gilloise_logo.svg/1200px-Union_Saint-Gilloise_logo.svg.png',
    'Villarreal': 'https://logos-world.net/wp-content/uploads/2020/06/Villarreal-Logo.png',
    'Ajax': 'https://logos-world.net/wp-content/uploads/2020/06/Ajax-Logo.png'
  };
  
  return logos[teamName] || null;
}

// Run the import
if (require.main === module) {
  importChampionsLeague()
    .then(() => {
      console.log('✅ Import script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import script failed:', error);
      process.exit(1);
    });
}

module.exports = { importChampionsLeague };
