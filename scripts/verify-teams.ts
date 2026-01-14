/**
 * Script to verify team categories and sport types
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying teams...\n');

  // Get all teams
  const teams = await prisma.team.findMany({
    include: {
      homeGames: {
        include: {
          competition: {
            select: {
              name: true,
              sportType: true,
            },
          },
        },
      },
      awayGames: {
        include: {
          competition: {
            select: {
              name: true,
              sportType: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`Total teams: ${teams.length}\n`);

  // Check Top 14 teams
  const top14Teams = teams.filter(team => {
    const allGames = [...team.homeGames, ...team.awayGames];
    return allGames.some(g => g.competition.name.includes('Top 14'));
  });

  console.log(`Top 14 teams (${top14Teams.length}):`);
  for (const team of top14Teams) {
    const allGames = [...team.homeGames, ...team.awayGames];
    const top14Games = allGames.filter(g => g.competition.name.includes('Top 14'));
    console.log(`  - ${team.name}: category=${team.category}, sportType=${team.sportType}, country=${team.country || 'N/A'}, Top14 games=${top14Games.length}`);
    
    if (team.category !== 'CLUB') {
      console.log(`    ⚠️  WRONG CATEGORY: Should be CLUB`);
    }
    if (team.sportType !== 'RUGBY') {
      console.log(`    ⚠️  WRONG SPORT: Should be RUGBY`);
    }
  }

  // Check Ligue 1 teams
  const ligue1Teams = teams.filter(team => {
    const allGames = [...team.homeGames, ...team.awayGames];
    return allGames.some(g => g.competition.name.includes('Ligue 1'));
  });

  console.log(`\nLigue 1 teams (${ligue1Teams.length}):`);
  for (const team of ligue1Teams.slice(0, 10)) {
    const allGames = [...team.homeGames, ...team.awayGames];
    const ligue1Games = allGames.filter(g => g.competition.name.includes('Ligue 1'));
    console.log(`  - ${team.name}: category=${team.category}, sportType=${team.sportType}, country=${team.country || 'N/A'}, Ligue1 games=${ligue1Games.length}`);
    
    if (team.category !== 'CLUB') {
      console.log(`    ⚠️  WRONG CATEGORY: Should be CLUB`);
    }
    if (team.sportType !== 'FOOTBALL') {
      console.log(`    ⚠️  WRONG SPORT: Should be FOOTBALL`);
    }
  }
  if (ligue1Teams.length > 10) {
    console.log(`  ... and ${ligue1Teams.length - 10} more`);
  }

  // Check Lyon teams
  const lyonTeams = teams.filter(t => t.name === 'Lyon');
  console.log(`\nLyon teams (${lyonTeams.length}):`);
  for (const team of lyonTeams) {
    const allGames = [...team.homeGames, ...team.awayGames];
    const footballGames = allGames.filter(g => g.competition.sportType === 'FOOTBALL');
    const rugbyGames = allGames.filter(g => g.competition.sportType === 'RUGBY');
    console.log(`  - ${team.name}: category=${team.category}, sportType=${team.sportType}, country=${team.country || 'N/A'}`);
    console.log(`    Football games: ${footballGames.length}, Rugby games: ${rugbyGames.length}`);
    
    if (footballGames.length > 0 && rugbyGames.length > 0) {
      console.log(`    ⚠️  WARNING: Team plays in both sports!`);
    }
  }

  console.log('\n✅ Verification complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

