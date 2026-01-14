/**
 * Script to check rugby LIVE games that should be FINISHED
 */

import { PrismaClient } from '@prisma/client';
import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking rugby LIVE games that should be FINISHED...\n');

  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Get all LIVE rugby games
  const liveGames = await prisma.game.findMany({
    where: {
      status: 'LIVE',
      competition: {
        sportType: 'RUGBY'
      }
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true
        }
      },
      awayTeam: {
        select: {
          id: true,
          name: true
        }
      },
      competition: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  console.log(`📊 Found ${liveGames.length} LIVE rugby games in database\n`);

  if (liveGames.length === 0) {
    console.log('✅ No LIVE rugby games found');
    return;
  }

  // Check each game
  for (const game of liveGames) {
    console.log(`\n📊 ${game.homeTeam.name} vs ${game.awayTeam.name}`);
    console.log(`   Status: ${game.status}`);
    console.log(`   External Status: ${game.externalStatus ?? 'null'}`);
    console.log(`   External ID: ${game.externalId ?? 'null'}`);
    console.log(`   Date: ${game.date}`);
    console.log(`   Last Sync: ${game.lastSyncAt?.toISOString() ?? 'null'}`);

    // Try to find in external API
    if (game.externalId) {
      try {
        const externalId = parseInt(game.externalId);
        if (!isNaN(externalId)) {
          console.log(`   🔍 Fetching from API with ID ${externalId}...`);
          const match = await rugbyAPI.getMatchById(externalId);
          
          if (match) {
            console.log(`   ✅ Found in API:`);
            console.log(`      External Status: ${match.externalStatus}`);
            console.log(`      Mapped Status: ${match.status}`);
            console.log(`      Score: ${match.score.fullTime.home ?? 'N/A'}-${match.score.fullTime.away ?? 'N/A'}`);
            
            if (match.externalStatus === 'FT' || match.externalStatus === 'AET' || match.externalStatus === 'PEN') {
              console.log(`   ⚠️ Match is FINISHED in API but LIVE in database!`);
            } else {
              console.log(`   ℹ️ Match is still LIVE in API`);
            }
          } else {
            console.log(`   ⚠️ Match not found in API by ID`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error fetching match:`, error);
      }
    } else {
      console.log(`   ⚠️ No externalId - cannot fetch by ID`);
    }
  }

  // Also check finished matches from API
  console.log(`\n\n🔍 Checking finished matches from API...`);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  try {
    const finishedMatches = await rugbyAPI.getMatchesByDateRange(yesterdayStr, todayStr);
    const ftMatches = finishedMatches.filter(m => 
      m.externalStatus === 'FT' || m.externalStatus === 'AET' || m.externalStatus === 'PEN'
    );
    console.log(`   Found ${ftMatches.length} finished matches in API`);
    
    if (ftMatches.length > 0) {
      console.log(`   Sample finished matches:`);
      ftMatches.slice(0, 5).forEach(m => {
        console.log(`      ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.externalStatus}, ID: ${m.id})`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error fetching finished matches:`, error);
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

