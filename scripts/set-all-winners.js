const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function setAllWinners() {
  const log = [];
  
  try {
    log.push('=== Setting Winners for All Competitions ===');
    
    // Get all competitions
    const competitions = await prisma.competition.findMany({
      include: { winner: true }
    });
    
    log.push(`\nFound ${competitions.length} competitions:`);
    
    for (const competition of competitions) {
      log.push(`\n--- ${competition.name} ---`);
      
      // Get all users with their total points for this competition
      const userPoints = await prisma.user.findMany({
        include: {
          bets: {
            where: {
              game: { competitionId: competition.id }
            }
          }
        }
      });
      
      // Calculate total points for each user
      const standings = userPoints
        .map(user => {
          const totalPoints = user.bets.reduce((sum, bet) => sum + bet.points, 0);
          return {
            user,
            totalPoints,
            betCount: user.bets.length
          };
        })
        .filter(standing => standing.betCount > 0) // Only users who have bets
        .sort((a, b) => b.totalPoints - a.totalPoints); // Sort by points descending
      
      if (standings.length === 0) {
        log.push('❌ No participants found');
        continue;
      }
      
      const winner = standings[0];
      const lastPlace = standings[standings.length - 1];
      log.push(`🏆 Winner should be: ${winner.user.name} with ${winner.totalPoints} points`);
      log.push(`🍽️ Last place should be: ${lastPlace.user.name} with ${lastPlace.totalPoints} points`);
      
      if (
        competition.winner?.id === winner.user.id &&
        competition.lastPlaceId === lastPlace.user.id
      ) {
        log.push(`✅ Winner and last place already set correctly: ${competition.winner.name} / ${lastPlace.user.name}`);
      } else {
        // Always update both winner and last place
        await prisma.competition.update({
          where: { id: competition.id },
          data: {
            winnerId: winner.user.id,
            lastPlaceId: lastPlace.user.id
          }
        });
        log.push(`✅ Updated winner to: ${winner.user.name}`);
        log.push(`✅ Updated last place to: ${lastPlace.user.name}`);
      }
      
      // Show top 3
      log.push('📊 Top 3:');
      standings.slice(0, 3).forEach((standing, index) => {
        log.push(`   ${index + 1}. ${standing.user.name}: ${standing.totalPoints} points`);
      });
    }
    
    log.push('\n🎉 All competition winners have been set!');
    
  } catch (error) {
    log.push(`❌ Error: ${error.message}`);
    log.push(`Stack: ${error.stack}`);
  } finally {
    await prisma.$disconnect();
    fs.writeFileSync('all-winners-update.log', log.join('\n'));
  }
}

setAllWinners(); 