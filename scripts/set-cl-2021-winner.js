const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function setChampionsLeagueWinner() {
  const log = [];
  
  try {
    log.push('=== Setting Champions League 2020/21 Winner ===');
    
    // Find the competition
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) {
      log.push('❌ Competition not found');
      fs.writeFileSync('cl-winner-update.log', log.join('\n'));
      return;
    }
    
    log.push(`✅ Found competition: ${competition.name}`);
    
    // Find Yann (the winner with 108 points)
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    if (!yann) {
      log.push('❌ Yann not found');
      fs.writeFileSync('cl-winner-update.log', log.join('\n'));
      return;
    }
    
    log.push(`✅ Found winner: ${yann.name} (ID: ${yann.id})`);
    
    // Verify Yann's points
    const yannPoints = await prisma.bet.aggregate({
      where: {
        userId: yann.id,
        game: { competitionId: competition.id }
      },
      _sum: { points: true }
    });
    
    log.push(`✅ Yann's points: ${yannPoints._sum.points}`);
    
    // Update the competition to set Yann as winner
    const updatedCompetition = await prisma.competition.update({
      where: { id: competition.id },
      data: { winnerId: yann.id }
    });
    
    log.push(`✅ Updated competition - Winner set to: ${yann.name}`);
    
    // Verify the update
    const verifyCompetition = await prisma.competition.findUnique({
      where: { id: competition.id },
      include: { winner: true }
    });
    
    if (verifyCompetition?.winner) {
      log.push(`✅ Verification: Winner is ${verifyCompetition.winner.name}`);
    } else {
      log.push('❌ Verification failed: No winner set');
    }
    
    log.push('\n🎉 Champions League 2020/21 winner successfully set!');
    
  } catch (error) {
    log.push(`❌ Error: ${error.message}`);
    log.push(`Stack: ${error.stack}`);
  } finally {
    await prisma.$disconnect();
    fs.writeFileSync('cl-winner-update.log', log.join('\n'));
  }
}

setChampionsLeagueWinner(); 