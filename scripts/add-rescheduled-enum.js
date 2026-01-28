const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addRescheduledEnum() {
  try {
    console.log('🔍 Checking if RESCHEDULED enum value exists...');
    
    // Check if the enum value exists by trying to query it
    const result = await prisma.$queryRaw`
      SELECT unnest(enum_range(NULL::"GameStatus")) AS status;
    `;
    
    const enumValues = result.map(r => r.status);
    console.log('📊 Current enum values:', enumValues);
    
    if (enumValues.includes('RESCHEDULED')) {
      console.log('✅ RESCHEDULED enum value already exists!');
      return;
    }
    
    console.log('➕ Adding RESCHEDULED enum value...');
    
    // Add the enum value
    await prisma.$executeRaw`
      ALTER TYPE "GameStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';
    `;
    
    console.log('✅ RESCHEDULED enum value added successfully!');
    
    // Verify it was added
    const resultAfter = await prisma.$queryRaw`
      SELECT unnest(enum_range(NULL::"GameStatus")) AS status;
    `;
    
    const enumValuesAfter = resultAfter.map(r => r.status);
    console.log('📊 Updated enum values:', enumValuesAfter);
    
  } catch (error) {
    console.error('❌ Error:', error);
    // If the error is that the value already exists, that's okay
    if (error.message && error.message.includes('already exists')) {
      console.log('✅ RESCHEDULED enum value already exists (error is expected)');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

addRescheduledEnum()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
