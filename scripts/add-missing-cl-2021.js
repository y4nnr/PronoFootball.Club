const { PrismaClient } = require('@prisma/client');

async function addMissingCL2021() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Adding missing UEFA Champions League 2020/21...\n');
    
    // Check if it already exists
    const existing = await prisma.competition.findFirst({
      where: {
        name: {
          contains: 'Champions League 2020'
        }
      }
    });
    
    if (existing) {
      console.log('✅ Champions League 2020/21 already exists');
      console.log(`Name: ${existing.name}`);
      console.log(`Winner ID: ${existing.winnerId}`);
      return;
    }
    
    // Find Yann (the winner)
    const yann = await prisma.user.findFirst({
      where: { name: 'Yann' }
    });
    
    if (!yann) {
      console.log('❌ Yann not found');
      return;
    }
    
    console.log(`Found Yann: ${yann.name} (ID: ${yann.id})`);
    
    // Create the competition
    const competition = await prisma.competition.create({
      data: {
        name: 'UEFA Champions League 2020/21',
        description: 'The 2020–21 UEFA Champions League season with 125 games total. Won by Yann with 108 points.',
        logo: 'https://upload.wikimedia.org/wikipedia/en/f/f5/UEFA_Champions_League.svg',
        startDate: new Date('2020-09-20T00:00:00.000Z'),
        endDate: new Date('2021-05-29T00:00:00.000Z'),
        status: 'FINISHED',
        winnerId: yann.id
      }
    });
    
    console.log(`✅ Created competition: ${competition.name}`);
    console.log(`🆔 ID: ${competition.id}`);
    console.log(`🏆 Winner: ${yann.name}`);
    
    // Add the 9 users who participated
    const userNames = ['Yann', 'Benouz', 'Keke', 'Fifi', 'Francky', 'Renato', 'Nono', 'Baptiste', 'Steph'];
    
    for (const userName of userNames) {
      const user = await prisma.user.findFirst({
        where: { name: userName }
      });
      
      if (user) {
        await prisma.competitionUser.create({
          data: {
            userId: user.id,
            competitionId: competition.id
          }
        });
        console.log(`👤 Added ${userName} to competition`);
      }
    }
    
    console.log('\n🎉 UEFA Champions League 2020/21 successfully added!');
    console.log('Yann should now appear in the "Most Competitions Won" section.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingCL2021(); 