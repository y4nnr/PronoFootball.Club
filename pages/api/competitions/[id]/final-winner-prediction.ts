import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../api/auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: competitionId } = req.query;
  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Competition ID is required' });
  }

  try {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, finalWinnerEnabled: true, finalWinnerLockAt: true },
    });
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    if (!competition.finalWinnerEnabled) {
      return res.status(404).json({ error: 'Feature not available for this competition' });
    }

    const lockAt = competition.finalWinnerLockAt;
    const selectionLocked = lockAt ? new Date() >= lockAt : false;

    if (req.method === 'GET') {
      const competitionUser = await prisma.competitionUser.findUnique({
        where: { competitionId_userId: { competitionId, userId: session.user.id } },
        include: {
          finalWinnerTeam: { select: { id: true, name: true, logo: true, shortName: true } },
        },
      });
      const userPrediction = competitionUser?.finalWinnerTeam ?? null;

      // The final-winner prediction has a single deadline: competition.finalWinnerLockAt.
      // It is NOT tied to whether a regular per-game match is currently live — those are
      // unrelated bets handled by a different endpoint.
      const deadline = lockAt;
      const deadlinePassed = selectionLocked;

      // Eligible teams = every distinct team appearing in a non-placeholder game of this competition.
      const teamRows = await prisma.game.findMany({
        where: {
          competitionId,
          AND: [
            { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
            { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
          ],
        },
        select: {
          homeTeam: { select: { id: true, name: true, logo: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, logo: true, shortName: true } },
        },
      });
      const teamMap = new Map<string, { id: string; name: string; logo: string | null; shortName: string | null }>();
      teamRows.forEach(g => {
        teamMap.set(g.homeTeam.id, g.homeTeam);
        teamMap.set(g.awayTeam.id, g.awayTeam);
      });
      const availableTeams = Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      return res.status(200).json({
        prediction: userPrediction,
        deadline: deadline?.toISOString() || null,
        deadlinePassed,
        selectionLocked,
        lockAt: lockAt?.toISOString() || null,
        availableTeams,
        // Kept for backwards compatibility with the widget; no longer used as a hard deadline.
        nextGame: null,
      });
    }

    if (req.method === 'POST') {
      const { teamId } = req.body;
      if (!teamId || typeof teamId !== 'string') {
        return res.status(400).json({ error: 'Team ID is required' });
      }

      if (selectionLocked) {
        return res.status(400).json({ error: 'La sélection est verrouillée. Vous ne pouvez plus la modifier.' });
      }
      // (No per-game cutoff — only competition.finalWinnerLockAt gates this endpoint.)

      // Verify team plays in this competition (appears in at least one non-placeholder game)
      const teamPlaysInComp = await prisma.game.findFirst({
        where: {
          competitionId,
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          AND: [
            { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
            { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
          ],
        },
        select: { id: true },
      });
      if (!teamPlaysInComp) {
        return res.status(400).json({ error: 'Team is not eligible for final winner prediction' });
      }

      const competitionUser = await prisma.competitionUser.upsert({
        where: { competitionId_userId: { competitionId, userId: session.user.id } },
        update: { finalWinnerTeamId: teamId },
        create: { competitionId, userId: session.user.id, finalWinnerTeamId: teamId },
        include: {
          finalWinnerTeam: { select: { id: true, name: true, logo: true, shortName: true } },
        },
      });

      return res.status(200).json({ success: true, prediction: competitionUser.finalWinnerTeam });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in final-winner-prediction API:', error);
    console.error('Error details:', { code: error?.code, message: error?.message, meta: error?.meta });
    return res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
}
