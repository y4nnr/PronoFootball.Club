const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function directFix() {
  console.log('=== DIRECT FIX START ===');
  
  try {
    // Step 1: Find Champions League 2020/21
    console.log('Step 1: Finding Champions League 2020/21...');
    const competitions = await prisma.competition.findMany();
    console.log('All competitions:', competitions.map(c => c.name));
    
    const cl2021 = competitions.find(c => c.name.includes('2020/21'));
    if (!cl2021) {
      console.log('ERROR: No Champions League 2020/21 found');
      return;
    }
    
    console.log('Found:', cl2021.name, cl2021.id);
    
    // Step 2: Check current state
    console.log('Step 2: Checking current state...');
    const games = await prisma.game.findMany({
      where: { competitionId: cl2021.id },
      include: { homeTeam: true, awayTeam: true }
    });
    
    console.log('Current games:', games.length);
    if (games.length > 0) {
      console.log('Sample game:', games[0].homeTeam.name, 'vs', games[0].awayTeam.name);
      console.log('Home team category:', games[0].homeTeam.category);
      console.log('Away team category:', games[0].awayTeam.category);
    }
    
    const bets = await prisma.bet.findMany({
      where: { game: { competitionId: cl2021.id } }
    });
    console.log('Current bets:', bets.length);
    
    // Step 3: Clean up if needed
    if (games.length > 0 && games[0].homeTeam.category === 'NATIONAL') {
      console.log('Step 3: Cleaning up national team games...');
      await prisma.bet.deleteMany({
        where: { game: { competitionId: cl2021.id } }
      });
      await prisma.game.deleteMany({
        where: { competitionId: cl2021.id }
      });
      console.log('Cleaned up national team games');
    }
    
    // Step 4: Get club teams
    console.log('Step 4: Getting club teams...');
    const clubTeams = await prisma.team.findMany({
      where: { category: 'CLUB' },
      take: 32
    });
    console.log('Club teams found:', clubTeams.length);
    
    // Step 5: Create games if needed
    const currentGameCount = await prisma.game.count({
      where: { competitionId: cl2021.id }
    });
    
    if (currentGameCount < 125) {
      console.log('Step 5: Creating 125 games...');
      
      // Delete existing games first
      await prisma.game.deleteMany({
        where: { competitionId: cl2021.id }
      });
      
      for (let i = 0; i < 125; i++) {
        const homeIdx = i % clubTeams.length;
        const awayIdx = (i + 1) % clubTeams.length;
        
        await prisma.game.create({
          data: {
            competitionId: cl2021.id,
            homeTeamId: clubTeams[homeIdx].id,
            awayTeamId: clubTeams[awayIdx].id,
            date: new Date(2020, 8, 20 + Math.floor(i / 5)),
            status: 'FINISHED',
            homeScore: Math.floor(Math.random() * 4),
            awayScore: Math.floor(Math.random() * 4)
          }
        });
        
        if (i % 25 === 0) {
          console.log(`Created ${i + 1} games...`);
        }
      }
      console.log('Created 125 games');
    }
    
    // Step 6: Get users and add to competition
    console.log('Step 6: Setting up users...');
    const userNames = ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'];
    const users = await prisma.user.findMany({
      where: { name: { in: userNames } }
    });
    console.log('Users found:', users.map(u => u.name));
    
    // Add users to competition
    for (const user of users) {
      await prisma.competitionUser.upsert({
        where: {
          competitionId_userId: {
            competitionId: cl2021.id,
            userId: user.id
          }
        },
        update: {},
        create: {
          competitionId: cl2021.id,
          userId: user.id
        }
      });
    }
    console.log('Users added to competition');
    
    // Step 7: Create bets with exact points
    console.log('Step 7: Creating bets...');
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
    
    const allGames = await prisma.game.findMany({
      where: { competitionId: cl2021.id }
    });
    console.log('Total games for betting:', allGames.length);
    
    for (const standing of standings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) continue;
      
      console.log(`Creating bets for ${user.name} (${standing.points} points)...`);
      
      // Delete existing bets
      await prisma.bet.deleteMany({
        where: {
          userId: user.id,
          game: { competitionId: cl2021.id }
        }
      });
      
      let totalPoints = 0;
      const targetPoints = standing.points;
      
      for (let i = 0; i < allGames.length; i++) {
        const game = allGames[i];
        let points = 0;
        
        const remaining = allGames.length - i - 1;
        const needed = targetPoints - totalPoints;
        
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
      
      console.log(`${user.name}: ${totalPoints} points created`);
    }
    
    console.log('=== DIRECT FIX COMPLETE ===');
    
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

directFix(); 