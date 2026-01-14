/**
 * Script to check specific rugby games: Lyon vs Pau and Montpellier vs Bayonne
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking specific rugby games...\n');

  // Find Lyon vs Pau
  const lyonPau = await prisma.game.findFirst({
    where: {
      OR: [
        {
          homeTeam: { name: { contains: 'Lyon', mode: 'insensitive' } },
          awayTeam: { name: { contains: 'Pau', mode: 'insensitive' } }
        },
        {
          homeTeam: { name: { contains: 'Pau', mode: 'insensitive' } },
          awayTeam: { name: { contains: 'Lyon', mode: 'insensitive' } }
        }
      ],
      competition: {
        sportType: 'RUGBY'
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

  // Find Montpellier vs Bayonne
  const montpellierBayonne = await prisma.game.findFirst({
    where: {
      OR: [
        {
          homeTeam: { name: { contains: 'Montpellier', mode: 'insensitive' } },
          awayTeam: { name: { contains: 'Bayonne', mode: 'insensitive' } }
        },
        {
          homeTeam: { name: { contains: 'Bayonne', mode: 'insensitive' } },
          awayTeam: { name: { contains: 'Montpellier', mode: 'insensitive' } }
        }
      ],
      competition: {
        sportType: 'RUGBY'
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

  if (lyonPau) {
    console.log('📊 Lyon vs Pau:');
    console.log(`  Game ID: ${lyonPau.id}`);
    console.log(`  Competition: ${lyonPau.competition.name} (${lyonPau.competition.sportType})`);
    console.log(`  Home Team: ${lyonPau.homeTeam.name} (${lyonPau.homeTeam.sportType}, ${lyonPau.homeTeam.category})`);
    console.log(`  Away Team: ${lyonPau.awayTeam.name} (${lyonPau.awayTeam.sportType}, ${lyonPau.awayTeam.category})`);
    console.log(`  Status: ${lyonPau.status}`);
    console.log(`  External Status: ${lyonPau.externalStatus ?? 'null'}`);
    console.log(`  Date: ${lyonPau.date.toISOString()}`);
    console.log(`  Home Score: ${lyonPau.homeScore ?? 'null'}`);
    console.log(`  Away Score: ${lyonPau.awayScore ?? 'null'}`);
    console.log(`  Live Home Score: ${lyonPau.liveHomeScore ?? 'null'}`);
    console.log(`  Live Away Score: ${lyonPau.liveAwayScore ?? 'null'}`);
    console.log(`  Elapsed Minute: ${lyonPau.elapsedMinute ?? 'null'}`);
    console.log(`  External ID: ${lyonPau.externalId ?? 'null'}`);
    console.log(`  Last Sync: ${lyonPau.lastSyncAt?.toISOString() ?? 'null'}`);
    console.log('');
  } else {
    console.log('❌ Lyon vs Pau game not found\n');
  }

  if (montpellierBayonne) {
    console.log('📊 Montpellier vs Bayonne:');
    console.log(`  Game ID: ${montpellierBayonne.id}`);
    console.log(`  Competition: ${montpellierBayonne.competition.name} (${montpellierBayonne.competition.sportType})`);
    console.log(`  Home Team: ${montpellierBayonne.homeTeam.name} (${montpellierBayonne.homeTeam.sportType}, ${montpellierBayonne.homeTeam.category})`);
    console.log(`  Away Team: ${montpellierBayonne.awayTeam.name} (${montpellierBayonne.awayTeam.sportType}, ${montpellierBayonne.awayTeam.category})`);
    console.log(`  Status: ${montpellierBayonne.status}`);
    console.log(`  External Status: ${montpellierBayonne.externalStatus ?? 'null'}`);
    console.log(`  Date: ${montpellierBayonne.date.toISOString()}`);
    console.log(`  Home Score: ${montpellierBayonne.homeScore ?? 'null'}`);
    console.log(`  Away Score: ${montpellierBayonne.awayScore ?? 'null'}`);
    console.log(`  Live Home Score: ${montpellierBayonne.liveHomeScore ?? 'null'}`);
    console.log(`  Live Away Score: ${montpellierBayonne.liveAwayScore ?? 'null'}`);
    console.log(`  Elapsed Minute: ${montpellierBayonne.elapsedMinute ?? 'null'}`);
    console.log(`  External ID: ${montpellierBayonne.externalId ?? 'null'}`);
    console.log(`  Last Sync: ${montpellierBayonne.lastSyncAt?.toISOString() ?? 'null'}`);
    console.log('');
  } else {
    console.log('❌ Montpellier vs Bayonne game not found\n');
  }

  // Check if scores look like football scores (low scores like 3-1)
  if (lyonPau) {
    const homeScore = lyonPau.homeScore ?? lyonPau.liveHomeScore ?? 0;
    const awayScore = lyonPau.awayScore ?? lyonPau.liveAwayScore ?? 0;
    if (homeScore < 10 && awayScore < 10 && (homeScore > 0 || awayScore > 0)) {
      console.log('⚠️  Lyon vs Pau has football-like scores (low scores)');
    }
    if (lyonPau.elapsedMinute && lyonPau.elapsedMinute > 80) {
      console.log('⚠️  Lyon vs Pau has elapsedMinute > 80 (should be max 80 for rugby)');
    }
  }

  if (montpellierBayonne) {
    const homeScore = montpellierBayonne.homeScore ?? montpellierBayonne.liveHomeScore ?? 0;
    const awayScore = montpellierBayonne.awayScore ?? montpellierBayonne.liveAwayScore ?? 0;
    if (homeScore < 10 && awayScore < 10 && (homeScore > 0 || awayScore > 0)) {
      console.log('⚠️  Montpellier vs Bayonne has football-like scores (low scores)');
    }
    if (montpellierBayonne.elapsedMinute && montpellierBayonne.elapsedMinute > 80) {
      console.log('⚠️  Montpellier vs Bayonne has elapsedMinute > 80 (should be max 80 for rugby)');
    }
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

