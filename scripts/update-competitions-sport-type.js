/**
 * Script to update existing competitions with sportType = 'FOOTBALL'
 * This ensures all existing competitions have the sportType field set
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating existing competitions with sportType...');
  
  try {
    // Update all competitions that don't have sportType set (shouldn't happen with default, but just in case)
    const result = await prisma.competition.updateMany({
      where: {
        // This will match all competitions since sportType has a default value
        // But we'll explicitly set it to FOOTBALL for all existing ones
      },
      data: {
        sportType: 'FOOTBALL'
      }
    });
    
    console.log(`✅ Updated ${result.count} competitions with sportType = 'FOOTBALL'`);
    
    // Verify
    const competitions = await prisma.competition.findMany({
      select: {
        id: true,
        name: true,
        sportType: true
      }
    });
    
    console.log(`\n📊 Current competitions:`);
    competitions.forEach(comp => {
      console.log(`  - ${comp.name}: ${comp.sportType || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Error updating competitions:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

