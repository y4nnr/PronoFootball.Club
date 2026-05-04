import { prisma } from './prisma';

const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

export type Standing = {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  totalPoints: number;
  exactScores: number;
  shooters: number;
  totalScoreDifference: number;
  position: number;
};

export type StandingsOptions = {
  upToDate?: Date;
  treatAsCompleted?: boolean;
};

/**
 * Single source of truth for computing the classement of a competition.
 * Mirrors the in-page Classement logic at pages/competitions/[id].tsx and the
 * finale logic at lib/competition-completion.ts so that news, charts, and the
 * page itself can never disagree on positions.
 *
 * Sort: totalPoints desc → exactScores desc → shooters asc
 *       → (totalScoreDifference asc, only if treatAsCompleted).
 * Players sharing every active sort key share the same position (1, 1, 3, …).
 *
 * upToDate restricts the snapshot to games scheduled on or before that date,
 * which lets callers reconstruct historical standings (per-matchday news,
 * evolution charts) without depending on the cumulative shooters column.
 */
export async function computeStandingsAtDate(
  competitionId: string,
  options: StandingsOptions = {}
): Promise<Standing[]> {
  const { upToDate, treatAsCompleted = false } = options;

  const competitionUsers = await prisma.competitionUser.findMany({
    where: { competitionId },
    include: { user: { select: { id: true, name: true, profilePictureUrl: true } } },
  });
  if (competitionUsers.length === 0) return [];

  const games = await prisma.game.findMany({
    where: {
      competitionId,
      status: 'FINISHED',
      AND: [
        { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
        { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
      ],
      ...(upToDate ? { date: { lte: upToDate } } : {}),
    },
    select: { id: true, homeScore: true, awayScore: true },
  });

  type Stats = {
    totalPoints: number;
    exactScores: number;
    totalScoreDifference: number;
    betCount: number;
  };
  const stats = new Map<string, Stats>();
  competitionUsers.forEach(cu => {
    stats.set(cu.userId, {
      totalPoints: 0,
      exactScores: 0,
      totalScoreDifference: 0,
      betCount: 0,
    });
  });

  if (games.length > 0) {
    const gameById = new Map(games.map(g => [g.id, g]));
    const bets = await prisma.bet.findMany({
      where: {
        gameId: { in: games.map(g => g.id) },
        userId: { in: competitionUsers.map(cu => cu.userId) },
      },
      select: {
        userId: true,
        gameId: true,
        points: true,
        score1: true,
        score2: true,
      },
    });
    bets.forEach(bet => {
      const s = stats.get(bet.userId);
      if (!s) return;
      const game = gameById.get(bet.gameId);
      if (!game) return;
      s.totalPoints += bet.points ?? 0;
      if (bet.points === 3) s.exactScores += 1;
      const home = game.homeScore ?? 0;
      const away = game.awayScore ?? 0;
      s.totalScoreDifference += Math.abs(bet.score1 - home) + Math.abs(bet.score2 - away);
      s.betCount += 1;
    });
  }

  const totalGames = games.length;

  const sorted = competitionUsers
    .map(cu => {
      const s = stats.get(cu.userId)!;
      return {
        userId: cu.userId,
        userName: cu.user.name,
        profilePictureUrl: cu.user.profilePictureUrl ?? null,
        totalPoints: s.totalPoints,
        exactScores: s.exactScores,
        shooters: totalGames - s.betCount,
        totalScoreDifference: s.totalScoreDifference,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
      if (a.shooters !== b.shooters) return a.shooters - b.shooters;
      if (treatAsCompleted) return a.totalScoreDifference - b.totalScoreDifference;
      return 0;
    });

  let lastPos = 0;
  let lastKey = '';
  return sorted.map((row, idx) => {
    const key = treatAsCompleted
      ? `${row.totalPoints}|${row.exactScores}|${row.shooters}|${row.totalScoreDifference}`
      : `${row.totalPoints}|${row.exactScores}|${row.shooters}`;
    if (key !== lastKey) {
      lastPos = idx + 1;
      lastKey = key;
    }
    return { ...row, position: lastPos };
  });
}
