const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Fixing Champions League 2020/21 winner...');
    
    // Find Champions League 2020/21
    const competition = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 2020'
        }
      }
    });
    
    if (!competition) {
      console.log('❌ Champions League 2020/21 not found');
      return;
    }
    
    console.log(`Found: ${competition.name}`);
    
    // Find Yann
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    if (!yann) {
      console.log('❌ Yann not found');
      return;
    }
    
    console.log(`Found Yann: ${yann.name} (ID: ${yann.id})`);
    
    // Check current winner
    console.log(`Current winner ID: ${competition.winnerId}`);
    
    if (competition.winnerId === yann.id) {
      console.log('✅ Yann is already set as winner');
    } else {
      console.log('🔧 Setting Yann as winner...');
      
      await prisma.competition.update({
        where: { id: competition.id },
        data: { winnerId: yann.id }
      });
      
      console.log('✅ Yann set as winner of Champions League 2020/21');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})(); 