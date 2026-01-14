/**
 * Script to test different methods to retrieve finished rugby games from the API
 */

import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🔍 Testing different methods to retrieve finished rugby games from API...\n');

  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Problematic games
  const problematicGames = [
    { name: 'Lyon vs Section Paloise', externalId: 1491312 },
    { name: 'Montpellier vs Aviron Bayonnais', externalId: 1389707 }
  ];

  for (const game of problematicGames) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${game.name} (ID: ${game.externalId})`);
    console.log('='.repeat(60));

    // Method 1: Get by ID
    console.log('\n📋 Method 1: Get by ID');
    try {
      const matchById = await rugbyAPI.getMatchById(game.externalId);
      if (matchById) {
        console.log(`✅ Found by ID:`);
        console.log(`   Status: ${matchById.externalStatus}`);
        console.log(`   Score: ${matchById.score.fullTime.home ?? 'N/A'}-${matchById.score.fullTime.away ?? 'N/A'}`);
      } else {
        console.log(`❌ Not found by ID`);
      }
    } catch (error) {
      console.log(`❌ Error:`, error);
    }

    // Method 2: Get by date range (today)
    console.log('\n📋 Method 2: Get by date range (today)');
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const matches = await rugbyAPI.getMatchesByDateRange(todayStr, todayStr);
      const finished = matches.filter(m => 
        m.externalStatus === 'FT' || m.externalStatus === 'AET' || m.externalStatus === 'PEN'
      );
      const ourMatch = finished.find(m => m.id === game.externalId);
      if (ourMatch) {
        console.log(`✅ Found in today's finished matches:`);
        console.log(`   Status: ${ourMatch.externalStatus}`);
        console.log(`   Score: ${ourMatch.score.fullTime.home ?? 'N/A'}-${ourMatch.score.fullTime.away ?? 'N/A'}`);
      } else {
        console.log(`❌ Not found in today's finished matches (found ${finished.length} finished matches today)`);
      }
    } catch (error) {
      console.log(`❌ Error:`, error);
    }

    // Method 3: Get by date range (yesterday)
    console.log('\n📋 Method 3: Get by date range (yesterday)');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const matches = await rugbyAPI.getMatchesByDateRange(yesterdayStr, yesterdayStr);
      const finished = matches.filter(m => 
        m.externalStatus === 'FT' || m.externalStatus === 'AET' || m.externalStatus === 'PEN'
      );
      const ourMatch = finished.find(m => m.id === game.externalId);
      if (ourMatch) {
        console.log(`✅ Found in yesterday's finished matches:`);
        console.log(`   Status: ${ourMatch.externalStatus}`);
        console.log(`   Score: ${ourMatch.score.fullTime.home ?? 'N/A'}-${ourMatch.score.fullTime.away ?? 'N/A'}`);
      } else {
        console.log(`❌ Not found in yesterday's finished matches (found ${finished.length} finished matches yesterday)`);
      }
    } catch (error) {
      console.log(`❌ Error:`, error);
    }

    // Method 4: Get live matches (maybe finished games are still in live?)
    console.log('\n📋 Method 4: Get live matches');
    try {
      const liveMatches = await rugbyAPI.getLiveMatches();
      const ourMatch = liveMatches.find(m => m.id === game.externalId);
      if (ourMatch) {
        console.log(`✅ Found in live matches:`);
        console.log(`   Status: ${ourMatch.externalStatus}`);
        console.log(`   Score: ${ourMatch.score.fullTime.home ?? 'N/A'}-${ourMatch.score.fullTime.away ?? 'N/A'}`);
      } else {
        console.log(`❌ Not found in live matches (found ${liveMatches.length} live matches)`);
      }
    } catch (error) {
      console.log(`❌ Error:`, error);
    }

    // Method 5: Try different date ranges
    console.log('\n📋 Method 5: Get by date range (last 3 days)');
    try {
      const today = new Date();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const startStr = threeDaysAgo.toISOString().split('T')[0];
      const endStr = today.toISOString().split('T')[0];
      const matches = await rugbyAPI.getMatchesByDateRange(startStr, endStr);
      const finished = matches.filter(m => 
        m.externalStatus === 'FT' || m.externalStatus === 'AET' || m.externalStatus === 'PEN'
      );
      const ourMatch = finished.find(m => m.id === game.externalId);
      if (ourMatch) {
        console.log(`✅ Found in last 3 days finished matches:`);
        console.log(`   Status: ${ourMatch.externalStatus}`);
        console.log(`   Score: ${ourMatch.score.fullTime.home ?? 'N/A'}-${ourMatch.score.fullTime.away ?? 'N/A'}`);
        console.log(`   Date: ${ourMatch.utcDate}`);
      } else {
        console.log(`❌ Not found in last 3 days finished matches (found ${finished.length} finished matches)`);
        if (finished.length > 0) {
          console.log(`   Sample finished matches:`);
          finished.slice(0, 5).forEach(m => {
            console.log(`      ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.externalStatus}, ID: ${m.id}, Date: ${m.utcDate})`);
          });
        }
      }
    } catch (error) {
      console.log(`❌ Error:`, error);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary: Testing if we can find finished games by league/season');
  console.log('='.repeat(60));

  // Method 6: Try to get games by league and season (Top 14, season 2025)
  console.log('\n📋 Method 6: Get games by league and season (Top 14, season 2025)');
  try {
    // Test getFixturesByCompetition which might return all games including finished ones
    const fixtures = await rugbyAPI.getFixturesByCompetition(16, '2025'); // Top 14, season 2025
    console.log(`   Found ${fixtures.length} total fixtures`);
    
    // Check status distribution
    const statusCounts: { [key: string]: number } = {};
    fixtures.forEach(f => {
      statusCounts[f.externalStatus] = (statusCounts[f.externalStatus] || 0) + 1;
    });
    console.log(`   Status distribution:`, statusCounts);
    
    const finished = fixtures.filter(f => 
      f.externalStatus === 'FT' || f.externalStatus === 'AET' || f.externalStatus === 'PEN'
    );
    console.log(`   Found ${finished.length} finished fixtures (FT/AET/PEN)`);
    
    // Also check by ID in all fixtures
    console.log(`   Checking if problematic games are in fixtures by ID...`);
    for (const game of problematicGames) {
      const matchById = fixtures.find(f => f.id === game.externalId);
      if (matchById) {
        console.log(`   ✅ Found ${game.name} in fixtures:`);
        console.log(`      Status: ${matchById.externalStatus}, Mapped: ${matchById.status}`);
      } else {
        console.log(`   ❌ ${game.name} (ID: ${game.externalId}) not found in fixtures`);
      }
    }
    
    for (const game of problematicGames) {
      const ourMatch = finished.find(m => m.id === game.externalId);
      if (ourMatch) {
        console.log(`   ✅ Found ${game.name} in fixtures:`);
        console.log(`      Status: ${ourMatch.externalStatus}`);
        console.log(`      Score: ${ourMatch.score.fullTime.home ?? 'N/A'}-${ourMatch.score.fullTime.away ?? 'N/A'}`);
      } else {
        console.log(`   ❌ ${game.name} not found in fixtures`);
      }
    }
    
    if (finished.length > 0) {
      console.log(`   Sample finished fixtures (first 5):`);
      finished.slice(0, 5).forEach(f => {
        console.log(`      ${f.homeTeam.name} vs ${f.awayTeam.name} (${f.externalStatus}, ID: ${f.id})`);
      });
    }
  } catch (error) {
    console.log(`❌ Error:`, error);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });

