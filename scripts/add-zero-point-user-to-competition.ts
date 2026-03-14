/**
 * Add one existing user (not already in the competition) to a completed competition
 * as last place with 0 points — for testing the ranking and "Hôte du Dîner" display.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS","target":"ES2015"}' scripts/add-zero-point-user-to-competition.ts
 * Dry run: add --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const competition = await prisma.competition.findFirst({
    where: {
      AND: [
        { name: { contains: 'Ligue 1', mode: 'insensitive' } },
        { name: { contains: '2025', mode: 'insensitive' } },
      ],
    },
    include: { users: { select: { userId: true } } },
  });

  if (!competition) {
    console.log('No competition matching "Ligue 1" and "2025" found.');
    process.exit(1);
  }

  const memberIds = competition.users.map(u => u.userId);
  const user = await prisma.user.findFirst({
    where: { id: { notIn: memberIds } },
    select: { id: true, name: true },
  });

  if (!user) {
    console.log('No user found outside this competition. All users are already members.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`DRY RUN. Would add user "${user.name}" (${user.id}) to competition "${competition.name}" as last place (0 points).`);
    return;
  }

  await prisma.competitionUser.create({
    data: {
      competitionId: competition.id,
      userId: user.id,
      shooters: 0,
    },
  });

  await prisma.competition.update({
    where: { id: competition.id },
    data: { lastPlaceId: user.id },
  });

  console.log(`Added "${user.name}" to "${competition.name}" with 0 points and set as last place (Hôte du Dîner).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
