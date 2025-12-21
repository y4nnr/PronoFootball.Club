import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Activate all existing users (created before the isActive feature)
  // Since isActive defaults to false, we'll activate all users with isActive = false
  // except admins (they should already be able to login)
  const result = await prisma.user.updateMany({
    where: {
      isActive: false,
      role: {
        not: 'admin'
      }
    },
    data: {
      isActive: true
    }
  });

  console.log(`Activated ${result.count} existing users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

