/**
 * Script to fix PSV vs Bayern match and find missing matches for PSG and Pafos
 */

import { PrismaClient } from '@prisma/client';
import { API_CONFIG } from '../lib/api-config';
import { ApiSportsV2 } from '../lib/api-sports-api-v2';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding PSV vs Bayern, PSG vs Newcastle, and Pafos vs Slavia Prague games...\n');

  // Find PSV vs Bayern
  const psvBayern = await prisma.game.findFirst({
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

  // Find PSG vs Newcastle
  const psgNewcastle = await prisma.game.findFirst({
    where: {
      OR: [
        { homeTeam: { name: { contains: 'PSG', mode: 'insensitive' } }, awayTeam: { name: { contains: 'Newcastle', mode: 'insensitive' } } },
        { homeTeam: { name: { contains: 'Paris Saint', mode: 'insensitive' } }, awayTeam: { name: { contains: 'Newcastle', mode: 'insensitive' } } },
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

  // Find Pafos vs Slavia Prague
  const pafosSlavia = await prisma.game.findFirst({
    where: {
      OR: [
        { homeTeam: { name: { contains: 'Pafos', mode: 'insensitive' } }, awayTeam: { name: { contains: 'Slavia', mode: 'insensitive' } } },
        { homeTeam: { name: { contains: 'Slavia', mode: 'insensitive' } }, awayTeam: { name: { contains: 'Pafos', mode: 'insensitive' } } },
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

  const gamesToFix = [
    { game: psvBayern, name: 'PSV vs Bayern' },
    { game: psgNewcastle, name: 'PSG vs Newcastle' },
    { game: pafosSlavia, name: 'Pafos vs Slavia Prague' }
  ].filter(item => item.game !== null);

  if (gamesToFix.length === 0) {
    console.log('❌ No games found');
    return;
  }

  console.log(`📊 Found ${gamesToFix.length} games to check:\n`);

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

  // Get matches from external API - search a wider date range
  const startDate = new Date('2026-01-28');
  const endDate = new Date('2026-01-29');
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  console.log(`🔍 Fetching matches from external API for ${startDateStr} to ${endDateStr}...\n`);
  
  const externalMatches = await apiSports.getMatchesByDateRange(startDateStr, endDateStr);
  console.log(`📊 Found ${externalMatches.length} external matches\n`);
  
  // Filter for Champions League matches
  const championsLeagueMatches = externalMatches.filter(m => 
    m.competition.name.toLowerCase().includes('champions league')
  );
  console.log(`🏆 Found ${championsLeagueMatches.length} Champions League matches:\n`);
  championsLeagueMatches.forEach((m, idx) => {
    console.log(`   ${idx + 1}. ${m.homeTeam.name} vs ${m.awayTeam.name} (ID: ${m.id}, Status: ${m.externalStatus})`);
  });
  console.log('');

  for (const { game, name } of gamesToFix) {
    if (!game) continue;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎮 ${name}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Game ID: ${game.id}`);
    console.log(`   Teams: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
    console.log(`   Status: ${game.status}`);
    console.log(`   External ID: ${game.externalId || 'NOT SET'}`);
    console.log(`   External Status: ${game.externalStatus || 'null'}`);
    console.log(`   Last Sync: ${game.lastSyncAt?.toISOString() || 'never'}`);
    console.log(`   Scores: ${game.liveHomeScore ?? game.homeScore ?? 'null'}-${game.liveAwayScore ?? game.awayScore ?? 'null'}`);
    console.log(`   Elapsed: ${game.elapsedMinute ?? 'null'}'`);

    // If game has externalId, try to fetch it directly first
    let matchingExternal = null;
    if (game.externalId) {
      console.log(`\n   🔍 Trying to fetch by externalId: ${game.externalId}`);
      try {
        const directMatch = await apiSports.getMatchById(parseInt(game.externalId, 10));
        if (directMatch) {
          console.log(`   ✅ Found match by externalId:`);
          console.log(`      Teams: ${directMatch.homeTeam.name} vs ${directMatch.awayTeam.name}`);
          console.log(`      Status: ${directMatch.status} (${directMatch.externalStatus})`);
          matchingExternal = directMatch;
        } else {
          console.log(`   ⚠️ ExternalId ${game.externalId} not found in API - might be invalid`);
        }
      } catch (error) {
        console.log(`   ❌ Error fetching by externalId: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // If not found by externalId, search in Champions League matches first
    if (!matchingExternal) {
      // Normalize team names for better matching
      const normalizeName = (name: string) => {
        return name.toLowerCase()
          .normalize('NFD') // Remove accents
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .replace(/\s+fc\s*$/i, '')
          .replace(/^fc\s+/i, '')
          .replace(/\s*-\s*/g, ' ') // Replace hyphens with spaces
          .replace(/\s+/g, ' ')
          .trim();
      };

      const dbHomeNorm = normalizeName(game.homeTeam.name);
      const dbAwayNorm = normalizeName(game.awayTeam.name);
      const dbHomeLower = game.homeTeam.name.toLowerCase();
      const dbAwayLower = game.awayTeam.name.toLowerCase();

      console.log(`   🔍 Normalized DB names: "${dbHomeNorm}" vs "${dbAwayNorm}"`);

      // Helper function to check if two names are similar enough (handles Munich/München, etc.)
      const namesSimilar = (name1: string, name2: string): boolean => {
        const name1Lower = name1.toLowerCase();
        const name2Lower = name2.toLowerCase();
        
        // Direct inclusion check
        if (name1Lower.includes(name2Lower) || name2Lower.includes(name1Lower)) return true;
        
        // Special cases for common variations - check if either name contains the variation
        const variations: { [key: string]: string[] } = {
          'munich': ['munchen', 'muenchen'],
          'munchen': ['munich', 'muenchen'],
          'muenchen': ['munich', 'munchen'],
        };
        
        // Check if name1 contains a variation key and name2 contains any of its variations
        for (const [key, variants] of Object.entries(variations)) {
          if (name1Lower.includes(key) && variants.some(v => name2Lower.includes(v))) return true;
          if (name2Lower.includes(key) && variants.some(v => name1Lower.includes(v))) return true;
        }
        
        return false;
      };

      // First try Champions League matches (more likely)
      matchingExternal = championsLeagueMatches.find(m => {
        const extHomeNorm = normalizeName(m.homeTeam.name);
        const extAwayNorm = normalizeName(m.awayTeam.name);
        const extHomeLower = m.homeTeam.name.toLowerCase();
        const extAwayLower = m.awayTeam.name.toLowerCase();
        
        // Debug for PSV/Bayern
        if (game.homeTeam.name.includes('PSV') || game.awayTeam.name.includes('Bayern')) {
          console.log(`      Checking: "${extHomeNorm}" vs "${extAwayNorm}"`);
          console.log(`         DB: "${dbHomeNorm}" vs "${dbAwayNorm}"`);
        }

        // Check normalized names first (more reliable)
        const normalMatchNorm = namesSimilar(dbHomeNorm, extHomeNorm) && namesSimilar(dbAwayNorm, extAwayNorm);
        const reversedMatchNorm = namesSimilar(dbHomeNorm, extAwayNorm) && namesSimilar(dbAwayNorm, extHomeNorm);

        // Fallback to original matching (with similarity check)
        const normalMatch = namesSimilar(dbHomeLower, extHomeLower) && namesSimilar(dbAwayLower, extAwayLower);
        const reversedMatch = namesSimilar(dbHomeLower, extAwayLower) && namesSimilar(dbAwayLower, extHomeLower);

        return normalMatchNorm || reversedMatchNorm || normalMatch || reversedMatch;
      });

      // If still not found, try all matches
      if (!matchingExternal) {
        matchingExternal = externalMatches.find(m => {
          const extHomeNorm = normalizeName(m.homeTeam.name);
          const extAwayNorm = normalizeName(m.awayTeam.name);
          const extHomeLower = m.homeTeam.name.toLowerCase();
          const extAwayLower = m.awayTeam.name.toLowerCase();

          const normalMatchNorm = namesSimilar(dbHomeNorm, extHomeNorm) && namesSimilar(dbAwayNorm, extAwayNorm);
          const reversedMatchNorm = namesSimilar(dbHomeNorm, extAwayNorm) && namesSimilar(dbAwayNorm, extHomeNorm);
          const normalMatch = namesSimilar(dbHomeLower, extHomeLower) && namesSimilar(dbAwayLower, extAwayLower);
          const reversedMatch = namesSimilar(dbHomeLower, extAwayLower) && namesSimilar(dbAwayLower, extHomeLower);

          return normalMatchNorm || reversedMatchNorm || normalMatch || reversedMatch;
        });
      }
    }

    if (matchingExternal) {
      console.log(`\n   ✅ Found matching external match:`);
      console.log(`      External ID: ${matchingExternal.id}`);
      console.log(`      Teams: ${matchingExternal.homeTeam.name} vs ${matchingExternal.awayTeam.name}`);
      console.log(`      Status: ${matchingExternal.status} (${matchingExternal.externalStatus})`);
      console.log(`      Score: ${matchingExternal.score.fullTime.home ?? 'null'}-${matchingExternal.score.fullTime.away ?? 'null'}`);
      console.log(`      Elapsed: ${matchingExternal.elapsedMinute ?? 'null'}'`);

      // Check if externalId needs to be updated or if scores need updating
      const needsUpdate = game.externalId !== matchingExternal.id.toString() ||
                         game.externalStatus !== matchingExternal.externalStatus ||
                         game.liveHomeScore !== matchingExternal.score.fullTime.home ||
                         game.liveAwayScore !== matchingExternal.score.fullTime.away ||
                         game.elapsedMinute !== matchingExternal.elapsedMinute;

      if (needsUpdate) {
        if (game.externalId !== matchingExternal.id.toString()) {
          console.log(`\n   🔧 Updating externalId: ${game.externalId || 'null'} -> ${matchingExternal.id}`);
        } else {
          console.log(`\n   🔧 Updating game data (externalId already correct)`);
        }
        
        const updateData: any = {
          externalId: matchingExternal.id.toString(),
          externalStatus: matchingExternal.externalStatus,
          liveHomeScore: matchingExternal.score.fullTime.home,
          liveAwayScore: matchingExternal.score.fullTime.away,
          elapsedMinute: matchingExternal.elapsedMinute,
          lastSyncAt: new Date()
        };

        // Update status if needed
        if (matchingExternal.status === 'FINISHED' && game.status !== 'FINISHED') {
          updateData.status = 'FINISHED';
          updateData.homeScore = matchingExternal.score.fullTime.home;
          updateData.awayScore = matchingExternal.score.fullTime.away;
        } else if (matchingExternal.status === 'LIVE' && game.status !== 'LIVE') {
          updateData.status = 'LIVE';
        }

        await prisma.game.update({
          where: { id: game.id },
          data: updateData
        });

        console.log(`   ✅ Updated successfully!`);
        console.log(`      Status: ${updateData.status || game.status}`);
        console.log(`      Score: ${updateData.liveHomeScore ?? game.liveHomeScore}-${updateData.liveAwayScore ?? game.liveAwayScore}`);
        console.log(`      Elapsed: ${updateData.elapsedMinute ?? game.elapsedMinute}'`);
      } else {
        console.log(`\n   ✅ Game data is already up to date`);
      }
    } else {
      console.log(`\n   ❌ No matching external match found`);
      console.log(`   Available external matches (first 10):`);
      externalMatches.slice(0, 10).forEach((m, idx) => {
        console.log(`      ${idx + 1}. ${m.homeTeam.name} vs ${m.awayTeam.name} (ID: ${m.id}, Status: ${m.externalStatus})`);
      });
    }
  }

  console.log(`\n${'='.repeat(80)}\n✅ Done!\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
