/**
 * Script to fix rescheduled rugby games that haven't been updated
 * Fixes: Stade Toulousain vs Pau and RC Toulon vs Montpellier
 */

import { PrismaClient } from '@prisma/client';
import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function fixGame(gameId: string, gameName: string, rugbyAPI: RugbyAPI) {
  console.log(`\n🔧 Fixing: ${gameName}`);
  console.log('─'.repeat(50));

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true
    }
  });

  if (!game) {
    console.log(`❌ Game not found: ${gameId}`);
    return;
  }

  console.log(`📊 Game: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
  console.log(`   Date: ${game.date}`);
  console.log(`   Status: ${game.status}`);
  console.log(`   ExternalId: ${game.externalId || 'none'}`);
  console.log(`   Current Score: ${game.homeScore ?? game.liveHomeScore ?? 'null'}-${game.awayScore ?? game.liveAwayScore ?? 'null'}`);

  let match: any = null;

  // If we have externalId, try to fetch by ID first
  if (game.externalId) {
    try {
      const externalId = parseInt(game.externalId);
      if (!isNaN(externalId)) {
        console.log(`\n🔍 Fetching by External ID: ${externalId}...`);
        match = await rugbyAPI.getMatchById(externalId);
        if (match) {
          console.log(`✅ Found by External ID`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not fetch by External ID:`, error);
    }
  }

  // If not found by ID, search by date and team names
  if (!match) {
    try {
      const gameDate = new Date(game.date);
      const dateStr = gameDate.toISOString().split('T')[0];
      console.log(`\n🔍 Searching by date: ${dateStr}...`);
      
      const matchesByDate = await rugbyAPI.getMatchesByDateRange(dateStr, dateStr);
      console.log(`   Found ${matchesByDate.length} matches on this date`);

      // Try to find matching match by team names
      const matchingMatch = matchesByDate.find(m => {
        const homeMatch = m.homeTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase().split(' ')[0]) ||
                         game.homeTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase().split(' ')[0]) ||
                         (game.homeTeam.name.toLowerCase().includes('toulousain') && m.homeTeam.name.toLowerCase().includes('toulouse')) ||
                         (game.homeTeam.name.toLowerCase().includes('pau') && m.homeTeam.name.toLowerCase().includes('paloise')) ||
                         (game.homeTeam.name.toLowerCase().includes('toulon') && m.homeTeam.name.toLowerCase().includes('toulonnais'));
        const awayMatch = m.awayTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase().split(' ')[0]) ||
                         game.awayTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase().split(' ')[0]) ||
                         (game.awayTeam.name.toLowerCase().includes('toulousain') && m.awayTeam.name.toLowerCase().includes('toulouse')) ||
                         (game.awayTeam.name.toLowerCase().includes('pau') && m.awayTeam.name.toLowerCase().includes('paloise')) ||
                         (game.awayTeam.name.toLowerCase().includes('toulon') && m.awayTeam.name.toLowerCase().includes('toulonnais'));
        return homeMatch && awayMatch;
      });

      // Also try reversed (away/home swapped)
      const matchingMatchReversed = matchesByDate.find(m => {
        const homeMatch = m.awayTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase().split(' ')[0]) ||
                         game.homeTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase().split(' ')[0]) ||
                         (game.homeTeam.name.toLowerCase().includes('toulousain') && m.awayTeam.name.toLowerCase().includes('toulouse')) ||
                         (game.homeTeam.name.toLowerCase().includes('pau') && m.awayTeam.name.toLowerCase().includes('paloise')) ||
                         (game.homeTeam.name.toLowerCase().includes('toulon') && m.awayTeam.name.toLowerCase().includes('toulonnais'));
        const awayMatch = m.homeTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase().split(' ')[0]) ||
                         game.awayTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase().split(' ')[0]) ||
                         (game.awayTeam.name.toLowerCase().includes('toulousain') && m.homeTeam.name.toLowerCase().includes('toulouse')) ||
                         (game.awayTeam.name.toLowerCase().includes('pau') && m.homeTeam.name.toLowerCase().includes('paloise')) ||
                         (game.awayTeam.name.toLowerCase().includes('toulon') && m.homeTeam.name.toLowerCase().includes('toulonnais'));
        return homeMatch && awayMatch;
      });

      match = matchingMatch || matchingMatchReversed;
    } catch (error) {
      console.log(`⚠️ Error searching by date:`, error);
    }
  }

  if (!match) {
    console.log(`❌ Match not found in API`);
    console.log(`   💡 The game may have been rescheduled to a different date`);
    return;
  }

  console.log(`\n✅ Found match in API:`);
  console.log(`   External ID: ${match.id}`);
  console.log(`   Teams: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
  console.log(`   Status: ${match.externalStatus}`);
  console.log(`   Score: ${match.score?.fullTime?.home ?? 'N/A'}-${match.score?.fullTime?.away ?? 'N/A'}`);

  // Determine new status
  let newStatus: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'CANCELLED' = game.status as any;
  if (match.externalStatus === 'FT' || match.externalStatus === 'AET' || match.externalStatus === 'PEN') {
    newStatus = 'FINISHED';
  } else if (match.externalStatus === 'NS' || match.externalStatus === 'TBD' || match.externalStatus === 'POST') {
    newStatus = 'UPCOMING';
  } else if (match.externalStatus === 'CANC' || match.externalStatus === 'SUSP' || match.externalStatus === 'INT') {
    newStatus = 'CANCELLED';
  } else if (match.externalStatus === 'LIVE' || match.externalStatus === '1H' || match.externalStatus === '2H' || match.externalStatus === 'HT') {
    newStatus = 'LIVE';
  }

  const homeScore = match.score?.fullTime?.home ?? null;
  const awayScore = match.score?.fullTime?.away ?? null;

  // Update the game
  await prisma.game.update({
    where: { id: game.id },
    data: {
      externalId: match.id.toString(),
      externalStatus: match.externalStatus,
      status: newStatus,
      homeScore: homeScore,
      awayScore: awayScore,
      liveHomeScore: homeScore,
      liveAwayScore: awayScore,
      elapsedMinute: newStatus === 'LIVE' ? match.elapsedMinute ?? null : null,
      finishedAt: newStatus === 'FINISHED' ? new Date() : null,
      lastSyncAt: new Date()
    }
  });

  console.log(`\n✅ Game updated successfully!`);
  console.log(`   New status: ${newStatus}`);
  console.log(`   External ID: ${match.id}`);
  console.log(`   Scores: ${homeScore ?? 'null'}-${awayScore ?? 'null'}`);

  // If game is finished, recalculate bets
  if (newStatus === 'FINISHED' && homeScore !== null && awayScore !== null) {
    console.log(`\n💰 Recalculating bet points...`);
    const { calculateBetPoints, getScoringSystemForSport } = await import('../lib/scoring-systems');
    const scoringSystem = getScoringSystemForSport(game.competition.sportType || 'RUGBY');
    
    const bets = await prisma.bet.findMany({ where: { gameId: game.id } });
    for (const bet of bets) {
      const points = calculateBetPoints(
        { score1: bet.score1, score2: bet.score2 },
        { home: homeScore, away: awayScore },
        scoringSystem
      );
      await prisma.bet.update({ where: { id: bet.id }, data: { points } });
    }
    console.log(`   ✅ Recalculated ${bets.length} bets`);
  }
}

async function main() {
  console.log('🔧 Fixing rescheduled rugby games...\n');

  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Find the games
  const game1 = await prisma.game.findFirst({
    where: {
      homeTeam: { name: { contains: 'Toulousain', mode: 'insensitive' } },
      awayTeam: { 
        OR: [
          { name: { contains: 'Pau', mode: 'insensitive' } },
          { name: { contains: 'Paloise', mode: 'insensitive' } }
        ]
      },
      competition: { sportType: 'RUGBY' },
      date: { gte: new Date('2026-01-24') }
    },
    orderBy: { date: 'desc' }
  });

  const game2 = await prisma.game.findFirst({
    where: {
      homeTeam: { name: { contains: 'Toulon', mode: 'insensitive' } },
      awayTeam: { name: { contains: 'Montpellier', mode: 'insensitive' } },
      competition: { sportType: 'RUGBY' },
      date: { gte: new Date('2026-01-24') }
    },
    orderBy: { date: 'desc' }
  });

  if (!game1 && !game2) {
    console.error('❌ Games not found');
    process.exit(1);
  }

  if (game1) {
    await fixGame(game1.id, 'Stade Toulousain vs Pau', rugbyAPI);
  }

  if (game2) {
    await fixGame(game2.id, 'RC Toulon vs Montpellier', rugbyAPI);
  }

  console.log('\n✅ All fixes complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
