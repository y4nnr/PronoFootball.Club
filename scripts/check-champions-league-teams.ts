/**
 * Script to check Champions League teams for final winner prediction
 * Matches user-provided team names to exact database names
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// User-provided team list
const userTeamList = [
  'Arsenal',
  'Bayern Munich',
  'Liverpool',
  'Tottenham Hotspur',
  'Barcelona',
  'Chelsea',
  'Sporting CP',
  'Manchester City',
  'Real Madrid',
  'Inter Milan',
  'Paris Saint-Germain',
  'Newcastle United',
  'Juventus',
  'Atlético Madrid',
  'Atalanta',
  'Bayer Leverkusen',
  'Borussia Dortmund',
  'Olympiacos',
  'Club Brugge',
  'Galatasaray',
  'Monaco',
  'Qarabağ',
  'Bodø/Glimt',
  'Benfica'
];

async function main() {
  console.log('🔍 Checking Champions League teams in database...\n');
  console.log(`Looking for ${userTeamList.length} teams\n`);

  const results: Array<{
    userProvided: string;
    found: boolean;
    exactMatch?: string;
    similarMatches?: string[];
    teamId?: string;
  }> = [];

  for (const userTeamName of userTeamList) {
    // Try exact match first
    const exactMatch = await prisma.team.findFirst({
      where: {
        name: userTeamName,
        sportType: 'FOOTBALL' // Champions League is football
      }
    });

    if (exactMatch) {
      results.push({
        userProvided: userTeamName,
        found: true,
        exactMatch: exactMatch.name,
        teamId: exactMatch.id
      });
      console.log(`✅ "${userTeamName}" → Found exact match: "${exactMatch.name}" (ID: ${exactMatch.id})`);
      continue;
    }

    // Try case-insensitive match
    const allFootballTeams = await prisma.team.findMany({
      where: {
        sportType: 'FOOTBALL'
      }
    });

    const caseInsensitiveMatch = allFootballTeams.find(
      team => team.name.toLowerCase() === userTeamName.toLowerCase()
    );

    if (caseInsensitiveMatch) {
      results.push({
        userProvided: userTeamName,
        found: true,
        exactMatch: caseInsensitiveMatch.name,
        teamId: caseInsensitiveMatch.id
      });
      console.log(`✅ "${userTeamName}" → Found case-insensitive match: "${caseInsensitiveMatch.name}" (ID: ${caseInsensitiveMatch.id})`);
      continue;
    }

    // Try partial/fuzzy match
    const normalizedUser = userTeamName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const similarTeams = allFootballTeams.filter(team => {
      const normalizedDB = team.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedDB.includes(normalizedUser) || normalizedUser.includes(normalizedDB);
    });

    if (similarTeams.length > 0) {
      results.push({
        userProvided: userTeamName,
        found: false,
        similarMatches: similarTeams.map(t => t.name)
      });
      console.log(`⚠️  "${userTeamName}" → No exact match found. Similar teams:`);
      similarTeams.forEach(team => {
        console.log(`     - "${team.name}" (ID: ${team.id})`);
      });
    } else {
      results.push({
        userProvided: userTeamName,
        found: false
      });
      console.log(`❌ "${userTeamName}" → NOT FOUND in database`);
    }
  }

  console.log('\n📊 Summary:\n');
  const found = results.filter(r => r.found).length;
  const notFound = results.filter(r => !r.found && !r.similarMatches).length;
  const similar = results.filter(r => !r.found && r.similarMatches).length;

  console.log(`✅ Found: ${found}/${userTeamList.length}`);
  console.log(`⚠️  Similar matches: ${similar}`);
  console.log(`❌ Not found: ${notFound}`);

  if (found === userTeamList.length) {
    console.log('\n✅ All teams found! Ready to implement hardcoded list.');
    console.log('\n📋 Team IDs for implementation:');
    results.forEach(r => {
      if (r.found && r.teamId) {
        console.log(`  "${r.exactMatch}": "${r.teamId}",`);
      }
    });
  } else {
    console.log('\n⚠️  Some teams need attention before implementation.');
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
