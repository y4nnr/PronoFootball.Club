const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChampionsLeague2021() {
  try {
    console.log('🔍 Starting Champions League 2020/21 fix...');
    
    // Find the competition
    const competition = await prisma.competition.findFirst({
      where: { 
        name: { contains: '2020/21' }
      }
    });
    
    if (!competition) {
      console.log('❌ Competition not found');
      return;
    }
    
    console.log(`✅ Found competition: ${competition.name} (ID: ${competition.id})`);
    
    // Get all games
    const games = await prisma.game.findMany({
      where: { competitionId: competition.id },
      orderBy: { date: 'asc' }
    });
    
    console.log(`✅ Found ${games.length} games`);
    
    // Get users
    const userNames = ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'];
    const users = await prisma.user.findMany({
      where: { name: { in: userNames } }
    });
    
    console.log(`✅ Found ${users.length} users: ${users.map(u => u.name).join(', ')}`);
    
    // Target standings
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
    console.log('🗑️ Deleting existing bets...');
    const deleteResult = await prisma.bet.deleteMany({
      where: { 
        game: { 
          competitionId: competition.id 
        } 
      }
    });
    console.log(`✅ Deleted ${deleteResult.count} existing bets`);
    
    // Create bets for each user
    for (const user of users) {
      const targetPoints = standings[user.name];
      if (!targetPoints) {
        console.log(`⚠️ No target points for ${user.name}, skipping`);
        continue;
      }
      
      console.log(`📊 Creating bets for ${user.name} (target: ${targetPoints} points)`);
      
      let totalPoints = 0;
      const betsToCreate = [];
      
      // First pass: distribute points strategically
      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        const remaining = games.length - i - 1;
        const needed = targetPoints - totalPoints;
        
        let points = 0;
        
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
            // Weighted random distribution
            const rand = Math.random();
            if (avg < 1) {
              points = rand < 0.7 ? 0 : 1;
            } else if (avg < 2) {
              points = rand < 0.3 ? 0 : (rand < 0.7 ? 1 : 3);
            } else {
              points = rand < 0.6 ? 3 : (rand < 0.8 ? 1 : 0);
            }
          }
        }
        
        // Ensure we don't exceed target
        if (totalPoints + points > targetPoints) {
          points = Math.max(0, targetPoints - totalPoints);
        }
        
        betsToCreate.push({
          userId: user.id,
          gameId: game.id,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          points: points,
          exactScore: 0
        });
        
        totalPoints += points;
      }
      
      // Create all bets for this user
      console.log(`📝 Creating ${betsToCreate.length} bets for ${user.name}...`);
      await prisma.bet.createMany({
        data: betsToCreate
      });
      
      console.log(`✅ ${user.name}: Created ${betsToCreate.length} bets, total points: ${totalPoints}`);
      
      // Fine-tune if needed
      if (totalPoints !== targetPoints) {
        console.log(`🔧 Adjusting ${user.name} from ${totalPoints} to ${targetPoints}`);
        
        const userBets = await prisma.bet.findMany({
          where: {
            userId: user.id,
            game: { competitionId: competition.id }
          },
          orderBy: { id: 'asc' }
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
        
        console.log(`✅ ${user.name}: Final total ${finalTotal._sum.points} points`);
      }
    }
    
    console.log('\n🎉 Champions League 2020/21 betting data created successfully!');
    
    // Final verification
    console.log('\n📊 Final standings verification:');
    for (const user of users) {
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
      
      const targetPoints = standings[user.name] || 0;
      const actualPointsValue = actualPoints._sum.points || 0;
      const status = actualPointsValue === targetPoints ? '✅' : '❌';
      
      console.log(`${status} ${user.name}: ${actualPointsValue} points (target: ${targetPoints}), ${betCount} bets`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixChampionsLeague2021(); 