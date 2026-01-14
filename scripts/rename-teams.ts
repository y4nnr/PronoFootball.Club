/**
 * Script to rename teams with sport suffix back to original name
 * Now that schema allows duplicate names with different sportType
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Renaming teams with sport suffix...\n');

  const teams = await prisma.team.findMany({
    where: {
      name: {
        contains: ' (',
      },
    },
  });

  console.log(`Found ${teams.length} teams with suffix\n`);

  for (const team of teams) {
    // Extract original name (remove " (SPORT)" suffix)
    const match = team.name.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      const originalName = match[1].trim();
      const sportSuffix = match[2].trim();
      
      // Verify the sportType matches
      if (team.sportType && team.sportType.toLowerCase() === sportSuffix.toLowerCase()) {
        console.log(`Renaming: "${team.name}" → "${originalName}" (${team.sportType})`);
        
        try {
          await prisma.team.update({
            where: { id: team.id },
            data: { name: originalName },
          });
          console.log(`  ✅ Renamed successfully`);
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`  ⚠️  Cannot rename: team "${originalName}" with sportType "${team.sportType}" already exists`);
          } else {
            console.log(`  ❌ Error: ${error.message}`);
          }
        }
      } else {
        console.log(`  ⚠️  Skipping: sportType mismatch (${team.sportType} vs ${sportSuffix})`);
      }
    }
  }

  console.log('\n✅ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

