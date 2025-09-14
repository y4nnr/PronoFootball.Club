const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const competition = await prisma.competition.findUnique({
      where: { id: 'cmb93082x0000hu7i0zh875u1' },
      include: { winner: true }
    });
    
    console.log('Champions League 2020/21:');
    console.log('Winner:', competition?.winner?.name || 'None');
    console.log('Winner ID:', competition?.winnerId || 'None');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})(); 