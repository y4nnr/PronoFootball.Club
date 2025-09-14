const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Final standings target
const finalStandings = {
  'Benouz': 109,
  'Keke': 101,
  'Renato': 98,
  'Baptiste': 93,
  'Steph': 90,
  'Fifi': 89,
  'Nono': 85,
  'Francky': 82,
  'Yann': 76
};

// Champions League 2018/19 teams
const championsLeagueTeams = [
  // Group A
  { name: 'Atlético Madrid', shortName: 'ATM', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Atletico-Madrid-Logo.png' },
  { name: 'Borussia Dortmund', shortName: 'BVB', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Borussia-Dortmund-Logo.png' },
  { name: 'AS Monaco', shortName: 'MON', logo: 'https://logos-world.net/wp-content/uploads/2020/06/AS-Monaco-Logo.png' },
  { name: 'Club Brugge', shortName: 'CLB', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Club-Brugge-Logo.png' },
  
  // Group B
  { name: 'Barcelona', shortName: 'BAR', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Barcelona-Logo.png' },
  { name: 'Tottenham', shortName: 'TOT', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Tottenham-Logo.png' },
  { name: 'PSV Eindhoven', shortName: 'PSV', logo: 'https://logos-world.net/wp-content/uploads/2020/06/PSV-Logo.png' },
  { name: 'Inter Milan', shortName: 'INT', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Inter-Milan-Logo.png' },
  
  // Group C
  { name: 'Paris Saint-Germain', shortName: 'PSG', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Paris-Saint-Germain-Logo.png' },
  { name: 'Liverpool', shortName: 'LIV', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Liverpool-Logo.png' },
  { name: 'Napoli', shortName: 'NAP', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Napoli-Logo.png' },
  { name: 'Red Star Belgrade', shortName: 'RSB', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Red-Star-Belgrade-Logo.png' },
  
  // Group D
  { name: 'Porto', shortName: 'POR', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Porto-Logo.png' },
  { name: 'Schalke 04', shortName: 'S04', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Schalke-04-Logo.png' },
  { name: 'Galatasaray', shortName: 'GAL', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Galatasaray-Logo.png' },
  { name: 'Lokomotiv Moscow', shortName: 'LOK', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Lokomotiv-Moscow-Logo.png' },
  
  // Group E
  { name: 'Bayern Munich', shortName: 'BAY', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Bayern-Munich-Logo.png' },
  { name: 'Benfica', shortName: 'BEN', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Benfica-Logo.png' },
  { name: 'Ajax', shortName: 'AJA', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Ajax-Logo.png' },
  { name: 'AEK Athens', shortName: 'AEK', logo: 'https://logos-world.net/wp-content/uploads/2020/06/AEK-Athens-Logo.png' },
  
  // Group F
  { name: 'Manchester City', shortName: 'MCI', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Manchester-City-Logo.png' },
  { name: 'Shakhtar Donetsk', shortName: 'SHA', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Shakhtar-Donetsk-Logo.png' },
  { name: 'Lyon', shortName: 'LYO', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Lyon-Logo.png' },
  { name: 'Hoffenheim', shortName: 'HOF', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Hoffenheim-Logo.png' },
  
  // Group G
  { name: 'Real Madrid', shortName: 'RMA', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png' },
  { name: 'AS Roma', shortName: 'ROM', logo: 'https://logos-world.net/wp-content/uploads/2020/06/AS-Roma-Logo.png' },
  { name: 'CSKA Moscow', shortName: 'CSK', logo: 'https://logos-world.net/wp-content/uploads/2020/06/CSKA-Moscow-Logo.png' },
  { name: 'Viktoria Plzen', shortName: 'PLZ', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Viktoria-Plzen-Logo.png' },
  
  // Group H
  { name: 'Juventus', shortName: 'JUV', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Juventus-Logo.png' },
  { name: 'Manchester United', shortName: 'MUN', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Manchester-United-Logo.png' },
  { name: 'Valencia', shortName: 'VAL', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Valencia-Logo.png' },
  { name: 'Young Boys', shortName: 'YB', logo: 'https://logos-world.net/wp-content/uploads/2020/06/Young-Boys-Logo.png' }
];

// Key Champions League 2018/19 matches (group stage to final)
const championsLeagueMatches = [
  // Group Stage - Matchday 1 (September 18-19, 2018)
  { homeTeam: 'Barcelona', awayTeam: 'PSV Eindhoven', date: '2018-09-18T19:00:00Z', homeScore: 4, awayScore: 0 },
  { homeTeam: 'Inter Milan', awayTeam: 'Tottenham', date: '2018-09-18T19:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Liverpool', awayTeam: 'Paris Saint-Germain', date: '2018-09-18T19:00:00Z', homeScore: 3, awayScore: 2 },
  { homeTeam: 'Napoli', awayTeam: 'Red Star Belgrade', date: '2018-09-18T19:00:00Z', homeScore: 0, awayScore: 0 },
  { homeTeam: 'Porto', awayTeam: 'Galatasaray', date: '2018-09-18T19:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Schalke 04', awayTeam: 'Lokomotiv Moscow', date: '2018-09-18T19:00:00Z', homeScore: 1, awayScore: 0 },
  
  // Group Stage - Matchday 2 (October 2-3, 2018)
  { homeTeam: 'Tottenham', awayTeam: 'Barcelona', date: '2018-10-03T19:00:00Z', homeScore: 2, awayScore: 4 },
  { homeTeam: 'PSV Eindhoven', awayTeam: 'Inter Milan', date: '2018-10-03T19:00:00Z', homeScore: 1, awayScore: 2 },
  { homeTeam: 'Paris Saint-Germain', awayTeam: 'Red Star Belgrade', date: '2018-10-03T19:00:00Z', homeScore: 6, awayScore: 1 },
  { homeTeam: 'Napoli', awayTeam: 'Liverpool', date: '2018-10-03T19:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Real Madrid', awayTeam: 'CSKA Moscow', date: '2018-10-02T19:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'AS Roma', awayTeam: 'Viktoria Plzen', date: '2018-10-02T19:00:00Z', homeScore: 5, awayScore: 0 },
  
  // Group Stage - Matchday 3 (October 23-24, 2018)
  { homeTeam: 'Barcelona', awayTeam: 'Inter Milan', date: '2018-10-24T19:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Tottenham', awayTeam: 'PSV Eindhoven', date: '2018-10-24T19:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Liverpool', awayTeam: 'Red Star Belgrade', date: '2018-10-24T19:00:00Z', homeScore: 4, awayScore: 0 },
  { homeTeam: 'Paris Saint-Germain', awayTeam: 'Napoli', date: '2018-10-24T19:00:00Z', homeScore: 2, awayScore: 2 },
  { homeTeam: 'Bayern Munich', awayTeam: 'Ajax', date: '2018-10-23T19:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Benfica', awayTeam: 'AEK Athens', date: '2018-10-23T19:00:00Z', homeScore: 1, awayScore: 0 },
  
  // Group Stage - Matchday 4 (November 6-7, 2018)
  { homeTeam: 'Inter Milan', awayTeam: 'Barcelona', date: '2018-11-06T20:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'PSV Eindhoven', awayTeam: 'Tottenham', date: '2018-11-06T20:00:00Z', homeScore: 2, awayScore: 2 },
  { homeTeam: 'Red Star Belgrade', awayTeam: 'Liverpool', date: '2018-11-06T20:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Napoli', awayTeam: 'Paris Saint-Germain', date: '2018-11-06T20:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Manchester City', awayTeam: 'Shakhtar Donetsk', date: '2018-11-07T20:00:00Z', homeScore: 6, awayScore: 0 },
  { homeTeam: 'Lyon', awayTeam: 'Hoffenheim', date: '2018-11-07T20:00:00Z', homeScore: 2, awayScore: 2 },
  
  // Group Stage - Matchday 5 (November 27-28, 2018)
  { homeTeam: 'Barcelona', awayTeam: 'Tottenham', date: '2018-11-28T20:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Inter Milan', awayTeam: 'PSV Eindhoven', date: '2018-11-28T20:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Liverpool', awayTeam: 'Paris Saint-Germain', date: '2018-11-28T20:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Red Star Belgrade', awayTeam: 'Napoli', date: '2018-11-28T20:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Juventus', awayTeam: 'Valencia', date: '2018-11-27T20:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Manchester United', awayTeam: 'Young Boys', date: '2018-11-27T20:00:00Z', homeScore: 1, awayScore: 0 },
  
  // Group Stage - Matchday 6 (December 11-12, 2018)
  { homeTeam: 'Tottenham', awayTeam: 'Inter Milan', date: '2018-12-11T20:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'PSV Eindhoven', awayTeam: 'Barcelona', date: '2018-12-11T20:00:00Z', homeScore: 1, awayScore: 2 },
  { homeTeam: 'Paris Saint-Germain', awayTeam: 'Liverpool', date: '2018-12-11T20:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Napoli', awayTeam: 'Red Star Belgrade', date: '2018-12-11T20:00:00Z', homeScore: 3, awayScore: 1 },
  { homeTeam: 'Real Madrid', awayTeam: 'CSKA Moscow', date: '2018-12-12T20:00:00Z', homeScore: 0, awayScore: 3 },
  { homeTeam: 'AS Roma', awayTeam: 'Viktoria Plzen', date: '2018-12-12T20:00:00Z', homeScore: 2, awayScore: 1 },
  
  // Round of 16 - First Leg (February 12-20, 2019)
  { homeTeam: 'Liverpool', awayTeam: 'Bayern Munich', date: '2019-02-19T20:00:00Z', homeScore: 0, awayScore: 0 },
  { homeTeam: 'Lyon', awayTeam: 'Barcelona', date: '2019-02-19T20:00:00Z', homeScore: 0, awayScore: 0 },
  { homeTeam: 'AS Roma', awayTeam: 'Porto', date: '2019-02-12T20:00:00Z', homeScore: 2, awayScore: 1 },
  { homeTeam: 'Tottenham', awayTeam: 'Borussia Dortmund', date: '2019-02-13T20:00:00Z', homeScore: 3, awayScore: 0 },
  { homeTeam: 'Ajax', awayTeam: 'Real Madrid', date: '2019-02-13T20:00:00Z', homeScore: 1, awayScore: 2 },
  { homeTeam: 'Manchester United', awayTeam: 'Paris Saint-Germain', date: '2019-02-12T20:00:00Z', homeScore: 0, awayScore: 2 },
  { homeTeam: 'Schalke 04', awayTeam: 'Manchester City', date: '2019-02-20T20:00:00Z', homeScore: 2, awayScore: 3 },
  { homeTeam: 'Atlético Madrid', awayTeam: 'Juventus', date: '2019-02-20T20:00:00Z', homeScore: 2, awayScore: 0 },
  
  // Round of 16 - Second Leg (March 5-13, 2019)
  { homeTeam: 'Bayern Munich', awayTeam: 'Liverpool', date: '2019-03-13T20:00:00Z', homeScore: 1, awayScore: 3 },
  { homeTeam: 'Barcelona', awayTeam: 'Lyon', date: '2019-03-13T20:00:00Z', homeScore: 5, awayScore: 1 },
  { homeTeam: 'Porto', awayTeam: 'AS Roma', date: '2019-03-06T20:00:00Z', homeScore: 3, awayScore: 1 },
  { homeTeam: 'Borussia Dortmund', awayTeam: 'Tottenham', date: '2019-03-05T20:00:00Z', homeScore: 0, awayScore: 1 },
  { homeTeam: 'Real Madrid', awayTeam: 'Ajax', date: '2019-03-05T20:00:00Z', homeScore: 1, awayScore: 4 },
  { homeTeam: 'Paris Saint-Germain', awayTeam: 'Manchester United', date: '2019-03-06T20:00:00Z', homeScore: 1, awayScore: 3 },
  { homeTeam: 'Manchester City', awayTeam: 'Schalke 04', date: '2019-03-12T20:00:00Z', homeScore: 7, awayScore: 0 },
  { homeTeam: 'Juventus', awayTeam: 'Atlético Madrid', date: '2019-03-12T20:00:00Z', homeScore: 3, awayScore: 0 },
  
  // Quarter-finals - First Leg (April 9-10, 2019)
  { homeTeam: 'Liverpool', awayTeam: 'Porto', date: '2019-04-09T19:00:00Z', homeScore: 2, awayScore: 0 },
  { homeTeam: 'Tottenham', awayTeam: 'Manchester City', date: '2019-04-09T19:00:00Z', homeScore: 1, awayScore: 0 },
  { homeTeam: 'Ajax', awayTeam: 'Juventus', date: '2019-04-10T19:00:00Z', homeScore: 1, awayScore: 1 },
  { homeTeam: 'Barcelona', awayTeam: 'Manchester United', date: '2019-04-10T19:00:00Z', homeScore: 1, awayScore: 0 },
  
  // Quarter-finals - Second Leg (April 16-17, 2019)
  { homeTeam: 'Porto', awayTeam: 'Liverpool', date: '2019-04-17T19:00:00Z', homeScore: 1, awayScore: 4 },
  { homeTeam: 'Manchester City', awayTeam: 'Tottenham', date: '2019-04-17T19:00:00Z', homeScore: 4, awayScore: 3 },
  { homeTeam: 'Juventus', awayTeam: 'Ajax', date: '2019-04-16T19:00:00Z', homeScore: 1, awayScore: 2 },
  { homeTeam: 'Manchester United', awayTeam: 'Barcelona', date: '2019-04-16T19:00:00Z', homeScore: 0, awayScore: 3 },
  
  // Semi-finals - First Leg (April 30 - May 1, 2019)
  { homeTeam: 'Tottenham', awayTeam: 'Ajax', date: '2019-04-30T19:00:00Z', homeScore: 0, awayScore: 1 },
  { homeTeam: 'Barcelona', awayTeam: 'Liverpool', date: '2019-05-01T19:00:00Z', homeScore: 3, awayScore: 0 },
  
  // Semi-finals - Second Leg (May 7-8, 2019)
  { homeTeam: 'Ajax', awayTeam: 'Tottenham', date: '2019-05-08T19:00:00Z', homeScore: 2, awayScore: 3 },
  { homeTeam: 'Liverpool', awayTeam: 'Barcelona', date: '2019-05-07T19:00:00Z', homeScore: 4, awayScore: 0 },
  
  // Final (June 1, 2019)
  { homeTeam: 'Tottenham', awayTeam: 'Liverpool', date: '2019-06-01T19:00:00Z', homeScore: 0, awayScore: 2 }
];

// Enhanced betting algorithm with two-pass system for better accuracy
function generateBettingData(games, users, targetPoints) {
  const bets = [];
  const userPoints = {};
  
  // Initialize user points
  users.forEach(user => {
    userPoints[user.name] = 0;
  });
  
  // First pass: Generate base bets
  games.forEach((game, gameIndex) => {
    users.forEach(user => {
      const actualResult = getMatchResult(game.homeScore, game.awayScore);
      
      // Calculate how many points this user needs
      const currentPoints = userPoints[user.name];
      const targetUserPoints = targetPoints[user.name];
      const remainingGames = games.length - gameIndex - 1;
      const pointsNeeded = targetUserPoints - currentPoints;
      const avgPointsNeeded = remainingGames > 0 ? pointsNeeded / remainingGames : 0;
      
      // Determine bet strategy based on points needed
      let betStrategy;
      if (avgPointsNeeded > 2.5) {
        betStrategy = 'aggressive'; // Try for exact scores
      } else if (avgPointsNeeded > 1.5) {
        betStrategy = 'moderate'; // Mix of exact and result
      } else if (avgPointsNeeded > 0.5) {
        betStrategy = 'conservative'; // Mostly correct results
      } else {
        betStrategy = 'random'; // Random bets
      }
      
      const prediction = generatePrediction(game, actualResult, betStrategy);
      const points = calculatePoints(prediction, game);
      
      bets.push({
        userId: user.id,
        gameId: game.id,
        score1: prediction.homeScore,
        score2: prediction.awayScore,
        points: points
      });
      
      userPoints[user.name] += points;
    });
  });
  
  // Second pass: Adjust bets to hit exact targets
  users.forEach(user => {
    const currentPoints = userPoints[user.name];
    const targetUserPoints = targetPoints[user.name];
    const difference = targetUserPoints - currentPoints;
    
    if (Math.abs(difference) > 0) {
      adjustUserBets(bets, user, games, difference);
    }
  });
  
  return bets;
}

function generatePrediction(game, actualResult, strategy) {
  const actual = { homeScore: game.homeScore, awayScore: game.awayScore };
  
  switch (strategy) {
    case 'aggressive':
      // 40% chance of exact score, 35% correct result, 25% wrong
      const rand = Math.random();
      if (rand < 0.4) {
        return actual; // Exact score
      } else if (rand < 0.75) {
        return generateCorrectResult(actual);
      } else {
        return generateRandomPrediction();
      }
      
    case 'moderate':
      // 25% exact, 50% correct result, 25% wrong
      const rand2 = Math.random();
      if (rand2 < 0.25) {
        return actual;
      } else if (rand2 < 0.75) {
        return generateCorrectResult(actual);
      } else {
        return generateRandomPrediction();
      }
      
    case 'conservative':
      // 15% exact, 70% correct result, 15% wrong
      const rand3 = Math.random();
      if (rand3 < 0.15) {
        return actual;
      } else if (rand3 < 0.85) {
        return generateCorrectResult(actual);
      } else {
        return generateRandomPrediction();
      }
      
    default:
      // Random strategy
      return generateRandomPrediction();
  }
}

function generateCorrectResult(actual) {
  const result = getMatchResult(actual.homeScore, actual.awayScore);
  
  if (result === 'home') {
    return {
      homeScore: Math.max(1, actual.homeScore + Math.floor(Math.random() * 2) - 1),
      awayScore: Math.max(0, actual.awayScore - Math.floor(Math.random() * 2))
    };
  } else if (result === 'away') {
    return {
      homeScore: Math.max(0, actual.homeScore - Math.floor(Math.random() * 2)),
      awayScore: Math.max(1, actual.awayScore + Math.floor(Math.random() * 2) - 1)
    };
  } else {
    // Draw
    const score = Math.floor(Math.random() * 4);
    return { homeScore: score, awayScore: score };
  }
}

function generateRandomPrediction() {
  return {
    homeScore: Math.floor(Math.random() * 5),
    awayScore: Math.floor(Math.random() * 5)
  };
}

function getMatchResult(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

function calculatePoints(prediction, actual) {
  if (prediction.homeScore === actual.homeScore && prediction.awayScore === actual.awayScore) {
    return 3; // Exact score
  }
  
  const predictedResult = getMatchResult(prediction.homeScore, prediction.awayScore);
  const actualResult = getMatchResult(actual.homeScore, actual.awayScore);
  
  if (predictedResult === actualResult) {
    return 1; // Correct result
  }
  
  return 0; // Wrong
}

function adjustUserBets(bets, user, games, pointsDifference) {
  const userBets = bets.filter(bet => bet.userId === user.id);
  
  if (pointsDifference > 0) {
    // Need more points - convert some wrong bets to correct ones
    const wrongBets = userBets.filter(bet => bet.points === 0);
    const betsToFix = Math.min(wrongBets.length, Math.ceil(pointsDifference / 1.5));
    
    for (let i = 0; i < betsToFix; i++) {
      const bet = wrongBets[i];
      const game = games.find(g => g.id === bet.gameId);
      if (game) {
        if (pointsDifference >= 3) {
          // Make it exact score
          bet.score1 = game.homeScore;
          bet.score2 = game.awayScore;
          bet.points = 3;
          pointsDifference -= 3;
        } else {
          // Make it correct result
          const correctPrediction = generateCorrectResult(game);
          bet.score1 = correctPrediction.homeScore;
          bet.score2 = correctPrediction.awayScore;
          bet.points = 1;
          pointsDifference -= 1;
        }
      }
    }
  } else if (pointsDifference < 0) {
    // Need fewer points - convert some correct bets to wrong ones
    const correctBets = userBets.filter(bet => bet.points > 0);
    const betsToWorsen = Math.min(correctBets.length, Math.ceil(Math.abs(pointsDifference) / 1.5));
    
    for (let i = 0; i < betsToWorsen && pointsDifference < 0; i++) {
      const bet = correctBets[i];
      const wrongPrediction = generateRandomPrediction();
      bet.score1 = wrongPrediction.homeScore;
      bet.score2 = wrongPrediction.awayScore;
      const oldPoints = bet.points;
      bet.points = 0;
      pointsDifference += oldPoints;
    }
  }
}

async function main() {
  try {
    console.log('🏆 Creating UEFA Champions League 2018/19...');
    
    // Create competition
    const competition = await prisma.competition.create({
      data: {
        name: 'UEFA Champions League 2018/19',
        description: 'The 2018–19 UEFA Champions League was the 64th season of Europe\'s premier club football tournament organised by UEFA, and the 27th season since it was renamed from the European Champion Clubs\' Cup to the UEFA Champions League.',
        startDate: new Date('2018-09-18'),
        endDate: new Date('2019-06-01'),
        status: 'FINISHED',
        logo: 'https://upload.wikimedia.org/wikipedia/en/b/bf/UEFA_Champions_League_logo_2.svg'
      }
    });
    
    console.log(`✅ Competition created: ${competition.name}`);
    
    // Create or get teams
    console.log('🏟️ Creating teams...');
    const createdTeams = [];
    
    for (const teamData of championsLeagueTeams) {
      let team = await prisma.team.findFirst({
        where: { name: teamData.name }
      });
      
      if (!team) {
        team = await prisma.team.create({
          data: {
            name: teamData.name,
            shortName: teamData.shortName,
            logo: teamData.logo,
            category: 'CLUB'
          }
        });
        console.log(`  ✅ Created team: ${team.name}`);
      } else {
        console.log(`  ♻️ Using existing team: ${team.name}`);
      }
      
      createdTeams.push(team);
    }
    
    // Get users (excluding admin and Axel, including Chacha)
    console.log('👥 Getting users...');
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { role: { not: 'admin' } },
          { name: { not: 'Axel' } }
        ]
      }
    });
    
    console.log(`Found ${users.length} users:`, users.map(u => u.name).join(', '));
    
    // Add users to competition
    console.log('🔗 Adding users to competition...');
    for (const user of users) {
      await prisma.competitionUser.create({
        data: {
          competitionId: competition.id,
          userId: user.id
        }
      });
    }
    console.log(`✅ Added ${users.length} users to competition`);
    
    // Create games
    console.log('⚽ Creating games...');
    const createdGames = [];
    
    for (const matchData of championsLeagueMatches) {
      const homeTeam = createdTeams.find(t => t.name === matchData.homeTeam);
      const awayTeam = createdTeams.find(t => t.name === matchData.awayTeam);
      
      if (homeTeam && awayTeam) {
        const game = await prisma.game.create({
          data: {
            competitionId: competition.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            date: new Date(matchData.date),
            status: 'FINISHED',
            homeScore: matchData.homeScore,
            awayScore: matchData.awayScore
          }
        });
        
        createdGames.push({
          ...game,
          homeScore: matchData.homeScore,
          awayScore: matchData.awayScore
        });
      }
    }
    
    console.log(`✅ Created ${createdGames.length} games`);
    
    // Generate betting data
    console.log('🎯 Generating betting data...');
    const bettingData = generateBettingData(createdGames, users, finalStandings);
    
    // Create bets
    for (const betData of bettingData) {
      await prisma.bet.create({
        data: betData
      });
    }
    
    console.log(`✅ Created ${bettingData.length} bets`);
    
    // Set competition winner (Benouz with 109 points)
    const winner = users.find(u => u.name === 'Benouz');
    if (winner) {
      await prisma.competition.update({
        where: { id: competition.id },
        data: { winnerId: winner.id }
      });
      console.log(`🏆 Set winner: ${winner.name}`);
    }
    
    // Verify final standings
    console.log('\n📊 Verifying final standings...');
    for (const user of users) {
      const userBets = bettingData.filter(bet => bet.userId === user.id);
      const totalPoints = userBets.reduce((sum, bet) => sum + bet.points, 0);
      console.log(`${user.name}: ${totalPoints} points (target: ${finalStandings[user.name]})`);
    }
    
    console.log('\n🎉 UEFA Champions League 2018/19 created successfully!');
    console.log(`📈 Competition: ${competition.name}`);
    console.log(`🏟️ Teams: ${createdTeams.length}`);
    console.log(`⚽ Games: ${createdGames.length}`);
    console.log(`👥 Users: ${users.length}`);
    console.log(`🎯 Total bets: ${bettingData.length}`);
    
  } catch (error) {
    console.error('❌ Error creating Champions League 2018/19:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 