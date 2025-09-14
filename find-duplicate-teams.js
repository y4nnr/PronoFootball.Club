const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Function to normalize team names for comparison
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(as|ac|fc|cf|sc|rc|real|cd|club|athletic|atletico)\s+/i, '')
    .replace(/\s+(as|ac|fc|cf|sc|rc|real|cd|club|athletic|atletico)$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Function to find potential duplicates
function findDuplicates(teams) {
  const duplicateGroups = [];
  const processed = new Set();
  
  for (let i = 0; i < teams.length; i++) {
    if (processed.has(teams[i].id)) continue;
    
    const currentNormalized = normalizeTeamName(teams[i].name);
    const duplicates = [teams[i]];
    processed.add(teams[i].id);
    
    for (let j = i + 1; j < teams.length; j++) {
      if (processed.has(teams[j].id)) continue;
      
      const compareNormalized = normalizeTeamName(teams[j].name);
      
      // Check for exact match or very similar names
      if (currentNormalized === compareNormalized || 
          teams[i].name.toLowerCase().includes(teams[j].name.toLowerCase()) ||
          teams[j].name.toLowerCase().includes(teams[i].name.toLowerCase())) {
        duplicates.push(teams[j]);
        processed.add(teams[j].id);
      }
    }
    
    if (duplicates.length > 1) {
      // Sort by creation date (oldest first)
      duplicates.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      duplicateGroups.push(duplicates);
    }
  }
  
  return duplicateGroups;
}

async function findAndRemoveDuplicateTeams() {
  try {
    console.log('=== Finding Duplicate Teams ===');
    
    // Get all teams with creation dates
    const teams = await prisma.team.findMany({
      orderBy: { name: 'asc' }
    });
    
    console.log(`Total teams: ${teams.length}`);
    
    // Find potential duplicates
    const duplicateGroups = findDuplicates(teams);
    
    if (duplicateGroups.length === 0) {
      console.log('No duplicate teams found.');
      return;
    }
    
    console.log(`\nFound ${duplicateGroups.length} duplicate groups:`);
    
    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      console.log(`\n--- Duplicate Group ${i + 1} ---`);
      
      group.forEach((team, index) => {
        console.log(`${index === 0 ? '✅ KEEP' : '❌ REMOVE'}: ${team.name} (Created: ${new Date(team.createdAt).toLocaleDateString()})`);
      });
      
      const keepTeam = group[0]; // Oldest team
      const duplicateTeams = group.slice(1); // Newer teams to remove
      
      // Update games to use the kept team
      for (const duplicateTeam of duplicateTeams) {
        console.log(`\n🔄 Updating games for ${duplicateTeam.name} -> ${keepTeam.name}`);
        
        // Update home games
        const homeGamesUpdated = await prisma.game.updateMany({
          where: { homeTeamId: duplicateTeam.id },
          data: { homeTeamId: keepTeam.id }
        });
        
        // Update away games
        const awayGamesUpdated = await prisma.game.updateMany({
          where: { awayTeamId: duplicateTeam.id },
          data: { awayTeamId: keepTeam.id }
        });
        
        console.log(`   - Updated ${homeGamesUpdated.count} home games`);
        console.log(`   - Updated ${awayGamesUpdated.count} away games`);
        
        // Delete the duplicate team
        await prisma.team.delete({
          where: { id: duplicateTeam.id }
        });
        
        console.log(`   ✅ Deleted duplicate team: ${duplicateTeam.name}`);
      }
    }
    
    console.log('\n✅ Successfully removed all duplicate teams!');
    
    // Verify results
    console.log('\n=== Verification ===');
    const remainingTeams = await prisma.team.findMany({
      orderBy: { name: 'asc' }
    });
    console.log(`Teams after cleanup: ${remainingTeams.length}`);
    
    // Check for any remaining potential duplicates
    const remainingDuplicates = findDuplicates(remainingTeams);
    if (remainingDuplicates.length > 0) {
      console.log('⚠️  Still found potential duplicates:');
      remainingDuplicates.forEach((group, i) => {
        console.log(`Group ${i + 1}:`);
        group.forEach(team => console.log(`  - ${team.name}`));
      });
    } else {
      console.log('✅ No remaining duplicates found');
    }
    
  } catch (error) {
    console.error('Error finding/removing duplicate teams:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findAndRemoveDuplicateTeams(); 