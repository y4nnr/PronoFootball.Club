import { prisma } from './prisma';

const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

export type FinalStanding = {
  user: { id: string; name: string };
  totalPoints: number;
  exactScores: number;
  shooters: number;
  totalScoreDifference: number;
  position: number;
};

/**
 * Compute the final classement of a competition using the same 4-criterion sort
 * as the Classement page: totalPoints desc → exactScores desc → shooters asc →
 * totalScoreDifference asc. Players sharing all 4 criteria share the same position.
 */
export async function computeFinalStandings(competitionId: string): Promise<FinalStanding[]> {
  const competitionUsers = await prisma.competitionUser.findMany({
    where: { competitionId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (competitionUsers.length === 0) return [];

  const participantIds = competitionUsers.map(cu => cu.userId);
  const finishedGames = await prisma.game.findMany({
    where: {
      competitionId,
      status: 'FINISHED',
      AND: [
        { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
        { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
      ],
    },
    select: { id: true },
  });
  const finishedGameIds = finishedGames.map(g => g.id);

  const stats = new Map<string, { totalPoints: number; exactScores: number; totalScoreDifference: number }>();
  participantIds.forEach(id => stats.set(id, { totalPoints: 0, exactScores: 0, totalScoreDifference: 0 }));

  if (finishedGameIds.length > 0) {
    const bets = await prisma.bet.findMany({
      where: { gameId: { in: finishedGameIds }, userId: { in: participantIds } },
      select: {
        userId: true,
        points: true,
        score1: true,
        score2: true,
        game: { select: { homeScore: true, awayScore: true } },
      },
    });
    bets.forEach(bet => {
      const s = stats.get(bet.userId);
      if (!s) return;
      s.totalPoints += bet.points ?? 0;
      if (bet.points === 3) s.exactScores += 1;
      const home = bet.game?.homeScore ?? 0;
      const away = bet.game?.awayScore ?? 0;
      s.totalScoreDifference += Math.abs(bet.score1 - home) + Math.abs(bet.score2 - away);
    });
  }

  const sorted = competitionUsers
    .map(cu => {
      const s = stats.get(cu.userId) ?? { totalPoints: 0, exactScores: 0, totalScoreDifference: 0 };
      return {
        user: cu.user,
        totalPoints: s.totalPoints,
        exactScores: s.exactScores,
        shooters: cu.shooters ?? 0,
        totalScoreDifference: s.totalScoreDifference,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
      if (a.shooters !== b.shooters) return a.shooters - b.shooters;
      return a.totalScoreDifference - b.totalScoreDifference;
    });

  // Assign shared positions when all 4 criteria match (1, 1, 3, …)
  let lastPos = 0;
  let lastKey = '';
  return sorted.map((row, idx) => {
    const key = `${row.totalPoints}|${row.exactScores}|${row.shooters}|${row.totalScoreDifference}`;
    if (key !== lastKey) {
      lastPos = idx + 1;
      lastKey = key;
    }
    return { ...row, position: lastPos };
  });
}

/**
 * Set Competition.winnerId and Competition.lastPlaceId from the final standings.
 * Tied players: any player at position 1 is a winner, any at the last position is a host.
 * The Competition row only stores ONE winnerId/lastPlaceId — we pick the first by sort order
 * for the column, but the Champion / Hôte du Dîner widgets compute ties separately from standings.
 */
export async function setCompetitionWinnerAndLastPlace(competitionId: string): Promise<void> {
  const standings = await computeFinalStandings(competitionId);
  if (standings.length === 0) {
    console.log(`⚠️  setCompetitionWinnerAndLastPlace: no participants for ${competitionId}`);
    return;
  }
  const winner = standings[0];
  const lastPlace = standings[standings.length - 1];
  await prisma.competition.update({
    where: { id: competitionId },
    data: { winnerId: winner.user.id, lastPlaceId: lastPlace.user.id },
  });
  console.log(`✅ Winner: ${winner.user.name} (${winner.totalPoints} pts) · Last: ${lastPlace.user.name} (${lastPlace.totalPoints} pts) for ${competitionId}`);
}

/**
 * If every non-placeholder game in the competition is FINISHED (i.e. nothing
 * UPCOMING/LIVE/RESCHEDULED), flip the competition to COMPLETED and set
 * winnerId/lastPlaceId. Idempotent. Skips CANCELLED or already-COMPLETED comps.
 *
 * MUST be called AFTER any +5 bonus (e.g. awardFinalWinnerPoints) has been
 * applied for the same flip — otherwise winner/last computation would use
 * pre-bonus points.
 */
export async function maybeAutoCompleteCompetition(competitionId: string): Promise<void> {
  try {
    const comp = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, status: true },
    });
    if (!comp) return;
    const status = comp.status.toLowerCase();
    if (status === 'completed' || status === 'cancelled') return;

    const pending = await prisma.game.count({
      where: {
        competitionId,
        status: { in: ['UPCOMING', 'LIVE', 'RESCHEDULED'] },
        AND: [
          { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
          { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
        ],
      },
    });
    if (pending > 0) return;

    const finished = await prisma.game.count({
      where: { competitionId, status: 'FINISHED' },
    });
    if (finished === 0) return;

    await prisma.competition.update({
      where: { id: competitionId },
      data: { status: 'COMPLETED' },
    });
    await setCompetitionWinnerAndLastPlace(competitionId);
    console.log(`🏆 Auto-completed competition: ${comp.name} (${competitionId})`);
  } catch (error) {
    console.error(`❌ maybeAutoCompleteCompetition error for ${competitionId}:`, error);
  }
}
