import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
  const updated = await prisma.competition.updateMany({
    where: { status: 'FINISHED' },
    data: { status: 'COMPLETED' }
  });
  console.log(`Updated ${updated.count} competitions from FINISHED to COMPLETED`);
  process.exit(0);
}

migrate(); 