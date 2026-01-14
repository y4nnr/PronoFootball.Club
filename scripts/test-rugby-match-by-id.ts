/**
 * Test script to fetch specific rugby matches by ID
 */

import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Test the two problematic matches
  const matchIds = [1389707, 1491312]; // Montpellier vs Bayonne, Lyon vs Pau

  for (const id of matchIds) {
    console.log(`\n🔍 Testing match ID: ${id}`);
    try {
      const match = await rugbyAPI.getMatchById(id);
      if (match) {
        console.log(`✅ Found match:`);
        console.log(`   ${match.homeTeam.name} vs ${match.awayTeam.name}`);
        console.log(`   Status: ${match.externalStatus}`);
        console.log(`   Score: ${match.score?.fullTime?.home ?? 'N/A'} - ${match.score?.fullTime?.away ?? 'N/A'}`);
        console.log(`   Elapsed: ${match.elapsedMinute ?? 'N/A'}`);
      } else {
        console.log(`❌ Match not found`);
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
    }
  }
}

main().catch(console.error);

