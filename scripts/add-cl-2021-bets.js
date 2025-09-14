const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addBetsToChampionsLeague2021() {
  try {
    // Find Champions League 2020/21
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) {
      console.log('Competition not found');
      return;
    }
    
    // Get all games for this competition
    const games = await prisma.game.findMany({
      where: { competitionId: competition.id }
    });
    
    console.log(`Found ${games.length} games`);
    
    // Get users
    const userNames = ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'];
    const users = await prisma.user.findMany({
      where: { name: { in: userNames } }
    });
    
    console.log(`Found ${users.length} users`);
    
    // Target points for each user
    const standings = [
      { name: 'Yann', points: 108 },
      { name: 'Benouz', points: 102 },
      { name: 'Keke', points: 101 },
      { name: 'Fifi', points: 97 },
      { name: 'Francky', points: 93 },
      { name: 'Renato', points: 91 },
      { name: 'Nono', points: 83 },
      { name: 'Baptiste', points: 75 },
      { name: 'Steph', points: 60 }
    ];
    
    // Delete any existing bets first
    await prisma.bet.deleteMany({
      where: { game: { competitionId: competition.id } }
    });
    
    console.log('Deleted existing bets');
    
    // Create bets for each user
    for (const standing of standings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) {
        console.log(`User ${standing.name} not found`);
        continue;
      }
      
      console.log(`Creating bets for ${user.name} (target: ${standing.points} points)`);
      
      let totalPoints = 0;
      const targetPoints = standing.points;
      
      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        let points = 0;
        
        // Calculate points needed
        const remaining = games.length - i - 1;
        const needed = targetPoints - totalPoints;
        
        if (remaining === 0) {
          // Last game - assign exact points needed
          points = Math.max(0, Math.min(3, needed));
        } else {
          // Strategic distribution
          const avg = needed / (remaining + 1);
          
          if (avg <= 0) {
            points = 0;
          } else if (avg >= 3) {
            points = 3;
          } else {
            // Random distribution based on average needed
            const rand = Math.random();
            if (avg < 1) {
              points = rand < 0.8 ? 0 : 1;
            } else if (avg < 2) {
              points = rand < 0.4 ? 1 : (rand < 0.7 ? 0 : 3);
            } else {
              points = rand < 0.6 ? 3 : 1;
            }
          }
        }
        
        // Ensure we don't exceed target
        if (totalPoints + points > targetPoints) {
          points = Math.max(0, targetPoints - totalPoints);
        }
        
        // Create the bet
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
      
      console.log(`${user.name}: Created ${games.length} bets, total points: ${totalPoints}`);
      
      // Fine-tune if needed
      if (totalPoints !== targetPoints) {
        console.log(`Adjusting ${user.name} from ${totalPoints} to ${targetPoints}`);
        
        const userBets = await prisma.bet.findMany({
          where: {
            userId: user.id,
            game: { competitionId: competition.id }
          }
        });
        
        let difference = targetPoints - totalPoints;
        
        if (difference > 0) {
          // Need to add points
          for (let i = 0; i < userBets.length && difference > 0; i++) {
            const bet = userBets[i];
            if (bet.points < 3) {
              const addPoints = Math.min(3 - bet.points, difference);
              await prisma.bet.update({
                where: { id: bet.id },
                data: { points: bet.points + addPoints }
              });
              difference -= addPoints;
            }
          }
        } else if (difference < 0) {
          // Need to remove points
          for (let i = userBets.length - 1; i >= 0 && Math.abs(difference) > 0; i--) {
            const bet = userBets[i];
            if (bet.points > 0) {
              const removePoints = Math.min(bet.points, Math.abs(difference));
              await prisma.bet.update({
                where: { id: bet.id },
                data: { points: bet.points - removePoints }
              });
              difference += removePoints;
            }
          }
        }
        
        // Verify final total
        const finalTotal = await prisma.bet.aggregate({
          where: {
            userId: user.id,
            game: { competitionId: competition.id }
          },
          _sum: { points: true }
        });
        
        console.log(`${user.name}: Final total ${finalTotal._sum.points} points`);
      }
    }
    
    console.log('✅ Betting data created successfully!');
    
    // Final verification
    console.log('\nFinal standings:');
    for (const standing of standings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) continue;
      
      const actualPoints = await prisma.bet.aggregate({
        where: {
          userId: user.id,
          game: { competitionId: competition.id }
        },
        _sum: { points: true }
      });
      
      const betCount = await prisma.bet.count({
        where: {
          userId: user.id,
          game: { competitionId: competition.id }
        }
      });
      
      console.log(`${user.name}: ${actualPoints._sum.points || 0} points, ${betCount} bets`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addBetsToChampionsLeague2021(); 