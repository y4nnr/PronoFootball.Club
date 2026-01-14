/**
 * Script to check the Monaco vs Lyon game status and matching
 */

import { PrismaClient } from '@prisma/client';
import { ApiSportsV2 } from '../lib/api-sports-api-v2';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Monaco vs Lyon game...\n');

  const apiKey = process.env['API-FOOTBALL'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const apiSports = new ApiSportsV2(apiKey);

  // Find the game in database
  const game = await prisma.game.findFirst({
    where: {
      OR: [
        {
          homeTeam: {
            name: {
              contains: 'Monaco',
              mode: 'insensitive'
            }
          },
          awayTeam: {
            name: {
              contains: 'Lyon',
              mode: 'insensitive'
            }
          }
        },
        {
          homeTeam: {
            name: {
              contains: 'Lyon',
              mode: 'insensitive'
            }
          },
          awayTeam: {
            name: {
              contains: 'Monaco',
              mode: 'insensitive'
            }
          }
        }
      ],
      competition: {
        sportType: 'FOOTBALL'
      }
    },
    include: {
      homeTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
          sportType: true
        }
      },
      awayTeam: {
        select: {
          id: true,
          name: true,
          shortName: true,
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
    }
  });

  if (!game) {
    console.log('❌ Game not found in database');
    process.exit(1);
  }

  console.log('📊 Game in database:');
  console.log(`   ID: ${game.id}`);
  console.log(`   Status: ${game.status}`);
  console.log(`   External Status: ${game.externalStatus ?? 'null'}`);
  console.log(`   External ID: ${game.externalId ?? 'null'}`);
  console.log(`   Home Team: ${game.homeTeam.name} (${game.homeTeam.shortName ?? 'no shortName'})`);
  console.log(`   Away Team: ${game.awayTeam.name} (${game.awayTeam.shortName ?? 'no shortName'})`);
  console.log(`   Scores: ${game.liveHomeScore ?? game.homeScore ?? 'null'}-${game.liveAwayScore ?? game.awayScore ?? 'null'}`);
  console.log(`   Elapsed: ${game.elapsedMinute ?? 'null'}`);
  console.log(`   Date: ${game.date}`);
  console.log(`   Last Sync: ${game.lastSyncAt?.toISOString() ?? 'null'}`);

  // Check if game is LIVE
  if (game.status !== 'LIVE') {
    console.log(`\n⚠️ Game is not LIVE (status: ${game.status}), so it won't be updated by the API`);
  }

  // Try to find the match in external API
  console.log('\n🔍 Searching in external API...');
  
  // Get live matches
  const liveMatches = await apiSports.getLiveMatches();
  console.log(`   Found ${liveMatches.length} live matches in external API`);
  
  // Try to find by externalId first
  if (game.externalId) {
    const matchById = liveMatches.find(m => m.id.toString() === game.externalId);
    if (matchById) {
      console.log(`\n✅ Found match by externalId (${game.externalId}):`);
      console.log(`   External: ${matchById.homeTeam.name} vs ${matchById.awayTeam.name}`);
      console.log(`   Status: ${matchById.externalStatus}`);
      console.log(`   Elapsed: ${matchById.elapsedMinute ?? 'null'}`);
      console.log(`   Score: ${matchById.score.fullTime.home ?? 'null'}-${matchById.score.fullTime.away ?? 'null'}`);
      return;
    } else {
      console.log(`\n⚠️ Match with externalId ${game.externalId} not found in live matches`);
    }
  }

  // Try team name matching
  console.log('\n🔍 Testing team name matching...');
  const ourTeams = [
    { id: game.homeTeam.id, name: game.homeTeam.name, shortName: game.homeTeam.shortName },
    { id: game.awayTeam.id, name: game.awayTeam.name, shortName: game.awayTeam.shortName }
  ];

  for (const externalMatch of liveMatches) {
    const homeMatch = apiSports.findBestTeamMatch(externalMatch.homeTeam.name, ourTeams);
    const awayMatch = apiSports.findBestTeamMatch(externalMatch.awayTeam.name, ourTeams);
    
    if (homeMatch && awayMatch) {
      console.log(`\n✅ Potential match found:`);
      console.log(`   External: ${externalMatch.homeTeam.name} vs ${externalMatch.awayTeam.name}`);
      console.log(`   Our: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
      console.log(`   Home match: ${homeMatch.team.name} (method: ${homeMatch.method}, score: ${homeMatch.score.toFixed(2)})`);
      console.log(`   Away match: ${awayMatch.team.name} (method: ${awayMatch.method}, score: ${awayMatch.score.toFixed(2)})`);
      console.log(`   Status: ${externalMatch.externalStatus}`);
      console.log(`   Elapsed: ${externalMatch.elapsedMinute ?? 'null'}`);
      console.log(`   Score: ${externalMatch.score.fullTime.home ?? 'null'}-${externalMatch.score.fullTime.away ?? 'null'}`);
      console.log(`   External ID: ${externalMatch.id}`);
      
      // Check if teams match correctly
      const homeMatches = (homeMatch.team.id === game.homeTeam.id && awayMatch.team.id === game.awayTeam.id);
      const awayMatches = (homeMatch.team.id === game.awayTeam.id && awayMatch.team.id === game.homeTeam.id);
      
      if (homeMatches || awayMatches) {
        console.log(`   ✅ Teams match correctly!`);
      } else {
        console.log(`   ⚠️ Teams don't match correctly`);
      }
      return;
    }
  }

  console.log('\n❌ Match not found in external API live matches');
  console.log('   This could mean:');
  console.log('   - The match is not live anymore');
  console.log('   - The match is not in the API response');
  console.log('   - Team name matching failed');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

