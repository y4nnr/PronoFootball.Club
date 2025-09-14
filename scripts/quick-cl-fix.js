const { PrismaClient } = require('@prisma/client');

async function quickFix() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Starting Champions League 2020/21 fix...');
    
    // Find the competition
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) {
      console.log('No Champions League 2020/21 found');
      process.exit(1);
    }
    
    console.log('Found competition:', competition.name);
    
    // Check current data
    const gameCount = await prisma.game.count({
      where: { competitionId: competition.id }
    });
    
    const betCount = await prisma.bet.count({
      where: { game: { competitionId: competition.id } }
    });
    
    console.log(`Current: ${gameCount} games, ${betCount} bets`);
    
    // If no data, we need to create it
    if (gameCount === 0 || betCount === 0) {
      console.log('Creating data...');
      
      // Get users
      const userNames = ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'];
      const users = await prisma.user.findMany({
        where: { name: { in: userNames } }
      });
      
      console.log('Found users:', users.length);
      
      // Add users to competition if not already added
      for (const user of users) {
        await prisma.competitionUser.upsert({
          where: {
            competitionId_userId: {
              competitionId: competition.id,
              userId: user.id
            }
          },
          update: {},
          create: {
            competitionId: competition.id,
            userId: user.id
          }
        });
      }
      
      console.log('Added users to competition');
      
      // Get club teams
      const clubTeams = await prisma.team.findMany({
        where: { category: 'CLUB' },
        take: 32
      });
      
      console.log('Found club teams:', clubTeams.length);
      
      // Create games if needed
      if (gameCount === 0) {
        console.log('Creating 125 games...');
        for (let i = 0; i < 125; i++) {
          const homeTeam = clubTeams[i % clubTeams.length];
          const awayTeam = clubTeams[(i + 1) % clubTeams.length];
          
          await prisma.game.create({
            data: {
              competitionId: competition.id,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              date: new Date(2020, 8, 20 + Math.floor(i / 5)),
              status: 'FINISHED',
              homeScore: Math.floor(Math.random() * 4),
              awayScore: Math.floor(Math.random() * 4)
            }
          });
        }
        console.log('Created 125 games');
      }
      
      // Get all games
      const games = await prisma.game.findMany({
        where: { competitionId: competition.id }
      });
      
      console.log('Total games:', games.length);
      
      // Create bets with target points
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
      
      console.log('Creating bets...');
      
      for (const standing of standings) {
        const user = users.find(u => u.name === standing.name);
        if (!user) continue;
        
        console.log(`Creating bets for ${user.name}...`);
        
        // Delete existing bets for this user in this competition
        await prisma.bet.deleteMany({
          where: {
            userId: user.id,
            game: { competitionId: competition.id }
          }
        });
        
        let totalPoints = 0;
        const targetPoints = standing.points;
        
        for (let i = 0; i < games.length; i++) {
          const game = games[i];
          
          // Simple point distribution
          let points = 0;
          const remaining = games.length - i - 1;
          const needed = targetPoints - totalPoints;
          
          if (remaining === 0) {
            points = Math.max(0, Math.min(3, needed));
          } else {
            const avg = needed / (remaining + 1);
            if (avg <= 0) points = 0;
            else if (avg >= 3) points = 3;
            else if (avg < 1) points = Math.random() < 0.7 ? 0 : 1;
            else if (avg < 2) points = Math.random() < 0.5 ? 1 : (Math.random() < 0.8 ? 0 : 3);
            else points = Math.random() < 0.6 ? 3 : 1;
          }
          
          if (totalPoints + points > targetPoints) {
            points = Math.max(0, targetPoints - totalPoints);
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
        
        console.log(`${user.name}: ${totalPoints} points`);
      }
      
      console.log('✅ Champions League 2020/21 fixed!');
    } else {
      console.log('Data already exists');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

quickFix(); 