const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listCompetitions() {
  try {
    const competitions = await prisma.competition.findMany({
      orderBy: {
        startDate: 'desc'
      }
    });
    
    console.log('All competitions:');
    competitions.forEach(c => {
      console.log(`- ${c.name} (ID: ${c.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listCompetitions(); 