const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Final standings from the screenshot - EXACT SCORES REQUIRED
const finalStandings = [
  { name: 'Renato', points: 47 },
  { name: 'Baptiste', points: 44 },
  { name: 'Benouz', points: 44 },
  { name: 'Steph', points: 42 },
  { name: 'Chacha', points: 41 },
  { name: 'Francky', points: 41 },
  { name: 'Keke', points: 40 },
  { name: 'Fifi', points: 39 },
  { name: 'Nono', points: 37 },
  { name: 'Yann', points: 33 }
];

// World Cup 2018 teams (32 teams)
const worldCupTeams = [
  // Group A
  { name: 'Russia', shortName: 'RUS', logo: 'https://upload.wikimedia.org/wikipedia/en/f/f3/Flag_of_Russia.svg' },
  { name: 'Saudi Arabia', shortName: 'KSA', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Flag_of_Saudi_Arabia.svg' },
  { name: 'Egypt', shortName: 'EGY', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Flag_of_Egypt.svg' },
  { name: 'Uruguay', shortName: 'URU', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Flag_of_Uruguay.svg' },
  
  // Group B
  { name: 'Portugal', shortName: 'POR', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg' },
  { name: 'Spain', shortName: 'ESP', logo: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Flag_of_Spain.svg' },
  { name: 'Morocco', shortName: 'MAR', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Flag_of_Morocco.svg' },
  { name: 'Iran', shortName: 'IRN', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Flag_of_Iran.svg' },
  
  // Group C
  { name: 'France', shortName: 'FRA', logo: 'https://upload.wikimedia.org/wikipedia/en/c/c3/Flag_of_France.svg' },
  { name: 'Australia', shortName: 'AUS', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Flag_of_Australia_%28converted%29.svg' },
  { name: 'Peru', shortName: 'PER', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Flag_of_Peru.svg' },
  { name: 'Denmark', shortName: 'DEN', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Flag_of_Denmark.svg' },
  
  // Group D
  { name: 'Argentina', shortName: 'ARG', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_Argentina.svg' },
  { name: 'Iceland', shortName: 'ISL', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Flag_of_Iceland.svg' },
  { name: 'Croatia', shortName: 'CRO', logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Flag_of_Croatia.svg' },
  { name: 'Nigeria', shortName: 'NGA', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Flag_of_Nigeria.svg' },
  
  // Group E
  { name: 'Brazil', shortName: 'BRA', logo: 'https://upload.wikimedia.org/wikipedia/en/0/05/Flag_of_Brazil.svg' },
  { name: 'Switzerland', shortName: 'SUI', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Switzerland.svg' },
  { name: 'Costa Rica', shortName: 'CRC', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Flag_of_Costa_Rica_%28state%29.svg' },
  { name: 'Serbia', shortName: 'SRB', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Flag_of_Serbia.svg' },
  
  // Group F
  { name: 'Germany', shortName: 'GER', logo: 'https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg' },
  { name: 'Mexico', shortName: 'MEX', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Flag_of_Mexico.svg' },
  { name: 'Sweden', shortName: 'SWE', logo: 'https://upload.wikimedia.org/wikipedia/en/4/4c/Flag_of_Sweden.svg' },
  { name: 'South Korea', shortName: 'KOR', logo: 'https://upload.wikimedia.org/wikipedia/commons/0/09/Flag_of_South_Korea.svg' },
  
  // Group G
  { name: 'Belgium', shortName: 'BEL', logo: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Flag_of_Belgium.svg' },
  { name: 'Panama', shortName: 'PAN', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag_of_Panama.svg' },
  { name: 'Tunisia', shortName: 'TUN', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Flag_of_Tunisia.svg' },
  { name: 'England', shortName: 'ENG', logo: 'https://upload.wikimedia.org/wikipedia/en/b/be/Flag_of_England.svg' },
  
  // Group H
  { name: 'Poland', shortName: 'POL', logo: 'https://upload.wikimedia.org/wikipedia/en/1/12/Flag_of_Poland.svg' },
  { name: 'Senegal', shortName: 'SEN', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Flag_of_Senegal.svg' },
  { name: 'Colombia', shortName: 'COL', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Flag_of_Colombia.svg' },
  { name: 'Japan', shortName: 'JPN', logo: 'https://upload.wikimedia.org/wikipedia/en/9/9e/Flag_of_Japan.svg' }
];

// Sample World Cup 2018 games (key matches)
const worldCupGames = [
  // Group Stage - Group A
  { homeTeam: 'Russia', awayTeam: 'Saudi Arabia', date: '2018-06-14T15:00:00Z', homeScore: 5, awayScore: 0 },
  { homeTeam: 'Egypt', awayTeam: 'Uruguay', date: '2018-06-15T12:00:00Z', homeScore: 0, awayScore: 1 },
  { homeTeam: 'Russia', awayTeam: 'Egypt', date: '2018-06-19T18:00:00Z', homeScore: 3, awayScore: 1 },
  { homeTeam: 'Uruguay', awayTeam: 'Saudi Arabia', date: '2018-06-20T15:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Uruguay', awayTeam: 'Russia', date: '2018-06-25T14:00:00Z', homeScore: 3, awayScore: 0 },
  { homeTeam: 'Saudi Arabia', awayTeam: 'Egypt', date: '2018-06-25T14:00:00Z', homeScore: 2, awayScore: 1 },
  
  // Group Stage - Group B
  { homeTeam: 'Morocco', awayTeam: 'Iran', date: '2018-06-15T15:00:00Z', homeScore: 0, awayScore: 1 },
  { homeTeam: 'Portugal', awayTeam: 'Spain', date: '2018-06-15T18:00:00Z', homeScore: 3, awayScore: 3 },
  { homeTeam: 'Portugal', awayTeam: 'Morocco', date: '2018-06-20T12:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Iran', awayTeam: 'Spain', date: '2018-06-20T18:00:00Z', homeScore: 0, awayScore: 1 },
  { homeTeam: 'Iran', awayTeam: 'Portugal', date: '2018-06-25T18:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Spain', awayTeam: 'Morocco', date: '2018-06-25T18:00:00Z', homeScore: 2, awayScore: 2 },
  
  // Group Stage - Group C
  { homeTeam: 'France', awayTeam: 'Australia', date: '2018-06-16T10:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Peru', awayTeam: 'Denmark', date: '2018-06-16T16:00:00Z', homeScore: 0, awayScore: 1 },
  { homeTeam: 'Denmark', awayTeam: 'Australia', date: '2018-06-21T12:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'France', awayTeam: 'Peru', date: '2018-06-21T15:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Denmark', awayTeam: 'France', date: '2018-06-26T14:00:00Z', homeScore: 0, awayScore: 0 },
  { homeTeam: 'Australia', awayTeam: 'Peru', date: '2018-06-26T14:00:00Z', homeScore: 0, awayScore: 2 },
  
  // Group Stage - Group D
  { homeTeam: 'Argentina', awayTeam: 'Iceland', date: '2018-06-16T13:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Croatia', awayTeam: 'Nigeria', date: '2018-06-16T19:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Argentina', awayTeam: 'Croatia', date: '2018-06-21T18:00:00Z', homeScore: 0, awayScore: 3 },
  { homeTeam: 'Nigeria', awayTeam: 'Iceland', date: '2018-06-22T15:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Nigeria', awayTeam: 'Argentina', date: '2018-06-26T18:00:00Z', homeScore: 1, awayScore: 2 },
  { homeTeam: 'Iceland', awayTeam: 'Croatia', date: '2018-06-26T18:00:00Z', homeScore: 1, awayScore: 2 },
  
  // Round of 16
  { homeTeam: 'France', awayTeam: 'Argentina', date: '2018-06-30T14:00:00Z', homeScore: 4, awayScore: 3 },
  { homeTeam: 'Uruguay', awayTeam: 'Portugal', date: '2018-06-30T18:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Spain', awayTeam: 'Russia', date: '2018-07-01T14:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Croatia', awayTeam: 'Denmark', date: '2018-07-01T18:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Brazil', awayTeam: 'Mexico', date: '2018-07-02T14:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Belgium', awayTeam: 'Japan', date: '2018-07-02T18:00:00Z', homeScore: 3, awayScore: 2 },
  { homeTeam: 'Sweden', awayTeam: 'Switzerland', date: '2018-07-03T14:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Colombia', awayTeam: 'England', date: '2018-07-03T18:00:00Z', homeScore: 1, awayScore: 1 },
  
  // Quarter-finals
  { homeTeam: 'Uruguay', awayTeam: 'France', date: '2018-07-06T14:00:00Z', homeScore: 0, awayScore: 2 },
  { homeTeam: 'Brazil', awayTeam: 'Belgium', date: '2018-07-06T18:00:00Z', homeScore: 1, awayScore: 2 },
  { homeTeam: 'Sweden', awayTeam: 'England', date: '2018-07-07T14:00:00Z', homeScore: 0, awayScore: 2 },
  { homeTeam: 'Russia', awayTeam: 'Croatia', date: '2018-07-07T18:00:00Z', homeScore: 2, awayScore: 2 },
  
  // Semi-finals
  { homeTeam: 'France', awayTeam: 'Belgium', date: '2018-07-10T18:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Croatia', awayTeam: 'England', date: '2018-07-11T18:00:00Z', homeScore: 2, awayScore: 1 },
  
  // Third place playoff
  { homeTeam: 'Belgium', awayTeam: 'England', date: '2018-07-14T14:00:00Z', homeScore: 2, awayScore: 0 },
  
  // Final
  { homeTeam: 'France', awayTeam: 'Croatia', date: '2018-07-15T15:00:00Z', homeScore: 4, awayScore: 2 }
];

// Function to create exact betting patterns to achieve target points
function createExactBets(games, targetPoints) {
  const bets = [];
  
  // We need to distribute points across 40 games to reach exactly targetPoints
  // Points can be: 3 (exact score), 1 (correct winner), 0 (wrong)
  
  // Try different combinations to reach exact target
  for (let exactScores = 0; exactScores <= Math.min(games.length, Math.floor(targetPoints / 3)); exactScores++) {
    const remainingPoints = targetPoints - (exactScores * 3);
    const maxCorrectWinners = Math.min(games.length - exactScores, remainingPoints);
    
    for (let correctWinners = 0; correctWinners <= maxCorrectWinners; correctWinners++) {
      const pointsFromWinners = correctWinners * 1;
      const totalPoints = (exactScores * 3) + pointsFromWinners;
      
      if (totalPoints === targetPoints) {
        // Found a valid combination!
        console.log(`Target ${targetPoints}: ${exactScores} exact scores (${exactScores * 3} pts) + ${correctWinners} correct winners (${pointsFromWinners} pts) + ${games.length - exactScores - correctWinners} wrong (0 pts)`);
        
        let exactScoreCount = 0;
        let correctWinnerCount = 0;
        
        for (let i = 0; i < games.length; i++) {
          const game = games[i];
          let homeScore, awayScore, points = 0;
          
          if (exactScoreCount < exactScores) {
            // Exact score (3 points)
            homeScore = game.homeScore;
            awayScore = game.awayScore;
            points = 3;
            exactScoreCount++;
          } else if (correctWinnerCount < correctWinners) {
            // Correct winner but wrong score (1 point)
            const actualResult = game.homeScore > game.awayScore ? 'home' : 
                                game.homeScore < game.awayScore ? 'away' : 'draw';
            
            if (actualResult === 'home') {
              homeScore = Math.max(1, game.homeScore + 1);
              awayScore = Math.max(0, game.awayScore);
              // Ensure it's still a home win but different score
              if (homeScore === game.homeScore && awayScore === game.awayScore) {
                homeScore = game.homeScore + 1;
              }
            } else if (actualResult === 'away') {
              homeScore = Math.max(0, game.homeScore);
              awayScore = Math.max(1, game.awayScore + 1);
              // Ensure it's still an away win but different score
              if (homeScore === game.homeScore && awayScore === game.awayScore) {
                awayScore = game.awayScore + 1;
              }
            } else {
              // Draw - make sure it's still a draw but different score
              const baseScore = game.homeScore === 0 ? 1 : 0;
              homeScore = baseScore;
              awayScore = baseScore;
            }
            points = 1;
            correctWinnerCount++;
          } else {
            // Wrong prediction (0 points)
            const actualResult = game.homeScore > game.awayScore ? 'home' : 
                                game.homeScore < game.awayScore ? 'away' : 'draw';
            
            // Force wrong result
            if (actualResult === 'home') {
              // Predict away win or draw
              homeScore = 0;
              awayScore = 1;
            } else if (actualResult === 'away') {
              // Predict home win or draw
              homeScore = 1;
              awayScore = 0;
            } else {
              // Predict home win
              homeScore = 1;
              awayScore = 0;
            }
            points = 0;
          }
          
          bets.push({
            gameId: game.id,
            homeScore,
            awayScore,
            points
          });
        }
        
        const totalCalculated = bets.reduce((sum, bet) => sum + bet.points, 0);
        console.log(`Generated bets with ${totalCalculated} points (target: ${targetPoints})`);
        return bets;
      }
    }
  }
  
  // If no exact combination found, this shouldn't happen with our point system
  console.error(`❌ Could not find exact combination for ${targetPoints} points!`);
  return [];
}

async function createWorldCup2018() {
  try {
    console.log('🏆 Creating World Cup 2018 Russia with EXACT SCORES...');
    
    // Delete existing World Cup 2018 if it exists
    const existingCompetition = await prisma.competition.findFirst({
      where: { name: 'World Cup 2018 Russia' }
    });
    
    if (existingCompetition) {
      console.log('🗑️ Deleting existing World Cup 2018...');
      await prisma.bet.deleteMany({
        where: {
          game: {
            competitionId: existingCompetition.id
          }
        }
      });
      await prisma.game.deleteMany({
        where: { competitionId: existingCompetition.id }
      });
      await prisma.competitionUser.deleteMany({
        where: { competitionId: existingCompetition.id }
      });
      await prisma.competition.delete({
        where: { id: existingCompetition.id }
      });
    }
    
    // Get all users
    const users = await prisma.user.findMany({
      where: {
        name: { in: finalStandings.map(s => s.name) }
      }
    });
    
    console.log(`Found ${users.length} users:`, users.map(u => u.name));
    console.log('Target standings (EXACT):');
    finalStandings.forEach((s, i) => console.log(`${i + 1}. ${s.name}: ${s.points} pts`));
    
    if (users.length !== finalStandings.length) {
      throw new Error(`Expected ${finalStandings.length} users, found ${users.length}`);
    }
    
    // Create competition
    const competition = await prisma.competition.create({
      data: {
        name: 'World Cup 2018 Russia',
        description: 'FIFA World Cup 2018 in Russia - 32 teams competing for the ultimate prize',
        logo: 'https://upload.wikimedia.org/wikipedia/en/6/67/2018_FIFA_World_Cup.svg',
        startDate: new Date('2018-06-14T00:00:00Z'),
        endDate: new Date('2018-07-15T23:59:59Z'),
        status: 'COMPLETED',
        winnerId: users.find(u => u.name === 'Renato')?.id,
        lastPlaceId: users.find(u => u.name === 'Yann')?.id
      }
    });
    
    console.log('✅ Competition created:', competition.id);
    
    // Add users to competition
    for (const user of users) {
      await prisma.competitionUser.create({
        data: {
          competitionId: competition.id,
          userId: user.id
        }
      });
    }
    
    console.log('✅ Users added to competition');
    
    // Get existing teams and create missing ones
    const existingTeams = await prisma.team.findMany({
      where: {
        name: { in: worldCupTeams.map(t => t.name) }
      }
    });
    
    const existingTeamNames = existingTeams.map(t => t.name);
    const createdTeams = {};
    
    // Add existing teams to our map
    existingTeams.forEach(team => {
      createdTeams[team.name] = team;
    });
    
    // Create missing teams
    for (const teamData of worldCupTeams) {
      if (!existingTeamNames.includes(teamData.name)) {
        const team = await prisma.team.create({
          data: {
            name: teamData.name,
            shortName: teamData.shortName,
            logo: teamData.logo,
            category: 'NATIONAL'
          }
        });
        createdTeams[teamData.name] = team;
        console.log(`Created team: ${teamData.name}`);
      }
    }
    
    console.log('✅ Teams ready');
    
    // Create games
    const createdGames = [];
    for (const gameData of worldCupGames) {
      if (!createdTeams[gameData.homeTeam] || !createdTeams[gameData.awayTeam]) {
        console.error(`Missing team: ${gameData.homeTeam} vs ${gameData.awayTeam}`);
        continue;
      }
      
      const game = await prisma.game.create({
        data: {
          competitionId: competition.id,
          homeTeamId: createdTeams[gameData.homeTeam].id,
          awayTeamId: createdTeams[gameData.awayTeam].id,
          date: new Date(gameData.date),
          status: 'FINISHED',
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore
        }
      });
      createdGames.push(game);
    }
    
    console.log(`✅ Created ${createdGames.length} games`);
    
    // Create EXACT bets for each user
    console.log('🎯 Creating bets with EXACT target points...');
    
    for (const user of users) {
      const userStanding = finalStandings.find(s => s.name === user.name);
      const targetPoints = userStanding.points;
      
      const userBets = createExactBets(createdGames, targetPoints);
      
      // Create the bets in database
      let actualPoints = 0;
      for (const bet of userBets) {
        await prisma.bet.create({
          data: {
            gameId: bet.gameId,
            userId: user.id,
            score1: bet.homeScore,
            score2: bet.awayScore,
            points: bet.points
          }
        });
        actualPoints += bet.points;
      }
      
      console.log(`✅ Created bets for ${user.name}: ${actualPoints} points (target: ${targetPoints}) ${actualPoints === targetPoints ? '✅ EXACT!' : '❌ MISMATCH!'}`);
    }
    
    console.log('🎉 World Cup 2018 Russia created with EXACT SCORES!');
    console.log(`Competition ID: ${competition.id}`);
    
    // Verify the data
    const verification = await prisma.competition.findUnique({
      where: { id: competition.id },
      include: {
        games: true,
        users: true,
        _count: {
          select: {
            games: true,
            users: true
          }
        }
      }
    });
    
    const totalBets = await prisma.bet.count({
      where: {
        game: {
          competitionId: competition.id
        }
      }
    });
    
    console.log(`\n📊 Verification:`);
    console.log(`- Games: ${verification._count.games}`);
    console.log(`- Users: ${verification._count.users}`);
    console.log(`- Total bets: ${totalBets}`);
    console.log(`- Expected bets: ${verification._count.games * verification._count.users}`);
    
  } catch (error) {
    console.error('❌ Error creating World Cup 2018:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createWorldCup2018(); 