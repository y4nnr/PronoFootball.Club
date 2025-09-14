const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCompetitions() {
  try {
    const competitions = await prisma.competition.findMany({
      include: {
        _count: {
          select: {
            games: true,
            users: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('📊 Current competitions:');
    console.log('========================');
    
    for (const comp of competitions) {
      console.log(`\n🏆 ${comp.name}`);
      console.log(`   Description: ${comp.description}`);
      console.log(`   Games: ${comp._count.games}`);
      console.log(`   Participants: ${comp._count.users}`);
      console.log(`   Status: ${comp.status}`);
      console.log(`   Created: ${comp.createdAt.toISOString().split('T')[0]}`);
    }

    console.log(`\n📈 Total competitions: ${competitions.length}`);

  } catch (error) {
    console.error('❌ Error checking competitions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompetitions(); 