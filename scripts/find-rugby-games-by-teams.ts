/**
 * Script to find rugby games by team names (flexible search)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding rugby games with Lyon, Pau, Montpellier, or Bayonne...\n');

  // Find all rugby games
  const rugbyGames = await prisma.game.findMany({
    where: {
      competition: {
        sportType: 'RUGBY'
      }
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
          sportType: true
        }
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          sportType: true
        }
      },
      competition: {
        select: {
          id: true,
          name: true,
          sportType: true
        }
      }
    },
    orderBy: {
      date: 'desc'
    },
    take: 50 // Get recent games
  });

  console.log(`Found ${rugbyGames.length} recent rugby games\n`);

  // Filter for games with Lyon, Pau, Montpellier, or Bayonne
  const relevantGames = rugbyGames.filter(game => {
    const homeName = game.homeTeam.name.toLowerCase();
    const awayName = game.awayTeam.name.toLowerCase();
    return (
      homeName.includes('lyon') || awayName.includes('lyon') ||
      homeName.includes('pau') || awayName.includes('pau') ||
      homeName.includes('montpellier') || awayName.includes('montpellier') ||
      homeName.includes('bayonne') || awayName.includes('bayonne')
    );
  });

  if (relevantGames.length > 0) {
    console.log(`Found ${relevantGames.length} relevant games:\n`);
    
    for (const game of relevantGames) {
      console.log(`📊 ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Game ID: ${game.id}`);
      console.log(`   Competition: ${game.competition.name}`);
      console.log(`   Status: ${game.status}`);
      console.log(`   External Status: ${game.externalStatus ?? 'null'}`);
      console.log(`   Date: ${game.date.toISOString()}`);
      console.log(`   Home Score: ${game.homeScore ?? 'null'}`);
      console.log(`   Away Score: ${game.awayScore ?? 'null'}`);
      console.log(`   Live Home Score: ${game.liveHomeScore ?? 'null'}`);
      console.log(`   Live Away Score: ${game.liveAwayScore ?? 'null'}`);
      console.log(`   Elapsed Minute: ${game.elapsedMinute ?? 'null'}`);
      console.log(`   Home Team Sport: ${game.homeTeam.sportType}`);
      console.log(`   Away Team Sport: ${game.awayTeam.sportType}`);
      
      // Check for issues
      const issues: string[] = [];
      const homeScore = game.homeScore ?? game.liveHomeScore ?? 0;
      const awayScore = game.awayScore ?? game.liveAwayScore ?? 0;
      
      if (homeScore < 10 && awayScore < 10 && (homeScore > 0 || awayScore > 0)) {
        issues.push('Football-like scores (low scores)');
      }
      if (game.elapsedMinute && game.elapsedMinute > 80) {
        issues.push(`Elapsed minute > 80 (${game.elapsedMinute})`);
      }
      if (game.homeTeam.sportType !== 'RUGBY') {
        issues.push(`Home team is ${game.homeTeam.sportType}, not RUGBY`);
      }
      if (game.awayTeam.sportType !== 'RUGBY') {
        issues.push(`Away team is ${game.awayTeam.sportType}, not RUGBY`);
      }
      
      if (issues.length > 0) {
        console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
      }
      
      console.log('');
    }
  } else {
    console.log('❌ No relevant games found');
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

