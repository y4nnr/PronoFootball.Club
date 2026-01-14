/**
 * Script to fix rugby games that are using football teams
 * Specifically fixes: Lyon vs Pau and Montpellier vs Bayonne
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking rugby games for incorrect team assignments...\n');

  // Find rugby competitions
  const rugbyCompetitions = await prisma.competition.findMany({
    where: {
      sportType: 'RUGBY'
    },
    select: {
      id: true,
      name: true
    }
  });

  console.log(`Found ${rugbyCompetitions.length} rugby competitions:\n`);
  for (const comp of rugbyCompetitions) {
    console.log(`  - ${comp.name} (${comp.id})`);
  }

  if (rugbyCompetitions.length === 0) {
    console.log('\n❌ No rugby competitions found');
    return;
  }

  // Find games in rugby competitions
  const rugbyGames = await prisma.game.findMany({
    where: {
      competitionId: {
        in: rugbyCompetitions.map(c => c.id)
      }
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
          sportType: true,
          category: true
        }
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          sportType: true,
          category: true
        }
      },
      competition: {
        select: {
          id: true,
          name: true,
          sportType: true
        }
      }
    }
  });

  console.log(`\n📊 Found ${rugbyGames.length} games in rugby competitions\n`);

  // Check for games with football teams
  const problematicGames = rugbyGames.filter(game => 
    game.homeTeam.sportType !== 'RUGBY' || 
    game.awayTeam.sportType !== 'RUGBY' ||
    game.competition.sportType !== 'RUGBY'
  );

  if (problematicGames.length > 0) {
    console.log(`⚠️ Found ${problematicGames.length} problematic games:\n`);
    
    for (const game of problematicGames) {
      console.log(`  Game: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`    Competition: ${game.competition.name} (${game.competition.sportType})`);
      console.log(`    Home Team: ${game.homeTeam.name} (${game.homeTeam.sportType}, ${game.homeTeam.category})`);
      console.log(`    Away Team: ${game.awayTeam.name} (${game.awayTeam.sportType}, ${game.awayTeam.category})`);
      console.log(`    Status: ${game.status}`);
      console.log(`    Score: ${game.homeScore ?? game.liveHomeScore ?? 'N/A'} - ${game.awayScore ?? game.liveAwayScore ?? 'N/A'}`);
      console.log(`    Elapsed: ${game.elapsedMinute ?? 'N/A'}'`);
      console.log(`    External Status: ${game.externalStatus ?? 'N/A'}`);
      console.log('');
    }

    // Find the specific games mentioned
    const lyonPau = problematicGames.find(g => 
      (g.homeTeam.name.includes('Lyon') || g.awayTeam.name.includes('Lyon')) &&
      (g.homeTeam.name.includes('Pau') || g.awayTeam.name.includes('Pau'))
    );

    const montpellierBayonne = problematicGames.find(g => 
      (g.homeTeam.name.includes('Montpellier') || g.awayTeam.name.includes('Montpellier')) &&
      (g.homeTeam.name.includes('Bayonne') || g.awayTeam.name.includes('Bayonne'))
    );

    console.log('\n🎯 Specific games to fix:\n');

    if (lyonPau) {
      console.log('  Lyon vs Pau:');
      console.log(`    Game ID: ${lyonPau.id}`);
      console.log(`    Home Team ID: ${lyonPau.homeTeam.id} (${lyonPau.homeTeam.name}, ${lyonPau.homeTeam.sportType})`);
      console.log(`    Away Team ID: ${lyonPau.awayTeam.id} (${lyonPau.awayTeam.name}, ${lyonPau.awayTeam.sportType})`);
      
      // Find the correct rugby teams
      const lyonRugby = await prisma.team.findFirst({
        where: {
          name: { contains: 'Lyon', mode: 'insensitive' },
          sportType: 'RUGBY'
        }
      });
      
      const pauRugby = await prisma.team.findFirst({
        where: {
          name: { contains: 'Pau', mode: 'insensitive' },
          sportType: 'RUGBY'
        }
      });

      console.log(`    Correct Lyon Rugby Team: ${lyonRugby ? `${lyonRugby.id} (${lyonRugby.name})` : 'NOT FOUND'}`);
      console.log(`    Correct Pau Rugby Team: ${pauRugby ? `${pauRugby.id} (${pauRugby.name})` : 'NOT FOUND'}`);

      if (lyonRugby && pauRugby) {
        console.log(`\n    ✅ Would update: homeTeamId=${lyonRugby.id}, awayTeamId=${pauRugby.id}`);
      } else {
        console.log(`\n    ❌ Cannot fix: missing rugby teams`);
      }
    }

    if (montpellierBayonne) {
      console.log('\n  Montpellier vs Bayonne:');
      console.log(`    Game ID: ${montpellierBayonne.id}`);
      console.log(`    Home Team ID: ${montpellierBayonne.homeTeam.id} (${montpellierBayonne.homeTeam.name}, ${montpellierBayonne.homeTeam.sportType})`);
      console.log(`    Away Team ID: ${montpellierBayonne.awayTeam.id} (${montpellierBayonne.awayTeam.name}, ${montpellierBayonne.awayTeam.sportType})`);
      
      // Find the correct rugby teams
      const montpellierRugby = await prisma.team.findFirst({
        where: {
          name: { contains: 'Montpellier', mode: 'insensitive' },
          sportType: 'RUGBY'
        }
      });
      
      const bayonneRugby = await prisma.team.findFirst({
        where: {
          name: { contains: 'Bayonne', mode: 'insensitive' },
          sportType: 'RUGBY'
        }
      });

      console.log(`    Correct Montpellier Rugby Team: ${montpellierRugby ? `${montpellierRugby.id} (${montpellierRugby.name})` : 'NOT FOUND'}`);
      console.log(`    Correct Bayonne Rugby Team: ${bayonneRugby ? `${bayonneRugby.id} (${bayonneRugby.name})` : 'NOT FOUND'}`);

      if (montpellierRugby && bayonneRugby) {
        console.log(`\n    ✅ Would update: homeTeamId=${montpellierRugby.id}, awayTeamId=${bayonneRugby.id}`);
      } else {
        console.log(`\n    ❌ Cannot fix: missing rugby teams`);
      }
    }

    // Ask for confirmation before fixing
    console.log('\n⚠️  To fix these games, run with --fix flag');
    console.log('   Example: npx ts-node scripts/fix-rugby-games-teams.ts --fix');
  } else {
    console.log('✅ No problematic games found! All rugby games use rugby teams.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

