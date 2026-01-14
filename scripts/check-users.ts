import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`Total users: ${users.length}`);
  console.log('\nUsers:');
  users.forEach(user => {
    console.log(`- ${user.name} (${user.email}) - Role: ${user.role}, Active: ${user.isActive}, Username: ${user.username || 'N/A'}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


