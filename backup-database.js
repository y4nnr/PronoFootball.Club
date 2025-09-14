const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('🔄 Starting database backup...');
    
    // Create backup directory
    const backupDir = path.join(__dirname, 'database-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Backup Users
    console.log('📥 Backing up users...');
    const users = await prisma.user.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'users.json'),
      JSON.stringify(users, null, 2)
    );

    // Backup Teams
    console.log('📥 Backing up teams...');
    const teams = await prisma.team.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'teams.json'),
      JSON.stringify(teams, null, 2)
    );

    // Backup Competitions
    console.log('📥 Backing up competitions...');
    const competitions = await prisma.competition.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'competitions.json'),
      JSON.stringify(competitions, null, 2)
    );

    // Backup Games
    console.log('📥 Backing up games...');
    const games = await prisma.game.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'games.json'),
      JSON.stringify(games, null, 2)
    );

    // Backup Bets (this is the most important - contains all the points!)
    console.log('📥 Backing up bets...');
    const bets = await prisma.bet.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'bets.json'),
      JSON.stringify(bets, null, 2)
    );

    // Backup Competition Users
    console.log('📥 Backing up competition users...');
    const competitionUsers = await prisma.competitionUser.findMany();
    fs.writeFileSync(
      path.join(backupDir, 'competition-users.json'),
      JSON.stringify(competitionUsers, null, 2)
    );

    // Create a summary with current standings
    console.log('📊 Creating summary...');
    const summary = {
      backupDate: new Date().toISOString(),
      totalUsers: users.length,
      totalTeams: teams.length,
      totalCompetitions: competitions.length,
      totalGames: games.length,
      totalBets: bets.length,
      competitions: []
    };

    // Add competition details with current standings
    for (const comp of competitions) {
      const compGames = games.filter(g => g.competitionId === comp.id);
      const compBets = bets.filter(b => compGames.some(g => g.id === b.gameId));
      
      // Calculate standings
      const userPoints = {};
      compBets.forEach(bet => {
        if (!userPoints[bet.userId]) {
          userPoints[bet.userId] = 0;
        }
        userPoints[bet.userId] += bet.points;
      });

      const standings = Object.entries(userPoints)
        .map(([userId, points]) => {
          const user = users.find(u => u.id === userId);
          return { userName: user?.name || 'Unknown', points };
        })
        .sort((a, b) => b.points - a.points);

      summary.competitions.push({
        name: comp.name,
        games: compGames.length,
        bets: compBets.length,
        participants: standings.length,
        standings: standings
      });
    }

    fs.writeFileSync(
      path.join(backupDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('✅ Database backup completed!');
    console.log(`📁 Backup saved to: ${backupDir}`);
    console.log('📋 Summary:');
    console.log(`   - ${users.length} users`);
    console.log(`   - ${teams.length} teams`);
    console.log(`   - ${competitions.length} competitions`);
    console.log(`   - ${games.length} games`);
    console.log(`   - ${bets.length} bets`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase(); 