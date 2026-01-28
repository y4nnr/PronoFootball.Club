/**
 * Manually fix PSV vs Bayern game with correct externalId
 */

import { PrismaClient } from '@prisma/client';
import { API_CONFIG } from '../lib/api-config';
import { ApiSportsV2 } from '../lib/api-sports-api-v2';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Manually fixing PSV vs Bayern game...\n');

  // Find PSV vs Bayern
  const game = await prisma.game.findFirst({
    where: {
      OR: [
        { homeTeam: { name: { contains: 'PSV', mode: 'insensitive' } }, awayTeam: { name: { contains: 'Bayern', mode: 'insensitive' } } },
        { homeTeam: { name: { contains: 'Bayern', mode: 'insensitive' } }, awayTeam: { name: { contains: 'PSV', mode: 'insensitive' } } },
      ],
      date: {
        gte: new Date('2026-01-28'),
        lt: new Date('2026-01-29')
      }
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true
    }
  });

  if (!game) {
    console.log('❌ PSV vs Bayern game not found');
    return;
  }

  console.log(`📊 Found game: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
  console.log(`   Game ID: ${game.id}`);
  console.log(`   Current External ID: ${game.externalId || 'NOT SET'}`);
  console.log(`   Status: ${game.status}\n`);

  // Validate API config
  const validation = API_CONFIG.validate();
  if (!validation.valid) {
    console.error('❌ API configuration error:', validation.errors.join(', '));
    return;
  }

  const apiKey = API_CONFIG.apiSportsApiKey;
  if (!apiKey) {
    console.error('❌ API key not found');
    return;
  }

  const apiSports = new ApiSportsV2(apiKey);

  // Fetch the correct match (ID: 1451154)
  const externalId = '1451154';
  console.log(`🔍 Fetching external match ${externalId}...\n`);

  const externalMatch = await apiSports.getMatchById(parseInt(externalId, 10));

  if (!externalMatch) {
    console.log(`❌ External match ${externalId} not found`);
    return;
  }

  console.log(`✅ Found external match:`);
  console.log(`   Teams: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
  console.log(`   Status: ${externalMatch.status} (${externalMatch.externalStatus})`);
  console.log(`   Score: ${externalMatch.score.fullTime.home ?? 'null'}-${externalMatch.score.fullTime.away ?? 'null'}`);
  console.log(`   Elapsed: ${externalMatch.elapsedMinute ?? 'null'}'`);

  // Update the game
  console.log(`\n🔧 Updating game...`);

  const updateData: any = {
    externalId: externalId,
    externalStatus: externalMatch.externalStatus,
    liveHomeScore: externalMatch.score.fullTime.home,
    liveAwayScore: externalMatch.score.fullTime.away,
    elapsedMinute: externalMatch.elapsedMinute,
    lastSyncAt: new Date()
  };

  if (externalMatch.status === 'FINISHED' && game.status !== 'FINISHED') {
    updateData.status = 'FINISHED';
    updateData.homeScore = externalMatch.score.fullTime.home;
    updateData.awayScore = externalMatch.score.fullTime.away;
  } else if (externalMatch.status === 'LIVE' && game.status !== 'LIVE') {
    updateData.status = 'LIVE';
  }

  await prisma.game.update({
    where: { id: game.id },
    data: updateData
  });

  console.log(`✅ Game updated successfully!`);
  console.log(`   External ID: ${externalId}`);
  console.log(`   Status: ${updateData.status || game.status}`);
  console.log(`   Score: ${updateData.liveHomeScore ?? game.liveHomeScore}-${updateData.liveAwayScore ?? game.liveAwayScore}`);
  console.log(`   Elapsed: ${updateData.elapsedMinute ?? game.elapsedMinute}'`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
