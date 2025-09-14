console.log('Starting script...');

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Database connected...');
    
    // Find Yann
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    console.log('Yann found:', yann ? yann.name : 'Not found');
    
    if (!yann) return;
    
    // Find all competitions where Yann is the winner
    const competitions = await prisma.competition.findMany({
      where: {
        winnerId: yann.id
      }
    });
    
    console.log(`Yann wins ${competitions.length} competitions:`);
    competitions.forEach(comp => {
      console.log(`- ${comp.name} (ID: ${comp.id})`);
    });
    
    // Specifically check for Champions League 2020/21
    const cl2021 = await prisma.competition.findFirst({
      where: {
        id: 'cmb93082x0000hu7i0zh875u1'
      },
      include: {
        winner: true
      }
    });
    
    if (cl2021) {
      console.log('\nChampions League 2020/21:');
      console.log(`Name: ${cl2021.name}`);
      console.log(`Winner: ${cl2021.winner ? cl2021.winner.name : 'None'}`);
      console.log(`Winner ID: ${cl2021.winnerId}`);
      console.log(`Yann ID: ${yann.id}`);
      console.log(`Match: ${cl2021.winnerId === yann.id}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 