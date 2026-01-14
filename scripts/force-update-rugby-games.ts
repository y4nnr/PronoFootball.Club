/**
 * Script to force update specific rugby games that are not being detected by the API
 * Forces update for: Lyon vs Pau and Montpellier vs Bayonne
 */

import { PrismaClient } from '@prisma/client';
import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Force updating specific rugby games...\n');

  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Game IDs from the investigation
  const gameIds = [
    { id: 'cmjwpq6vl005lhuj64b5kodnb', externalId: '1389707', name: 'Montpellier vs Aviron Bayonnais' },
    { id: 'cmjwpq6vm005phuj6q59difj7', externalId: '1491312', name: 'Lyon vs Section Paloise' }
  ];

  for (const gameInfo of gameIds) {
    console.log(`\n📊 Processing: ${gameInfo.name}`);
    
    // Get game from database
    const game = await prisma.game.findUnique({
      where: { id: gameInfo.id },
      include: {
        homeTeam: true,
        awayTeam: true,
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
      console.log(`❌ Game not found in database`);
      continue;
    }

    console.log(`   Current status: ${game.status}`);
    console.log(`   External status: ${game.externalStatus ?? 'null'}`);
    console.log(`   Scores: ${game.homeScore ?? game.liveHomeScore ?? 'null'}-${game.awayScore ?? game.liveAwayScore ?? 'null'}`);

    // Try to fetch from API by ID first, then by date
    try {
      const externalId = parseInt(gameInfo.externalId);
      console.log(`   Fetching from API with ID ${externalId}...`);
      let match = await rugbyAPI.getMatchById(externalId);
      
      // If not found by ID, try by date
      if (!match) {
        console.log(`   Not found by ID, trying by date...`);
        const gameDate = new Date(game.date);
        const dateStr = gameDate.toISOString().split('T')[0];
        const matchesByDate = await rugbyAPI.getMatchesByDateRange(dateStr, dateStr);
        
        // Find match by team names
        match = matchesByDate.find(m => 
          (m.homeTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase().split(' ')[0]) ||
           m.awayTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase().split(' ')[0])) &&
          (m.homeTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase().split(' ')[0]) ||
           m.awayTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase().split(' ')[0]))
        ) || null;
      }
      
      if (match) {
        console.log(`   ✅ Found in API:`);
        console.log(`      Status: ${match.externalStatus}`);
        console.log(`      Score: ${match.score.fullTime.home ?? 'N/A'}-${match.score.fullTime.away ?? 'N/A'}`);
        
        // Update the game
        const newStatus = match.status as 'LIVE' | 'FINISHED' | 'UPCOMING' | 'CANCELLED'; // Already mapped by RugbyAPI
        const homeScore = match.score.fullTime.home;
        const awayScore = match.score.fullTime.away;
        
        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: newStatus,
            externalStatus: match.externalStatus,
            homeScore: homeScore,
            awayScore: awayScore,
            liveHomeScore: homeScore,
            liveAwayScore: awayScore,
            elapsedMinute: null,
            finishedAt: newStatus === 'FINISHED' ? new Date() : null,
            lastSyncAt: new Date()
          }
        });
        
        console.log(`   ✅ Updated game to status: ${newStatus}, scores: ${homeScore}-${awayScore}`);
      } else {
        console.log(`   ⚠️ Match not found in API - may be too old or ID incorrect`);
        console.log(`   💡 You may need to manually update this game or check if the externalId is correct`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }

  console.log('\n✅ Force update complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

