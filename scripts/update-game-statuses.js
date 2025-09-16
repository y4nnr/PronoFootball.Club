// scripts/update-game-statuses.js  (CommonJS)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting automatic game status update...');

  // 1) Log how many should flip (using DB-side local time)
  const [{ count }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "Game"
    WHERE "status" = 'UPCOMING'
      AND "date" <= (NOW() AT TIME ZONE 'Europe/Paris')
  `;
  console.log(`📊 Found ${count} games that should be LIVE`);

  if (count === 0) {
    console.log('✅ No games need status updates');
    return;
  }

  // 2) Update in one shot (fast + DST-safe)
  const updated = await prisma.$executeRaw`
    UPDATE "Game"
    SET "status" = 'LIVE'
    WHERE "status" = 'UPCOMING'
      AND "date" <= (NOW() AT TIME ZONE 'Europe/Paris')
  `;
  console.log(`✅ Updated rows: ${updated}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });