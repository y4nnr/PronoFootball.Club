/**
 * Script to fix corrupted rugby games that were updated by football API
 * Fixes: Montpellier vs Bayonne and Lyon vs Pau
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing corrupted rugby games...\n');

  // Game IDs from the investigation
  const corruptedGameIds = [
    'cmjwpq6vl005lhuj64b5kodnb', // Montpellier vs Aviron Bayonnais
    'cmjwpq6vm005phuj6q59difj7'  // Lyon vs Section Paloise
  ];

  for (const gameId of corruptedGameIds) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      }
    });

    if (!game) {
      console.log(`❌ Game ${gameId} not found`);
      continue;
    }

    console.log(`📊 Fixing: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
    console.log(`   Current status: ${game.status}`);
    console.log(`   Current external status: ${game.externalStatus ?? 'null'}`);
    console.log(`   Current scores: ${game.homeScore ?? game.liveHomeScore ?? 'null'}-${game.awayScore ?? game.liveAwayScore ?? 'null'}`);
    console.log(`   Current elapsed: ${game.elapsedMinute ?? 'null'}`);

    // Reset the corrupted data
    // Since externalStatus is FT, the game should be FINISHED
    // But we don't have the correct rugby scores, so we'll reset to a clean state
    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'FINISHED', // External status is FT, so game is finished
        externalStatus: 'FT',
        // Reset scores - they'll be updated by the rugby API on next sync
        homeScore: null,
        awayScore: null,
        liveHomeScore: null,
        liveAwayScore: null,
        elapsedMinute: null, // Reset chronometer
        lastSyncAt: null // Force re-sync
      }
    });

    console.log(`   ✅ Reset to FINISHED state (scores cleared, will be updated by rugby API)`);
    console.log('');
  }

  console.log('✅ Fix complete! The rugby API will update these games with correct data on next sync.');
  console.log('   You can manually trigger: POST /api/update-live-scores-rugby');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

