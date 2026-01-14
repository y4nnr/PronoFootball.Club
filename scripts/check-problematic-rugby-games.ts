/**
 * Script to check problematic rugby games and their competitions
 */

import { PrismaClient } from '@prisma/client';
import { RugbyAPI } from '../lib/api-rugby-v1';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking problematic rugby games...\n');

  const apiKey = process.env['API-FOOTBALL'] || process.env['API-RUGBY'];
  if (!apiKey) {
    console.error('❌ API key not found');
    process.exit(1);
  }

  const rugbyAPI = new RugbyAPI(apiKey);

  // Find problematic games
  const games = await prisma.game.findMany({
    where: {
      OR: [
        { homeTeam: { name: { contains: 'Lyon' } } },
        { awayTeam: { name: { contains: 'Lyon' } } },
        { homeTeam: { name: { contains: 'Montpellier' } } },
        { awayTeam: { name: { contains: 'Montpellier' } } }
      ],
      status: 'LIVE',
      competition: {
        sportType: 'RUGBY'
      }
    },
    include: {
      competition: {
        select: {
          id: true,
          name: true,
          externalSeason: true
        }
      },
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
      }
    }
  });

  console.log(`Found ${games.length} problematic games:\n`);

  for (const game of games) {
    console.log(`${game.homeTeam.name} vs ${game.awayTeam.name}`);
    console.log(`  Competition: ${game.competition.name}`);
    console.log(`  External Season: ${game.competition.externalSeason ?? 'null'}`);
    console.log(`  External ID: ${game.externalId ?? 'null'}`);
    console.log(`  External Status: ${game.externalStatus ?? 'null'}`);
    console.log(`  Date: ${game.date}`);
    
    // Try to get competition external ID from competition name or other means
    // For Top 14, the external ID should be 16
    const competitionExternalId = game.competition.name.includes('Top 14') ? 16 : null;
    const season = game.competition.externalSeason || '2025';
    
    if (competitionExternalId) {
      console.log(`  Trying to find in competition ${competitionExternalId}, season ${season}...`);
      try {
        const fixtures = await rugbyAPI.getFixturesByCompetition(competitionExternalId, season);
        const finishedFixtures = fixtures.filter(f => 
          f.fixture.status.short === 'FT' || 
          f.fixture.status.short === 'AET' || 
          f.fixture.status.short === 'PEN'
        );
        console.log(`    Found ${fixtures.length} total fixtures, ${finishedFixtures.length} finished`);
        
        // Convert to RugbyMatch format to check
        const matches = rugbyAPI['mapFixturesToMatches'](finishedFixtures);
        const ourMatch = matches.find(m => m.id === parseInt(game.externalId || '0'));
        if (ourMatch) {
          console.log(`    ✅ Found match in finished fixtures!`);
          console.log(`      Status: ${ourMatch.externalStatus}`);
          console.log(`      Score: ${ourMatch.score.fullTime.home ?? 'N/A'}-${ourMatch.score.fullTime.away ?? 'N/A'}`);
        } else {
          console.log(`    ❌ Match not found in finished fixtures`);
        }
      } catch (error) {
        console.log(`    ❌ Error:`, error);
      }
    }
    console.log('');
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

