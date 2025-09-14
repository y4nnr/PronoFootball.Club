const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find Champions League 2020/21
    const competition = await prisma.competition.findFirst({
      where: { name: { contains: '2020/21' } }
    });
    
    if (!competition) return;
    
    // Clean up existing data
    await prisma.bet.deleteMany({
      where: { game: { competitionId: competition.id } }
    });
    
    await prisma.game.deleteMany({
      where: { competitionId: competition.id }
    });
    
    await prisma.competitionUser.deleteMany({
      where: { competitionId: competition.id }
    });
    
    // Get users
    const users = await prisma.user.findMany({
      where: { name: { in: ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'] } }
    });
    
    // Add users to competition
    for (const user of users) {
      await prisma.competitionUser.create({
        data: { competitionId: competition.id, userId: user.id }
      });
    }
    
    // Get club teams
    const clubTeams = await prisma.team.findMany({
      where: { category: 'CLUB' },
      take: 32
    });
    
    // Create 125 games
    const games = [];
    for (let i = 0; i < 125; i++) {
      const game = await prisma.game.create({
        data: {
          competitionId: competition.id,
          homeTeamId: clubTeams[i % clubTeams.length].id,
          awayTeamId: clubTeams[(i + 1) % clubTeams.length].id,
          date: new Date(2020, 8, 20 + Math.floor(i / 5)),
          status: 'FINISHED',
          homeScore: Math.floor(Math.random() * 4),
          awayScore: Math.floor(Math.random() * 4)
        }
      });
      games.push(game);
    }
    
    // Create bets with exact points
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
    
    for (const standing of standings) {
      const user = users.find(u => u.name === standing.name);
      if (!user) continue;
      
      let totalPoints = 0;
      const targetPoints = standing.points;
      
      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        let points = 0;
        
        const remaining = games.length - i - 1;
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
    }
    
  } catch (error) {
    // Silent error handling
  } finally {
    await prisma.$disconnect();
  }
})(); 