/**
 * Script to fix Chelsea vs Pafos game score
 * 
 * Usage (local dev):
 *   npx tsx scripts/fix-chelsea-pafos-score.ts
 * 
 * Usage (production):
 *   DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname" npx tsx scripts/fix-chelsea-pafos-score.ts
 * 
 * Or set PROD_DATABASE_URL in your environment to override
 */

import { PrismaClient } from '@prisma/client';

// Use PROD_DATABASE_URL if set, otherwise use DATABASE_URL
const databaseUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL or PROD_DATABASE_URL must be set');
  process.exit(1);
}

// Check if we're connecting to production (not localhost)
const isProduction = !databaseUrl.includes('127.0.0.1') && !databaseUrl.includes('localhost');

if (isProduction) {
  console.log('⚠️  WARNING: Connecting to PRODUCTION database!');
  console.log(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password
  console.log('');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

async function main() {
  console.log('🔍 Searching for Chelsea vs Pafos game...\n');

  // Find the game
  const games = await prisma.game.findMany({
    where: {
      OR: [
        {
          homeTeam: {
            name: {
              contains: 'Chelsea',
              mode: 'insensitive'
            }
          },
          awayTeam: {
            name: {
              contains: 'Pafos',
              mode: 'insensitive'
            }
          }
        },
        {
          homeTeam: {
            name: {
              contains: 'Pafos',
              mode: 'insensitive'
            }
          },
          awayTeam: {
            name: {
              contains: 'Chelsea',
              mode: 'insensitive'
            }
          }
        }
      ]
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true
    },
    orderBy: {
      date: 'desc'
    }
  });

  if (games.length === 0) {
    console.log('❌ No game found matching Chelsea vs Pafos');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found ${games.length} game(s):\n`);

  for (const game of games) {
    console.log(`Game ID: ${game.id}`);
    console.log(`Teams: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
    console.log(`Date: ${game.date.toISOString()}`);
    console.log(`Status: ${game.status}`);
    console.log(`Competition: ${game.competition.name}`);
    console.log(`External ID: ${game.externalId || 'N/A'}`);
    console.log(`Current scores:`);
    console.log(`  Final: ${game.homeScore ?? 'null'} - ${game.awayScore ?? 'null'}`);
    console.log(`  Live: ${game.liveHomeScore ?? 'null'} - ${game.liveAwayScore ?? 'null'}`);
    console.log(`External Status: ${game.externalStatus || 'N/A'}`);
    console.log(`Last Sync: ${game.lastSyncAt?.toISOString() || 'N/A'}`);
    console.log('---\n');
  }

  // If multiple games, ask which one to fix
  const gameToFix = games[0]; // Fix the most recent one

  console.log(`\n🔧 Fixing game: ${gameToFix.homeTeam.name} vs ${gameToFix.awayTeam.name}`);
  console.log(`   Current: ${gameToFix.liveHomeScore ?? 0}-${gameToFix.liveAwayScore ?? 0}`);
  console.log(`   Target: 0-0\n`);

  // Check if scores are actually wrong
  const isWrong = (gameToFix.liveHomeScore !== 0 || gameToFix.liveAwayScore !== 1) &&
                  (gameToFix.homeScore !== 0 || gameToFix.awayScore !== 1);

  if (!isWrong && gameToFix.liveHomeScore === 0 && gameToFix.liveAwayScore === 0) {
    console.log('✅ Scores are already correct (0-0), no fix needed');
    await prisma.$disconnect();
    return;
  }

  // Update the game
  const updatedGame = await prisma.game.update({
    where: { id: gameToFix.id },
    data: {
      liveHomeScore: 0,
      liveAwayScore: 0,
      homeScore: gameToFix.status === 'FINISHED' ? 0 : gameToFix.homeScore,
      awayScore: gameToFix.status === 'FINISHED' ? 0 : gameToFix.awayScore,
      lastSyncAt: new Date(),
      updatedAt: new Date()
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true
    }
  });

  console.log('✅ Game updated successfully!');
  console.log(`   New scores: ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore}`);
  if (updatedGame.status === 'FINISHED') {
    console.log(`   Final scores: ${updatedGame.homeScore}-${updatedGame.awayScore}`);
  }

  // If game is FINISHED, recalculate bet points
  if (updatedGame.status === 'FINISHED' && updatedGame.homeScore !== null && updatedGame.awayScore !== null) {
    console.log('\n💰 Recalculating bet points...');

    const competition = await prisma.competition.findUnique({
      where: { id: updatedGame.competitionId },
      select: { sportType: true }
    });

    const { calculateBetPoints, getScoringSystemForSport } = await import('../lib/scoring-systems');
    const scoringSystem = getScoringSystemForSport(competition?.sportType || 'FOOTBALL');

    const bets = await prisma.bet.findMany({
      where: { gameId: updatedGame.id },
      include: { user: true }
    });

    let updatedBets = 0;
    for (const bet of bets) {
      const points = calculateBetPoints(
        { score1: bet.score1, score2: bet.score2 },
        { home: updatedGame.homeScore!, away: updatedGame.awayScore! },
        scoringSystem
      );

      if (bet.points !== points) {
        await prisma.bet.update({
          where: { id: bet.id },
          data: { points }
        });
        updatedBets++;
        console.log(`   Updated bet for ${bet.user.name}: ${bet.points} → ${points} points`);
      }
    }

    if (updatedBets > 0) {
      console.log(`\n✅ Recalculated ${updatedBets} bet(s)`);
    } else {
      console.log(`\n✅ No bet points needed recalculation`);
    }

    // Update shooters for competition
    await updateShootersForCompetition(updatedGame.competitionId);
    console.log('✅ Updated shooters count for competition');
  }

  console.log('\n✅ All done!');
}

async function updateShootersForCompetition(competitionId: string) {
  try {
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: true }
    });

    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] }
      }
    });

    const totalGames = finishedGames.length;

    for (const competitionUser of competitionUsers) {
      const userBets = await prisma.bet.count({
        where: {
          userId: competitionUser.userId,
          game: {
            competitionId,
            status: { in: ['FINISHED', 'LIVE'] }
          }
        }
      });

      const shooters = totalGames - userBets;

      await prisma.competitionUser.update({
        where: { id: competitionUser.id },
        data: { shooters }
      });
    }
  } catch (error) {
    console.error('Error updating shooters:', error);
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
