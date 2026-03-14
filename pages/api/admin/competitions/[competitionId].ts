import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";

/**
 * Automatically set winner and last place for a competition.
 * All participants are considered (including those with 0 bets). Tie-breakers (same as classement):
 * points desc → exact scores desc → shooters asc → total score difference asc (lower = closer to real results).
 */
async function setCompetitionWinnerAndLastPlace(competitionId: string) {
  try {
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (competitionUsers.length === 0) {
      console.log(`⚠️ No participants found for competition ${competitionId}`);
      return;
    }

    const participantIds = competitionUsers.map(cu => cu.userId);
    const finishedGameIds = await prisma.game.findMany({
      where: { competitionId, status: 'FINISHED' },
      select: { id: true },
    }).then(games => games.map(g => g.id));

    const userStats = new Map<string, { totalPoints: number; exactScores: number; totalScoreDifference: number }>();
    participantIds.forEach(id => userStats.set(id, { totalPoints: 0, exactScores: 0, totalScoreDifference: 0 }));

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
      bets.forEach((bet: { userId: string; points: number; score1: number; score2: number; game: { homeScore: number | null; awayScore: number | null } }) => {
        const stats = userStats.get(bet.userId);
        if (!stats) return;
        stats.totalPoints += bet.points ?? 0;
        if (bet.points === 3) stats.exactScores += 1;
        const home = bet.game?.homeScore ?? 0;
        const away = bet.game?.awayScore ?? 0;
        stats.totalScoreDifference += Math.abs(bet.score1 - home) + Math.abs(bet.score2 - away);
      });
    }

    const standings = competitionUsers.map(cu => {
      const stats = userStats.get(cu.userId) ?? { totalPoints: 0, exactScores: 0, totalScoreDifference: 0 };
      return {
        user: cu.user,
        totalPoints: stats.totalPoints,
        exactScores: stats.exactScores,
        shooters: cu.shooters ?? 0,
        totalScoreDifference: stats.totalScoreDifference,
      };
    }).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if ((b.exactScores ?? 0) !== (a.exactScores ?? 0)) return (b.exactScores ?? 0) - (a.exactScores ?? 0);
      if ((a.shooters ?? 0) !== (b.shooters ?? 0)) return (a.shooters ?? 0) - (b.shooters ?? 0);
      return (a.totalScoreDifference ?? 0) - (b.totalScoreDifference ?? 0); // lower = better
    });

    const winner = standings[0];
    const lastPlace = standings[standings.length - 1];

    await prisma.competition.update({
      where: { id: competitionId },
      data: {
        winnerId: winner.user.id,
        lastPlaceId: lastPlace.user.id,
      },
    });

    console.log(`✅ Auto-set winner: ${winner.user.name} (${winner.totalPoints} pts, ${winner.exactScores} SE, ${winner.shooters} S) and last place: ${lastPlace.user.name} (${lastPlace.totalPoints} pts) for competition ${competitionId}`);
  } catch (error) {
    console.error(`❌ Error setting winner and last place for competition ${competitionId}:`, error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated and is an admin
  if (!session || typeof session.user !== 'object' || session.user === null || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === 'GET') {
    // Handle fetching a single competition by ID
    const { competitionId } = req.query;

    console.log('Received competitionId in API:', competitionId);

    if (!competitionId || Array.isArray(competitionId)) {
      return res.status(400).json({ error: 'Invalid competition ID' });
    }

    try {
      const competition = await prisma.competition.findUnique({
        where: {
          id: competitionId,
        },
        include: {
          games: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
      });

      console.log('Prisma findUnique result:', competition);

      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }

      res.status(200).json(competition);
    } catch (error) {
      console.error('Error fetching competition details:', error);
      res.status(500).json({ error: 'Failed to fetch competition details' });
    }

  } else if (req.method === 'PUT') {
    // Handle updating competition details
    const { competitionId } = req.query;
    const { name, description, startDate, endDate, logo, status } = req.body;

    if (!competitionId || Array.isArray(competitionId)) {
      return res.status(400).json({ error: 'Invalid competition ID' });
    }

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields: name, startDate, endDate' });
    }

    try {
      const updateData: Record<string, unknown> = {
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        logo: logo || null,
      };

      // Check if status is being changed to COMPLETED
      const competitionBeforeUpdate = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { status: true }
      });

      const isStatusChangingToCompleted = status && 
        status === 'COMPLETED' && 
        competitionBeforeUpdate?.status !== 'COMPLETED';

      // Only update status if it's provided and valid
      if (status && ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
        (updateData as { status?: string }).status = status;
      }

      const updatedCompetition = await prisma.competition.update({
        where: {
          id: competitionId,
        },
        data: updateData,
        include: {
          games: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
      });

      // Automatically set winner and last place when competition is marked as COMPLETED
      if (isStatusChangingToCompleted) {
        await setCompetitionWinnerAndLastPlace(competitionId);
        // Refetch competition to get updated winner and lastPlace
        const competitionWithWinner = await prisma.competition.findUnique({
          where: { id: competitionId },
          include: {
            games: {
              include: {
                homeTeam: true,
                awayTeam: true,
              },
            },
            winner: true,
            lastPlace: true,
          },
        });
        return res.status(200).json(competitionWithWinner);
      }

      res.status(200).json(updatedCompetition);
    } catch (error) {
      console.error('Error updating competition:', error);
      // Handle case where competition is not found
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Competition not found.' });
      }
      res.status(500).json({ error: 'Failed to update competition' });
    }

  } else if (req.method === 'DELETE') {
    const { competitionId } = req.query;

    if (!competitionId || Array.isArray(competitionId)) {
      return res.status(400).json({ error: 'Invalid competition ID' });
    }

    try {
      // Before deleting the competition, you might want to delete related data
      // (e.g., games, bets, competition participants) depending on your data model relationships and desired behavior.
      // Prisma's `onDelete` cascade can handle some of this automatically if configured in schema.prisma.

      const deletedCompetition = await prisma.competition.delete({
        where: {
          id: competitionId,
        },
      });

      res.status(200).json({ message: 'Competition deleted successfully', deletedCompetition });
    } catch (error) {
      console.error('Error deleting competition:', error);
      // Handle case where competition is not found
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Competition not found.' });
      }
      res.status(500).json({ error: 'Failed to delete competition' });
    }

  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
} 