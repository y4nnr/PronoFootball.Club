/**
 * Script to separate teams with same name but different sports
 * Creates new teams for Rugby if they share name with Football teams
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting duplicate team separation...\n');

  // Find teams that are used in both Football and Rugby competitions
  const allTeams = await prisma.team.findMany({
    include: {
      homeGames: {
        include: {
          competition: {
            select: {
              sportType: true,
            },
          },
        },
      },
      awayGames: {
        include: {
          competition: {
            select: {
              sportType: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${allTeams.length} teams\n`);

  const teamsToSeparate: Array<{
    team: typeof allTeams[0];
    footballGames: number;
    rugbyGames: number;
  }> = [];

  for (const team of allTeams) {
    const allGames = [...team.homeGames, ...team.awayGames];
    const footballGames = allGames.filter(g => g.competition.sportType === 'FOOTBALL');
    const rugbyGames = allGames.filter(g => g.competition.sportType === 'RUGBY');

    // If team plays in both sports, we need to separate them
    if (footballGames.length > 0 && rugbyGames.length > 0) {
      teamsToSeparate.push({
        team,
        footballGames: footballGames.length,
        rugbyGames: rugbyGames.length,
      });
    }
  }

  console.log(`Found ${teamsToSeparate.length} teams playing in both sports:\n`);
  for (const { team, footballGames, rugbyGames } of teamsToSeparate) {
    console.log(`  - ${team.name}: ${footballGames} Football games, ${rugbyGames} Rugby games`);
    console.log(`    Current: sportType=${team.sportType}, category=${team.category}`);
  }

  if (teamsToSeparate.length === 0) {
    console.log('\n✅ No duplicate teams found!');
    return;
  }

  console.log('\n📊 Separating teams...\n');

  for (const { team, footballGames, rugbyGames } of teamsToSeparate) {
    // Determine which sport should keep the original team
    // Keep the sport with more games, or Football if equal
    const keepFootball = footballGames >= rugbyGames;
    const keepSport = keepFootball ? 'FOOTBALL' : 'RUGBY';
    const createSport = keepFootball ? 'RUGBY' : 'FOOTBALL';
    const gamesToMove = keepFootball ? rugbyGames : footballGames;

    console.log(`\n🔀 Separating ${team.name}:`);
    console.log(`   Keeping ${keepSport} (${keepFootball ? footballGames : rugbyGames} games)`);
    console.log(`   Creating new team for ${createSport} (${gamesToMove} games)`);

    // Create new team for the other sport with a temporary name
    // We'll rename it after updating the schema
    const tempName = `${team.name} (${createSport})`;
    const newTeam = await prisma.team.create({
      data: {
        name: tempName,
        shortName: team.shortName,
        logo: team.logo,
        category: team.category,
        sportType: createSport as any,
        country: team.country,
      },
    });
    
    console.log(`   ✅ Created: ${newTeam.name} (${newTeam.sportType}, ${newTeam.category})`);
    
    // After schema update, we can rename it to just the name
    // For now, keep the sport suffix

    console.log(`   ✅ Created: ${newTeam.name} (${newTeam.sportType}, ${newTeam.category})`);

    // Update original team's sportType
    await prisma.team.update({
      where: { id: team.id },
      data: {
        sportType: keepSport as any,
      },
    });

    console.log(`   ✅ Updated original: ${team.name} → ${keepSport}`);

    // Move games to the new team
    const gamesToUpdate = keepFootball
      ? [...team.homeGames, ...team.awayGames].filter(g => g.competition.sportType === 'RUGBY')
      : [...team.homeGames, ...team.awayGames].filter(g => g.competition.sportType === 'FOOTBALL');

    let movedGames = 0;
    for (const game of gamesToUpdate) {
      if (game.homeTeamId === team.id) {
        await prisma.game.update({
          where: { id: game.id },
          data: { homeTeamId: newTeam.id },
        });
        movedGames++;
      }
      if (game.awayTeamId === team.id) {
        await prisma.game.update({
          where: { id: game.id },
          data: { awayTeamId: newTeam.id },
        });
        movedGames++;
      }
    }

    console.log(`   ✅ Moved ${movedGames} games to new team`);
  }

  console.log(`\n✅ Separated ${teamsToSeparate.length} duplicate teams`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

