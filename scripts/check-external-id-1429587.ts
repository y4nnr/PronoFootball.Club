/**
 * Check what game has external ID 1429587
 */

import { API_CONFIG } from '../lib/api-config.js';
import { ApiSportsV2 } from '../lib/api-sports-api-v2.js';

async function main() {
  if (!API_CONFIG.apiSportsApiKey) {
    console.error('❌ API-FOOTBALL key not found');
    return;
  }

  const apiSports = new ApiSportsV2(API_CONFIG.apiSportsApiKey);
  
  // Check the external ID from the database
  const externalId = 1429587;
  console.log(`🔍 Checking external ID: ${externalId}\n`);
  
  try {
    const match = await apiSports.getMatchById(externalId);
    
    if (match) {
      console.log('✅ Found match:');
      console.log(`   Teams: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      console.log(`   Status: ${match.status}`);
      console.log(`   External Status: ${match.externalStatus}`);
      console.log(`   Score: ${match.score.fullTime.home} - ${match.score.fullTime.away}`);
      console.log(`   Elapsed: ${match.elapsedMinute}'`);
      console.log(`   Competition: ${match.competition.name}`);
      console.log(`   Date: ${match.utcDate}`);
    } else {
      console.log('❌ Match not found for external ID:', externalId);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
