/**
 * Recalculate shooters for all competitions (excludes xxxx/xxx2/xxxx2 games).
 *
 * SAFETY: Only updates the "shooters" column on CompetitionUser. No deletes, no other columns.
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   Dry run (no writes): npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/recalculate-shooters.ts --dry-run
 *   Apply:               npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/recalculate-shooters.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

const DRY_RUN = process.argv.includes('--dry-run');

async function updateShootersForCompetition(competitionId: string, competitionName: string) {
  const competitionUsers = await prisma.competitionUser.findMany({
    where: { competitionId },
    include: { user: true }
  });

  const finishedGames = await prisma.game.findMany({
    where: {
      competitionId,
      status: { in: ['FINISHED', 'LIVE'] },
      AND: [
        { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
        { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } }
      ]
    }
  });

  const totalGames = finishedGames.length;

  for (const competitionUser of competitionUsers) {
    const userBets = await prisma.bet.count({
      where: {
        userId: competitionUser.userId,
        game: {
          competitionId,
          status: { in: ['FINISHED', 'LIVE'] },
          AND: [
            { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
            { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } }
          ]
        }
      }
    });

    const shooters = totalGames - userBets;
    const previous = competitionUser.shooters ?? 0;

    if (!DRY_RUN) {
      await prisma.competitionUser.update({
        where: { id: competitionUser.id },
        data: { shooters }
      });
    }

    if (previous !== shooters) {
      console.log(
        `   ${competitionUser.user.name}: ${previous} → ${shooters} (bets: ${userBets}, total games: ${totalGames})${DRY_RUN ? ' [dry-run, not written]' : ''}`
      );
    }
  }

  return { competitionName, totalGames, participants: competitionUsers.length };
}

async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN – no changes will be written.\n');
  }
  console.log('🎯 Recalculating shooters for all competitions (excluding xxxx/xxx2/xxxx2 games)...\n');

  const competitions = await prisma.competition.findMany({
    select: { id: true, name: true }
  });

  for (const comp of competitions) {
    console.log(`\n📊 ${comp.name}`);
    const result = await updateShootersForCompetition(comp.id, comp.name);
    console.log(`   Countable games: ${result.totalGames}, participants: ${result.participants}`);
  }

  console.log(DRY_RUN ? '\n✅ Dry run done. Run without --dry-run to apply.' : '\n✅ Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
