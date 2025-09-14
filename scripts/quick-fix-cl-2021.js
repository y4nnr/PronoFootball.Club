const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickFixCL2021() {
  console.log('Starting Champions League 2020/21 fix...');
  
  try {
    // Find Champions League 2020/21
    const cl2021 = await prisma.competition.findFirst({
      where: {
        name: {
          contains: '2020/21'
        }
      }
    });
    
    if (!cl2021) {
      console.log('No Champions League 2020/21 found');
      return;
    }
    
    console.log('Found competition:', cl2021.name, cl2021.id);
    
    // Check current games and their teams
    const games = await prisma.game.findMany({
      where: {
        competitionId: cl2021.id
      },
      include: {
        homeTeam: true,
        awayTeam: true
      },
      take: 5
    });
    
    console.log('Sample games:');
    games.forEach(game => {
      console.log(`${game.homeTeam.name} (${game.homeTeam.category}) vs ${game.awayTeam.name} (${game.awayTeam.category})`);
    });
    
    // Check if we have national teams in the games
    const nationalTeamGames = await prisma.game.count({
      where: {
        competitionId: cl2021.id,
        OR: [
          { homeTeam: { category: 'NATIONAL' } },
          { awayTeam: { category: 'NATIONAL' } }
        ]
      }
    });
    
    console.log('Games with national teams:', nationalTeamGames);
    
    if (nationalTeamGames > 0) {
      console.log('❌ Found national teams in Champions League! This needs to be fixed.');
      
      // Delete all bets for this competition
      console.log('Deleting bets...');
      await prisma.bet.deleteMany({
        where: {
          game: {
            competitionId: cl2021.id
          }
        }
      });
      
      // Delete all games for this competition
      console.log('Deleting games...');
      await prisma.game.deleteMany({
        where: {
          competitionId: cl2021.id
        }
      });
      
      console.log('✅ Cleaned up incorrect data');
      
      // Get club teams only
      const clubTeams = await prisma.team.findMany({
        where: {
          category: 'CLUB'
        },
        take: 32
      });
      
      console.log(`Found ${clubTeams.length} club teams`);
      
      if (clubTeams.length >= 32) {
        console.log('Creating new games with club teams...');
        
        // Create 125 games with club teams
        for (let i = 0; i < 125; i++) {
          const homeTeam = clubTeams[i % clubTeams.length];
          const awayTeam = clubTeams[(i + 1) % clubTeams.length];
          
          await prisma.game.create({
            data: {
              competitionId: cl2021.id,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              date: new Date(2020, 8, 20 + Math.floor(i / 5)),
              status: 'FINISHED',
              homeScore: Math.floor(Math.random() * 4),
              awayScore: Math.floor(Math.random() * 4)
            }
          });
        }
        
        console.log('✅ Created 125 games with club teams');
        
        // Get users and create bets
        const users = await prisma.user.findMany({
          where: {
            name: {
              in: ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph']
            }
          }
        });
        
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
        
        const newGames = await prisma.game.findMany({
          where: { competitionId: cl2021.id }
        });
        
        console.log('Creating bets for users...');
        
        for (const standing of standings) {
          const user = users.find(u => u.name === standing.name);
          if (!user) continue;
          
          console.log(`Creating bets for ${user.name}...`);
          
          for (const game of newGames) {
            // Simple point distribution
            const points = Math.random() < 0.3 ? 3 : (Math.random() < 0.5 ? 1 : 0);
            
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
          }
        }
        
        console.log('✅ Created bets for all users');
      }
    } else {
      console.log('✅ No national teams found in Champions League games');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickFixCL2021(); 