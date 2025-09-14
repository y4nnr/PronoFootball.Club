const { PrismaClient } = require('@prisma/client');

async function createEuro2024() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🏆 Creating Euro 2024 competition...\n');
    
    // Check if Euro 2024 already exists
    const existing = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Euro 2024'
        }
      }
    });
    
    if (existing) {
      console.log('❌ Euro 2024 already exists. Deleting first...');
      
      // Delete existing bets, games, user associations, and competition
      await prisma.bet.deleteMany({
        where: {
          game: {
            competitionId: existing.id
          }
        }
      });
      
      await prisma.game.deleteMany({
        where: {
          competitionId: existing.id
        }
      });
      
      await prisma.competitionUser.deleteMany({
        where: {
          competitionId: existing.id
        }
      });
      
      await prisma.competition.delete({
        where: {
          id: existing.id
        }
      });
      
      console.log('✅ Existing Euro 2024 deleted');
    }
    
    // Find Yann (the winner)
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    if (!yann) {
      console.log('❌ Yann not found');
      return;
    }
    
    console.log(`✅ Found Yann: ${yann.name} (ID: ${yann.id})`);
    
    // Create Euro 2024 competition
    const competition = await prisma.competition.create({
      data: {
        name: 'Euro 2024',
        description: 'UEFA European Championship 2024 in Germany - 51 games played. Won by Yann with 52 points.',
        logo: 'https://upload.wikimedia.org/wikipedia/en/3/34/UEFA_Euro_2024_Logo.svg',
        startDate: new Date('2024-06-14T00:00:00.000Z'),
        endDate: new Date('2024-07-14T00:00:00.000Z'),
        status: 'FINISHED',
        winnerId: yann.id
      }
    });
    
    console.log(`✅ Created competition: ${competition.name} (ID: ${competition.id})`);
    
    // Final standings
    const standings = [
      { name: 'Yann', points: 52 },      // Winner
      { name: 'Nono', points: 50 },
      { name: 'Steph', points: 44 },
      { name: 'Keke', points: 41 },
      { name: 'Fifi', points: 38 },
      { name: 'Benouz', points: 37 },
      { name: 'Renato', points: 36 },
      { name: 'Baptiste', points: 30 }
    ];
    
    console.log('\n👥 Adding participants...');
    
    // Add users to competition and collect user data
    const participatingUsers = [];
    
    for (const standing of standings) {
      const user = await prisma.user.findFirst({
        where: { name: standing.name }
      });
      
      if (user) {
        await prisma.competitionUser.create({
          data: {
            userId: user.id,
            competitionId: competition.id
          }
        });
        
        participatingUsers.push({
          ...user,
          targetPoints: standing.points
        });
        
        console.log(`✅ Added ${standing.name} (target: ${standing.points} points)`);
      } else {
        console.log(`❌ User ${standing.name} not found`);
      }
    }
    
    console.log(`\n🎯 Creating 51 games...`);
    
    // Get or create European national teams
    const europeanTeamNames = [
      'Germany', 'Spain', 'France', 'Italy', 'England', 'Portugal', 
      'Netherlands', 'Belgium', 'Croatia', 'Denmark', 'Austria', 'Switzerland',
      'Poland', 'Ukraine', 'Czech Republic', 'Hungary', 'Romania', 'Serbia',
      'Slovakia', 'Slovenia', 'Albania', 'Georgia', 'Turkey', 'Scotland'
    ];
    
    // Get existing teams or create missing ones
    const teams = [];
    for (const teamName of europeanTeamNames) {
      let team = await prisma.team.findFirst({
        where: { name: teamName }
      });
      
      if (!team) {
        team = await prisma.team.create({
          data: {
            name: teamName,
            shortName: teamName.substring(0, 3).toUpperCase(),
            category: 'NATIONAL',
            logo: `https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Flag_of_${teamName}.svg/23px-Flag_of_${teamName}.svg.png`
          }
        });
        console.log(`✅ Created team: ${teamName}`);
      }
      teams.push(team);
    }
    
    console.log(`✅ Prepared ${teams.length} teams`);
    
    const games = [];
    let gameDate = new Date('2024-06-14T18:00:00.000Z');
    
    for (let i = 0; i < 51; i++) {
      const homeTeam = teams[i % teams.length];
      const awayTeam = teams[(i + 1) % teams.length];
      
      // Generate realistic scores
      const homeScore = Math.floor(Math.random() * 4);
      const awayScore = Math.floor(Math.random() * 4);
      
      const game = await prisma.game.create({
        data: {
          competitionId: competition.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeScore,
          awayScore,
          date: new Date(gameDate),
          status: 'FINISHED'
        }
      });
      
      games.push(game);
      
      // Increment date by roughly 1 day
      gameDate.setTime(gameDate.getTime() + (24 * 60 * 60 * 1000));
    }
    
    console.log(`✅ Created ${games.length} games`);
    
    console.log('\n🎲 Generating betting data...');
    
    // Create betting data for all users
    let totalBetsCreated = 0;
    
    for (const user of participatingUsers) {
      console.log(`📊 Creating bets for ${user.name} (target: ${user.targetPoints} points)...`);
      
      const userBets = [];
      let currentPoints = 0;
      
      // Create bets for all 51 games
      for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
        const game = games[gameIndex];
        
        // Determine points for this bet
        let points = 0;
        const remainingGames = games.length - gameIndex;
        const remainingPointsNeeded = user.targetPoints - currentPoints;
        
        if (remainingGames === 1) {
          // Last game - assign exactly what's needed
          points = remainingPointsNeeded;
        } else {
          // Distribute points strategically
          const maxPossibleRemaining = remainingGames * 3;
          const minPointsNeeded = Math.max(0, remainingPointsNeeded - maxPossibleRemaining + 3);
          const maxPointsAllowed = Math.min(3, remainingPointsNeeded);
          
          if (minPointsNeeded <= maxPointsAllowed) {
            if (remainingPointsNeeded > remainingGames * 1.5) {
              // Need more points - bias toward higher scores
              points = Math.random() < 0.7 ? 3 : Math.random() < 0.8 ? 1 : 0;
            } else if (remainingPointsNeeded < remainingGames * 0.5) {
              // Need fewer points - bias toward lower scores
              points = Math.random() < 0.7 ? 0 : Math.random() < 0.5 ? 1 : 3;
            } else {
              // Moderate distribution
              points = Math.random() < 0.4 ? 1 : Math.random() < 0.6 ? 0 : 3;
            }
            
            points = Math.max(minPointsNeeded, Math.min(maxPointsAllowed, points));
          } else {
            points = maxPointsAllowed;
          }
        }
        
        // Generate prediction based on points
        let score1, score2;
        
        if (points === 3) {
          // Exact score - match the game result
          score1 = game.homeScore;
          score2 = game.awayScore;
        } else if (points === 1) {
          // Correct result but wrong score
          if (game.homeScore > game.awayScore) {
            // Home win - predict home win with different score
            score1 = Math.max(1, game.homeScore + Math.floor(Math.random() * 2));
            score2 = Math.max(0, game.awayScore - Math.floor(Math.random() * 2));
          } else if (game.awayScore > game.homeScore) {
            // Away win - predict away win with different score
            score1 = Math.max(0, game.homeScore - Math.floor(Math.random() * 2));
            score2 = Math.max(1, game.awayScore + Math.floor(Math.random() * 2));
          } else {
            // Draw - predict draw with different score
            const drawScore = Math.floor(Math.random() * 3);
            score1 = drawScore;
            score2 = drawScore;
            if (score1 === game.homeScore && score2 === game.awayScore) {
              score1 = score1 + 1; // Avoid exact match
            }
          }
        } else {
          // Wrong prediction (0 points)
          if (game.homeScore > game.awayScore) {
            // Game was home win, predict away win or draw
            if (Math.random() < 0.5) {
              score1 = Math.floor(Math.random() * 2);
              score2 = score1 + 1 + Math.floor(Math.random() * 2);
            } else {
              score1 = score2 = Math.floor(Math.random() * 3);
            }
          } else if (game.awayScore > game.homeScore) {
            // Game was away win, predict home win or draw
            if (Math.random() < 0.5) {
              score2 = Math.floor(Math.random() * 2);
              score1 = score2 + 1 + Math.floor(Math.random() * 2);
            } else {
              score1 = score2 = Math.floor(Math.random() * 3);
            }
          } else {
            // Game was draw, predict win for either side
            if (Math.random() < 0.5) {
              score1 = 1 + Math.floor(Math.random() * 2);
              score2 = Math.floor(Math.random() * score1);
            } else {
              score2 = 1 + Math.floor(Math.random() * 2);
              score1 = Math.floor(Math.random() * score2);
            }
          }
        }
        
        // Ensure we don't accidentally create exact scores (should be 0)
        if (score1 === game.homeScore && score2 === game.awayScore && points !== 3) {
          score1 = score1 + 1; // Slightly adjust to avoid exact match
        }
        
        // Create the bet
        const bet = await prisma.bet.create({
          data: {
            userId: user.id,
            gameId: game.id,
            score1,
            score2,
            points
          }
        });
        
        userBets.push(bet);
        currentPoints += points;
        totalBetsCreated++;
      }
      
      console.log(`✅ ${user.name}: ${userBets.length} bets, ${currentPoints} total points (target: ${user.targetPoints})`);
    }
    
    console.log(`\n🎉 Euro 2024 successfully created!`);
    console.log(`📊 Competition: ${competition.name}`);
    console.log(`🆔 ID: ${competition.id}`);
    console.log(`🏆 Winner: ${yann.name}`);
    console.log(`🎮 Games: ${games.length}`);
    console.log(`👥 Participants: ${participatingUsers.length}`);
    console.log(`🎯 Total bets: ${totalBetsCreated}`);
    
    console.log(`\n📈 Final standings:`);
    standings.forEach((player, index) => {
      console.log(`${index + 1}. ${player.name}: ${player.points} points ${index === 0 ? '🏆' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating Euro 2024:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createEuro2024(); 