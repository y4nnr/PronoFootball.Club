/**
 * Script to fix team categories for existing teams
 * - Sets CLUB category for teams in local competitions (Ligue 1, Top 14, etc.)
 * - Sets NATIONAL category for teams in international competitions
 * - Separates teams by sportType (Lyon Football vs Lyon Rugby)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting team category fix...\n');

  // Get all competitions
  const competitions = await prisma.competition.findMany({
    include: {
      games: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
    },
  });

  console.log(`Found ${competitions.length} competitions\n`);

  // Determine correct category for each competition
  const competitionCategories = new Map<string, 'CLUB' | 'NATIONAL'>();
  
  for (const comp of competitions) {
    const compNameLower = comp.name.toLowerCase();
    
    // International competitions
    const isInternational = 
      !comp.name.includes('Ligue') &&
      !comp.name.includes('Premier League') &&
      !comp.name.includes('Serie A') &&
      !comp.name.includes('Bundesliga') &&
      !comp.name.includes('La Liga') &&
      !comp.name.includes('Top 14') &&
      !comp.name.includes('Pro D2') &&
      !comp.name.includes('Premiership') &&
      (compNameLower.includes('champions league') ||
       compNameLower.includes('europa league') ||
       compNameLower.includes('world cup') ||
       compNameLower.includes('euro') ||
       compNameLower.includes('copa america') ||
       compNameLower.includes('africa cup') ||
       compNameLower.includes('asia cup'));
    
    const category = isInternational ? 'NATIONAL' : 'CLUB';
    competitionCategories.set(comp.id, category);
    
    console.log(`Competition: ${comp.name} (${comp.sportType}) → ${category}`);
  }

  console.log('\n📊 Updating teams...\n');

  // Update teams based on competitions they play in
  const teamsToUpdate = new Map<string, { category: 'CLUB' | 'NATIONAL'; sportType: string; country: string | null }>();
  
  for (const comp of competitions) {
    const correctCategory = competitionCategories.get(comp.id) || 'CLUB';
    
    for (const game of comp.games) {
      // Home team
      if (game.homeTeam) {
        const current = teamsToUpdate.get(game.homeTeam.id) || {
          category: game.homeTeam.category,
          sportType: game.homeTeam.sportType || comp.sportType,
          country: game.homeTeam.country,
        };
        
        // If team plays in CLUB competition, it should be CLUB
        // If team plays in NATIONAL competition, it should be NATIONAL
        if (correctCategory === 'CLUB') {
          current.category = 'CLUB';
        } else if (correctCategory === 'NATIONAL' && current.category !== 'CLUB') {
          // Only set to NATIONAL if not already CLUB (CLUB takes priority if team plays in both)
          current.category = 'NATIONAL';
        }
        
        current.sportType = comp.sportType; // Use competition's sportType
        
        // Set country based on competition name patterns
        if (!current.country) {
          if (comp.name.includes('France') || comp.name.includes('Ligue 1') || comp.name.includes('Top 14')) {
            current.country = 'France';
          } else if (comp.name.includes('England') || comp.name.includes('Premier League')) {
            current.country = 'England';
          } else if (comp.name.includes('Spain') || comp.name.includes('La Liga')) {
            current.country = 'Spain';
          } else if (comp.name.includes('Italy') || comp.name.includes('Serie A')) {
            current.country = 'Italy';
          } else if (comp.name.includes('Germany') || comp.name.includes('Bundesliga')) {
            current.country = 'Germany';
          }
        }
        
        teamsToUpdate.set(game.homeTeam.id, current);
      }
      
      // Away team
      if (game.awayTeam) {
        const current = teamsToUpdate.get(game.awayTeam.id) || {
          category: game.awayTeam.category,
          sportType: game.awayTeam.sportType || comp.sportType,
          country: game.awayTeam.country,
        };
        
        if (correctCategory === 'CLUB') {
          current.category = 'CLUB';
        } else if (correctCategory === 'NATIONAL' && current.category !== 'CLUB') {
          current.category = 'NATIONAL';
        }
        
        current.sportType = comp.sportType;
        
        // Set country based on competition name patterns
        if (!current.country) {
          if (comp.name.includes('France') || comp.name.includes('Ligue 1') || comp.name.includes('Top 14')) {
            current.country = 'France';
          } else if (comp.name.includes('England') || comp.name.includes('Premier League')) {
            current.country = 'England';
          } else if (comp.name.includes('Spain') || comp.name.includes('La Liga')) {
            current.country = 'Spain';
          } else if (comp.name.includes('Italy') || comp.name.includes('Serie A')) {
            current.country = 'Italy';
          } else if (comp.name.includes('Germany') || comp.name.includes('Bundesliga')) {
            current.country = 'Germany';
          }
        }
        
        teamsToUpdate.set(game.awayTeam.id, current);
      }
    }
  }

  // Apply updates
  let updated = 0;
  for (const [teamId, updateData] of Array.from(teamsToUpdate.entries())) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) continue;
    
    const needsUpdate = 
      team.category !== updateData.category ||
      team.sportType !== updateData.sportType ||
      (updateData.country && team.country !== updateData.country);
    
    if (needsUpdate) {
      await prisma.team.update({
        where: { id: teamId },
        data: {
          category: updateData.category,
          sportType: updateData.sportType as any,
          country: updateData.country || team.country,
        },
      });
      console.log(`✅ Updated: ${team.name} → ${updateData.category}, ${updateData.sportType}, ${updateData.country || 'N/A'}`);
      updated++;
    }
  }

  console.log(`\n✅ Fixed ${updated} teams`);
  
  // Handle duplicate teams (same name, different sports)
  console.log('\n🔍 Checking for duplicate teams (same name, different sports)...\n');
  
  const allTeams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
  });
  
  const teamsByName = new Map<string, typeof allTeams>();
  for (const team of allTeams) {
    if (!teamsByName.has(team.name)) {
      teamsByName.set(team.name, []);
    }
    teamsByName.get(team.name)!.push(team);
  }
  
  for (const [name, teams] of Array.from(teamsByName.entries())) {
    if (teams.length > 1) {
      const hasFootball = teams.some(t => t.sportType === 'FOOTBALL');
      const hasRugby = teams.some(t => t.sportType === 'RUGBY');
      
      if (hasFootball && hasRugby) {
        console.log(`⚠️ Found duplicate: ${name} (${teams.length} teams)`);
        for (const team of teams) {
          console.log(`   - ${team.id}: ${team.sportType || 'NO SPORT'}, ${team.category}, ${team.country || 'NO COUNTRY'}`);
        }
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

