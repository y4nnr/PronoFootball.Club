/**
 * Script to check bets for Montpellier vs Aviron Bayonnais game
 */

import { PrismaClient } from '@prisma/client';
import { calculateBetPoints, getScoringSystemForSport } from '../lib/scoring-systems';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking bets for Montpellier vs Aviron Bayonnais...\n');

  // Find the game
  const game = await prisma.game.findFirst({
    where: {
      OR: [
        {
          homeTeam: {
            name: {
              contains: 'Montpellier',
              mode: 'insensitive'
            }
          },
          awayTeam: {
            name: {
              contains: 'Bayonne',
              mode: 'insensitive'
            }
          }
        },
        {
          homeTeam: {
            name: {
              contains: 'Bayonne',
              mode: 'insensitive'
            }
          },
          awayTeam: {
            name: {
              contains: 'Montpellier',
              mode: 'insensitive'
            }
          }
        }
      ],
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
          name: true,
          sportType: true
        }
      },
      bets: {
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  if (!game) {
    console.log('❌ Game not found');
    return;
  }

  console.log(`📊 Game: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
  console.log(`   Status: ${game.status}`);
  console.log(`   Score: ${game.homeScore ?? game.liveHomeScore ?? 'N/A'}-${game.awayScore ?? game.liveAwayScore ?? 'N/A'}`);
  console.log(`   Competition: ${game.competition.name} (${game.competition.sportType})`);
  console.log(`   Number of bets: ${game.bets.length}\n`);

  const actualScore = {
    home: game.homeScore ?? game.liveHomeScore ?? 0,
    away: game.awayScore ?? game.liveAwayScore ?? 0
  };

  const scoringSystem = getScoringSystemForSport(game.competition.sportType || 'RUGBY');
  console.log(`   Scoring system: ${scoringSystem}\n`);

  console.log('📊 Bets analysis:\n');
  for (const bet of game.bets) {
    const betScore = {
      score1: bet.score1,
      score2: bet.score2
    };

    // Calculate points using the scoring system
    const calculatedPoints = calculateBetPoints(
      betScore,
      actualScore,
      scoringSystem
    );

    // Manual calculation for verification
    const homeDiff = Math.abs(bet.score1 - actualScore.home);
    const awayDiff = Math.abs(bet.score2 - actualScore.away);
    const totalDiff = homeDiff + awayDiff;
    
    const actualResult = actualScore.home > actualScore.away ? 'home' :
                         actualScore.home < actualScore.away ? 'away' : 'draw';
    const predictedResult = bet.score1 > bet.score2 ? 'home' :
                            bet.score1 < bet.score2 ? 'away' : 'draw';

    console.log(`👤 ${bet.user.name}:`);
    console.log(`   Pari: ${bet.score1}-${bet.score2}`);
    console.log(`   Réel: ${actualScore.home}-${actualScore.away}`);
    console.log(`   Différence: ${homeDiff} + ${awayDiff} = ${totalDiff}`);
    console.log(`   Résultat prédit: ${predictedResult}, Réel: ${actualResult}`);
    console.log(`   Points en DB: ${bet.points}`);
    console.log(`   Points calculés: ${calculatedPoints}`);
    
    if (bet.points !== calculatedPoints) {
      console.log(`   ⚠️ INCOHÉRENCE ! Points en DB (${bet.points}) ≠ Points calculés (${calculatedPoints})`);
    } else {
      console.log(`   ✅ Points corrects`);
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

