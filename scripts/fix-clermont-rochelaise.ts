/**
 * Script to fix Clermont vs Stade Rochelais game
 * Finds the game in external API and updates it with externalId and scores
 */

import { PrismaClient } from '@prisma/client';
import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing Clermont vs Stade Rochelais game...\n');

  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Find the game
  const game = await prisma.game.findFirst({
    where: {
      homeTeam: { name: { contains: 'Clermont', mode: 'insensitive' } },
      awayTeam: { name: { contains: 'Rochelais', mode: 'insensitive' } },
      competition: { sportType: 'RUGBY' },
      status: 'LIVE'
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true
    }
  });

  if (!game) {
    console.error('❌ Game not found in database');
    process.exit(1);
  }

  console.log(`📊 Found game: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
  console.log(`   Game ID: ${game.id}`);
  console.log(`   Date: ${game.date}`);
  console.log(`   Status: ${game.status}`);
  console.log(`   ExternalId: ${game.externalId || 'none'}`);
  console.log(`   Current Score: ${game.homeScore ?? game.liveHomeScore ?? 'null'}-${game.awayScore ?? game.liveAwayScore ?? 'null'}`);
  console.log('');

  // Search for the match in external API by date
  try {
    const gameDate = new Date(game.date);
    const dateStr = gameDate.toISOString().split('T')[0];
    console.log(`🔍 Searching for matches on ${dateStr}...`);
    
    const matchesByDate = await rugbyAPI.getMatchesByDateRange(dateStr, dateStr);
    console.log(`   Found ${matchesByDate.length} matches on this date`);
    
    // Try to find matching match by team names
    const matchingMatch = matchesByDate.find(m => {
      const homeMatch = m.homeTeam.name.toLowerCase().includes('clermont') ||
                       m.homeTeam.name.toLowerCase().includes('asmo') ||
                       game.homeTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase().split(' ')[0]);
      const awayMatch = m.awayTeam.name.toLowerCase().includes('rochelaise') ||
                       m.awayTeam.name.toLowerCase().includes('rochelle') ||
                       game.awayTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase().split(' ')[0]);
      return homeMatch && awayMatch;
    });

    // Also try reversed (away/home swapped)
    const matchingMatchReversed = matchesByDate.find(m => {
      const homeMatch = m.awayTeam.name.toLowerCase().includes('clermont') ||
                       m.awayTeam.name.toLowerCase().includes('asmo') ||
                       game.homeTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase().split(' ')[0]);
      const awayMatch = m.homeTeam.name.toLowerCase().includes('rochelaise') ||
                       m.homeTeam.name.toLowerCase().includes('rochelle') ||
                       game.awayTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase().split(' ')[0]);
      return homeMatch && awayMatch;
    });

    const match = matchingMatch || matchingMatchReversed;

    if (!match) {
      console.log('⚠️ Match not found in API by date/team search');
      console.log('   Available matches on this date:');
      matchesByDate.slice(0, 10).forEach(m => {
        console.log(`   - ${m.homeTeam.name} vs ${m.awayTeam.name} (ID: ${m.id}, Status: ${m.externalStatus})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found match in API:`);
    console.log(`   External ID: ${match.id}`);
    console.log(`   Teams: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    console.log(`   Status: ${match.externalStatus}`);
    console.log(`   Score: ${match.score?.fullTime?.home ?? 'N/A'}-${match.score?.fullTime?.away ?? 'N/A'}`);
    console.log('');

    // Determine new status
    let newStatus: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'CANCELLED' = 'LIVE';
    if (match.externalStatus === 'FT' || match.externalStatus === 'AET' || match.externalStatus === 'PEN') {
      newStatus = 'FINISHED';
    } else if (match.externalStatus === 'NS' || match.externalStatus === 'TBD' || match.externalStatus === 'POST') {
      newStatus = 'UPCOMING';
    } else if (match.externalStatus === 'CANC' || match.externalStatus === 'SUSP' || match.externalStatus === 'INT') {
      newStatus = 'CANCELLED';
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

    console.log(`✅ Game updated successfully!`);
    console.log(`   New status: ${newStatus}`);
    console.log(`   External ID: ${match.id}`);
    console.log(`   Scores: ${homeScore ?? 'null'}-${awayScore ?? 'null'}`);
    console.log('');

    // If game is finished, recalculate bets
    if (newStatus === 'FINISHED' && homeScore !== null && awayScore !== null) {
      console.log('💰 Recalculating bet points...');
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

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('\n✅ Fix complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
