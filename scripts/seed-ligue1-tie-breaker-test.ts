/**
 * Seed "Ligue 1 2025-26" (or similar) completed competition so we have:
 * - 2 players tied at 1st place (same pts, exact scores, shooters) — separated by totalScoreDifference in widget
 * - 1 player in the middle
 * - 2 players tied at last place
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-ligue1-tie-breaker-test.ts
 * Dry run: add --dry-run to only print what would be done.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

type BetRow = { id: string; gameId: string; homeScore: number; awayScore: number };

function pickScoreCorrectDiff1(home: number, away: number): [number, number] {
  if (home > away) return [home, away > 0 ? away - 1 : away + 1];
  if (home < away) return [home > 0 ? home - 1 : home + 1, away];
  return [home + 1, away + 1];
}

function pickScoreCorrectDiff2(home: number, away: number): [number, number] {
  if (home > away) return [home, away + 1];
  if (home < away) return [home + 1, away];
  return [home + 1, away];
}

function pickScoreWrongDiff1(home: number, away: number): [number, number] {
  if (home > 0) return [home + 1, away];
  return [home, away + 1];
}

function pickScoreWrongDiff3(home: number, away: number): [number, number] {
  return [home + 2, away + 1];
}

async function setWinnerAndLastPlace(competitionId: string) {
  const userPoints = await prisma.user.findMany({
    include: {
      bets: {
        where: { game: { competitionId, status: 'FINISHED' } },
        select: {
          points: true,
          score1: true,
          score2: true,
          game: { select: { homeScore: true, awayScore: true } },
        },
      },
    },
  });
  const competitionUsers = await prisma.competitionUser.findMany({
    where: { competitionId },
    select: { userId: true, shooters: true },
  });
  const shootersByUserId = new Map(competitionUsers.map(cu => [cu.userId, cu.shooters ?? 0]));

  const standings = userPoints
    .map(user => {
      const totalPoints = user.bets.reduce((sum: number, b: any) => sum + (b.points ?? 0), 0);
      const exactScores = user.bets.filter((b: any) => b.points === 3).length;
      const shooters = shootersByUserId.get(user.id) ?? 0;
      const totalScoreDifference = user.bets.reduce((sum: number, b: any) => {
        const h = b.game?.homeScore ?? 0;
        const a = b.game?.awayScore ?? 0;
        return sum + Math.abs(b.score1 - h) + Math.abs(b.score2 - a);
      }, 0);
      return { user, totalPoints, exactScores, shooters, totalScoreDifference, betCount: user.bets.length };
    })
    .filter(s => s.betCount > 0)
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if ((b.exactScores ?? 0) !== (a.exactScores ?? 0)) return (b.exactScores ?? 0) - (a.exactScores ?? 0);
      if ((a.shooters ?? 0) !== (b.shooters ?? 0)) return (a.shooters ?? 0) - (b.shooters ?? 0);
      return (a.totalScoreDifference ?? 0) - (b.totalScoreDifference ?? 0);
    });

  if (standings.length === 0) return;
  const winner = standings[0];
  const lastPlace = standings[standings.length - 1];
  await prisma.competition.update({
    where: { id: competitionId },
    data: { winnerId: winner.user.id, lastPlaceId: lastPlace.user.id },
  });
  console.log(`✅ Set winner: ${winner.user.name}, last: ${lastPlace.user.name}`);
}

async function main() {
  const competition = await prisma.competition.findFirst({
    where: {
      AND: [
        { name: { contains: 'Ligue 1', mode: 'insensitive' } },
        { name: { contains: '2025', mode: 'insensitive' } },
        { status: 'COMPLETED' },
      ],
    },
    include: { users: { include: { user: true } } },
  });

  if (!competition) {
    console.log('No completed competition matching "Ligue 1" and "2025" found.');
    process.exit(1);
  }
  const comp = competition;

  const finishedGames = await prisma.game.findMany({
    where: {
      competitionId: comp.id,
      status: 'FINISHED',
      homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } },
      awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } },
    },
    select: { id: true, homeScore: true, awayScore: true },
    orderBy: { date: 'asc' },
  });

  if (finishedGames.length === 0) {
    console.log('No finished games in this competition.');
    process.exit(1);
  }

  const gameIds = finishedGames.map(g => g.id);
  const gameById = new Map(finishedGames.map(g => [g.id, g]));

  const bets = await prisma.bet.findMany({
    where: { gameId: { in: gameIds } },
    select: { id: true, userId: true, gameId: true, score1: true, score2: true, points: true },
  });

  const userIds = Array.from(new Set(bets.map(b => b.userId)));
  if (userIds.length < 2) {
    console.log('Need at least 2 participants with bets.');
    process.exit(1);
  }

  const compUserIds = comp.users.map(cu => cu.userId).filter(id => userIds.includes(id));
  const orderedUserIds = compUserIds.length >= 5 ? compUserIds : userIds.slice(0, Math.max(2, userIds.length));
  const firstPair = [orderedUserIds[0], orderedUserIds[1]];
  const middle = orderedUserIds.length >= 3 ? orderedUserIds[2] : null;
  const lastPair = orderedUserIds.length >= 5 ? [orderedUserIds[3], orderedUserIds[4]] : orderedUserIds.length >= 4 ? [orderedUserIds[3], orderedUserIds[3]] : [];

  const betsByUser = new Map<string, BetRow[]>();
  for (const b of bets) {
    const game = gameById.get(b.gameId);
    if (!game || game.homeScore == null || game.awayScore == null) continue;
    if (!betsByUser.has(b.userId)) betsByUser.set(b.userId, []);
    betsByUser.get(b.userId)!.push({
      id: b.id,
      gameId: b.gameId,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    });
  }

  const n = finishedGames.length;
  if (n < 10) {
    console.log('Need at least 10 finished games. Found', n);
    process.exit(1);
  }

  const selectedIds = [firstPair[0], firstPair[1], ...(middle ? [middle] : []), ...(lastPair.length >= 2 && lastPair[0] !== lastPair[1] ? lastPair : [])];
  const minBets = Math.min(...selectedIds.map(id => (betsByUser.get(id) || []).length));
  if (minBets < 7) {
    console.log('Each selected user needs at least 7 bets. Min found:', minBets);
    process.exit(1);
  }
  const firstTargets = minBets >= 22 ? { points: 30, exact: 4, diff: 8 } : minBets >= 14 ? { points: 18, exact: 2, diff: 6 } : { points: 11, exact: 2, diff: 4 };
  const middleTargets = minBets >= 14 ? { points: 18, exact: 2 } : { points: 11, exact: 2 };
  const lastTargetPoints = 6;

  const updates: { betId: string; points: number; score1: number; score2: number }[] = [];
  const shooterUpdates: { competitionUserId: string; shooters: number }[] = [];

  function assignBets(
    userId: string,
    targetPoints: number,
    targetExact: number,
    targetDiff: number,
    shooters: number,
    wrongDiff1Count?: number
  ) {
    const list = betsByUser.get(userId) || [];
    const needCorrect = targetPoints - targetExact * 3;
    if (list.length < targetExact + needCorrect) {
      console.warn(`User ${userId} has only ${list.length} bets, need ${targetExact + needCorrect}.`);
      return;
    }
    let exactCount = 0;
    let correctCount = 0;
    let correctWithDiff1 = 0;
    let wrongCount = 0;
    const wantDiff1 = Math.min(needCorrect, Math.max(0, targetDiff));
    for (let i = 0; i < list.length; i++) {
      const { id, homeScore: home, awayScore: away } = list[i];
      let points: number;
      let s1: number, s2: number;
      if (exactCount < targetExact) {
        points = 3;
        s1 = home;
        s2 = away;
        exactCount++;
      } else if (correctCount < needCorrect) {
        points = 1;
        if (correctWithDiff1 < wantDiff1) {
          [s1, s2] = pickScoreCorrectDiff1(home, away);
          correctWithDiff1++;
        } else {
          [s1, s2] = pickScoreCorrectDiff2(home, away);
        }
        correctCount++;
      } else {
        points = 0;
        if (wrongDiff1Count != null && wrongCount < wrongDiff1Count) {
          [s1, s2] = pickScoreWrongDiff1(home, away);
          wrongCount++;
        } else {
          [s1, s2] = pickScoreWrongDiff3(home, away);
        }
      }
      updates.push({ betId: id, points, score1: s1, score2: s2 });
    }
    const cu = comp.users.find(c => c.userId === userId);
    if (cu) shooterUpdates.push({ competitionUserId: cu.id, shooters });
  }

  // First pair: same points & exact, different totalScoreDifference (widget order)
  assignBets(firstPair[0], firstTargets.points, firstTargets.exact, firstTargets.diff, 0);
  assignBets(firstPair[1], firstTargets.points, firstTargets.exact, firstTargets.diff + 4, 0);
  if (middle) assignBets(middle, middleTargets.points, middleTargets.exact, 10, 1);
  if (lastPair.length >= 2 && lastPair[0] !== lastPair[1]) {
    assignBets(lastPair[0], lastTargetPoints, 0, 0, 2, 8);
    assignBets(lastPair[1], lastTargetPoints, 0, 0, 2, 13);
  }

  if (DRY_RUN) {
    console.log('DRY RUN. Would update', updates.length, 'bets and', shooterUpdates.length, 'CompetitionUser shooters.');
    console.log('First pair:', firstPair, 'Middle:', middle, 'Last pair:', lastPair);
    return;
  }

  for (const u of updates) {
    await prisma.bet.update({
      where: { id: u.betId },
      data: { points: u.points, score1: u.score1, score2: u.score2 },
    });
  }
  for (const s of shooterUpdates) {
    await prisma.competitionUser.update({
      where: { id: s.competitionUserId },
      data: { shooters: s.shooters },
    });
  }

  await setWinnerAndLastPlace(comp.id);
  console.log('Done. Competition', comp.name, 'seeded: 2 tied at 1st, 1 middle, 2 tied at last.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
