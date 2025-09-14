console.log('Testing database connection...');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.competition.count()
  .then(count => {
    console.log('✅ Database connected! Found', count, 'competitions');
    return prisma.$disconnect();
  })
  .catch(error => {
    console.error('❌ Database connection failed:', error.message);
    return prisma.$disconnect();
  }); 