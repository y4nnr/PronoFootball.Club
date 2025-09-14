const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('Setting Yann as winner of Champions League 2020/21...');
    
    // Find Yann
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    if (!yann) {
      console.log('Yann not found');
      process.exit(1);
    }
    
    console.log(`Found Yann with ID: ${yann.id}`);
    
    // Update the specific Champions League competition
    const result = await prisma.competition.update({
      where: {
        id: 'cmb93082x0000hu7i0zh875u1'
      },
      data: {
        winnerId: yann.id
      }
    });
    
    console.log('✅ Successfully set Yann as winner');
    console.log(`Competition: ${result.name}`);
    console.log(`Winner ID: ${result.winnerId}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})(); 