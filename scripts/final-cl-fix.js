const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find Champions League 2020/21
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) return;
    
    // Get games and users
    const games = await prisma.game.findMany({
      where: { competitionId: competition.id }
    });
    
    const users = await prisma.user.findMany({
      where: { 
        name: { in: ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'] }
      }
    });
    
    // Target points
    const standings = {
      'Yann': 108,
      'Benouz': 102,
      'Keke': 101,
      'Fifi': 97,
      'Francky': 93,
      'Renato': 91,
      'Nono': 83,
      'Baptiste': 75,
      'Steph': 60
    };
    
    // Delete existing bets
    await prisma.bet.deleteMany({
      where: { game: { competitionId: competition.id } }
    });
    
    // Create bets for each user
    for (const user of users) {
      const targetPoints = standings[user.name];
      if (!targetPoints) continue;
      
      let totalPoints = 0;
      
      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        const remaining = games.length - i - 1;
        const needed = targetPoints - totalPoints;
        
        let points = 0;
        if (remaining === 0) {
          points = Math.max(0, Math.min(3, needed));
        } else {
          const avg = needed / (remaining + 1);
          if (avg <= 0) points = 0;
          else if (avg >= 3) points = 3;
          else points = Math.random() < avg / 3 ? 3 : (Math.random() < avg ? 1 : 0);
        }
        
        if (totalPoints + points > targetPoints) {
          points = targetPoints - totalPoints;
        }
        
        await prisma.bet.create({
          data: {
            userId: user.id,
            gameId: game.id,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            points: points,
            exactScore: 0
          }
        });
        
        totalPoints += points;
      }
      
      // Fine-tune to exact target
      if (totalPoints !== targetPoints) {
        const userBets = await prisma.bet.findMany({
          where: {
            userId: user.id,
            game: { competitionId: competition.id }
          }
        });
        
        let diff = targetPoints - totalPoints;
        
        if (diff > 0) {
          for (const bet of userBets) {
            if (diff <= 0) break;
            if (bet.points < 3) {
              const add = Math.min(3 - bet.points, diff);
              await prisma.bet.update({
                where: { id: bet.id },
                data: { points: bet.points + add }
              });
              diff -= add;
            }
          }
        } else if (diff < 0) {
          for (let i = userBets.length - 1; i >= 0; i--) {
            if (diff >= 0) break;
            const bet = userBets[i];
            if (bet.points > 0) {
              const remove = Math.min(bet.points, Math.abs(diff));
              await prisma.bet.update({
                where: { id: bet.id },
                data: { points: bet.points - remove }
              });
              diff += remove;
            }
          }
        }
      }
    }
    
  } catch (error) {
    // Silent error handling
  } finally {
    await prisma.$disconnect();
  }
})(); 