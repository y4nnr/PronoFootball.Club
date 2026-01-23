/**
 * Script to check the score and game status of Galatasaray vs Atletico Madrid
 */

import { PrismaClient } from '@prisma/client';
import { API_CONFIG } from '../lib/api-config.js';
import { ApiSportsV2 } from '../lib/api-sports-api-v2.js';
import { FootballDataAPI } from '../lib/football-data-api.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Galatasaray vs Atletico Madrid game...\n');

  // First, check in our database
  const dbGames = await prisma.game.findMany({
    where: {
      OR: [
        {
          AND: [
            { homeTeam: { name: { contains: 'Galatasaray', mode: 'insensitive' } } },
            { awayTeam: { name: { contains: 'Atletico', mode: 'insensitive' } } }
          ]
        },
        {
          AND: [
            { homeTeam: { name: { contains: 'Atletico', mode: 'insensitive' } } },
            { awayTeam: { name: { contains: 'Galatasaray', mode: 'insensitive' } } }
          ]
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
    },
    take: 5
  });

  console.log(`📊 Found ${dbGames.length} game(s) in database:\n`);
  
  for (const game of dbGames) {
    console.log(`Game ID: ${game.id}`);
    console.log(`Competition: ${game.competition.name}`);
    console.log(`Teams: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
    console.log(`Date: ${game.date.toISOString()}`);
    console.log(`Status: ${game.status}`);
    console.log(`External Status: ${game.externalStatus || 'N/A'}`);
    console.log(`Score: ${game.homeScore ?? game.liveHomeScore ?? '-'} - ${game.awayScore ?? game.liveAwayScore ?? '-'}`);
    console.log(`Live Score: ${game.liveHomeScore ?? '-'} - ${game.liveAwayScore ?? '-'}`);
    console.log(`Elapsed Minute: ${game.elapsedMinute ?? 'N/A'}`);
    console.log(`External ID: ${game.externalId || 'N/A'}`);
    console.log(`Last Sync: ${game.lastSyncAt ? game.lastSyncAt.toISOString() : 'Never'}`);
    console.log('---\n');
  }

  // Now check external API
  console.log('🌐 Checking external API...\n');

  let apiMatches: any[] = [];

  if (API_CONFIG.useV2) {
    // Use V2 API (api-sports.io)
    if (!API_CONFIG.apiSportsApiKey) {
      console.error('❌ API-FOOTBALL key not found');
      return;
    }

    const apiSports = new ApiSportsV2(API_CONFIG.apiSportsApiKey);
    
    // Get today's matches
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Fetching matches from ${todayStr} to ${tomorrowStr}...`);
    
    try {
      const matches = await apiSports.getMatchesByDateRange(todayStr, tomorrowStr);
      
      // Filter for Galatasaray vs Atletico
      apiMatches = matches.filter(match => {
        const homeName = match.homeTeam.name.toLowerCase();
        const awayName = match.awayTeam.name.toLowerCase();
        return (
          (homeName.includes('galatasaray') || homeName.includes('galatasaray')) &&
          (awayName.includes('atletico') || awayName.includes('atlético') || awayName.includes('atletico madrid'))
        ) || (
          (homeName.includes('atletico') || homeName.includes('atlético') || homeName.includes('atletico madrid')) &&
          (awayName.includes('galatasaray') || awayName.includes('galatasaray'))
        );
      });
    } catch (error: any) {
      console.error('❌ Error fetching from API-Sports.io:', error.message);
    }
  } else {
    // Use V1 API (football-data.org)
    if (!API_CONFIG.footballDataApiKey) {
      console.error('❌ FOOTBALL_DATA_API_KEY not found');
      return;
    }

    const footballAPI = new FootballDataAPI(API_CONFIG.footballDataApiKey);
    
    // Get today's matches
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Fetching matches from ${todayStr} to ${tomorrowStr}...`);
    
    try {
      const matches = await footballAPI.getMatchesByDateRange(todayStr, tomorrowStr);
      
      // Filter for Galatasaray vs Atletico
      apiMatches = matches.filter(match => {
        const homeName = match.homeTeam.name.toLowerCase();
        const awayName = match.awayTeam.name.toLowerCase();
        return (
          (homeName.includes('galatasaray') || homeName.includes('galatasaray')) &&
          (awayName.includes('atletico') || awayName.includes('atlético') || awayName.includes('atletico madrid'))
        ) || (
          (homeName.includes('atletico') || homeName.includes('atlético') || homeName.includes('atletico madrid')) &&
          (awayName.includes('galatasaray') || awayName.includes('galatasaray'))
        );
      });
    } catch (error: any) {
      console.error('❌ Error fetching from Football-Data.org:', error.message);
    }
  }

  if (apiMatches.length > 0) {
    console.log(`✅ Found ${apiMatches.length} match(es) in external API:\n`);
    
    for (const match of apiMatches) {
      // Extract score from different possible structures
      const homeScore = match.score?.fullTime?.home ?? match.goals?.home ?? match.homeScore ?? '-';
      const awayScore = match.score?.fullTime?.away ?? match.goals?.away ?? match.awayScore ?? '-';
      const liveHomeScore = match.score?.live?.home ?? match.liveHomeScore ?? '-';
      const liveAwayScore = match.score?.live?.away ?? match.liveAwayScore ?? '-';
      
      console.log(`Match ID: ${match.id || match.fixture?.id || 'N/A'}`);
      console.log(`Competition: ${match.competition?.name || 'N/A'}`);
      console.log(`Teams: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      console.log(`Date: ${match.date || match.utcDate || match.fixture?.date || 'N/A'}`);
      console.log(`Status: ${match.status || match.fixture?.status?.long || 'N/A'}`);
      console.log(`External Status: ${match.externalStatus || match.fixture?.status?.short || 'N/A'}`);
      console.log(`Full Time Score: ${homeScore} - ${awayScore}`);
      console.log(`Live Score: ${liveHomeScore !== '-' ? liveHomeScore : homeScore} - ${liveAwayScore !== '-' ? liveAwayScore : awayScore}`);
      console.log(`Elapsed: ${match.elapsedMinute ?? match.fixture?.status?.elapsed ?? 'N/A'}'`);
      console.log('---\n');
    }
  } else {
    console.log('⚠️ No matches found in external API for today/tomorrow');
    console.log('   (The game might be scheduled for a different date)');
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
