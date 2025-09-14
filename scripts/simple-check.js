const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing database connection...');
    
    const competitions = await prisma.competition.findMany({
      select: {
        id: true,
        name: true,
        winnerId: true,
        winner: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`Found ${competitions.length} competitions:`);
    
    competitions.forEach(comp => {
      console.log(`- ${comp.name} (Winner: ${comp.winner ? comp.winner.name : 'None'})`);
    });
    
    const cl2021 = competitions.find(c => c.name.includes('2020'));
    if (cl2021) {
      console.log(`\nChampions League 2020/21 found: ${cl2021.name}`);
      console.log(`Winner: ${cl2021.winner ? cl2021.winner.name : 'None'}`);
    } else {
      console.log('\nNo Champions League 2020/21 found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 