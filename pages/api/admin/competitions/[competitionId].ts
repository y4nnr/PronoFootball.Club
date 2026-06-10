import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";
import { setCompetitionWinnerAndLastPlace } from "../../../../lib/competition-completion";

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
    const { name, description, startDate, endDate, logo, status, entryFee, prizePctFirst, prizePctSecond, prizePctThird } = req.body;

    if (!competitionId || Array.isArray(competitionId)) {
      return res.status(400).json({ error: 'Invalid competition ID' });
    }

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields: name, startDate, endDate' });
    }

    // Cagnotte validation — entryFee must be a positive integer, percentages (if any are set) must all be set and sum to 100
    if (entryFee !== undefined && (!Number.isInteger(entryFee) || entryFee < 0)) {
      return res.status(400).json({ error: 'entryFee must be a non-negative integer' });
    }
    const pctFields = [prizePctFirst, prizePctSecond, prizePctThird];
    const someSet = pctFields.some(v => v !== null && v !== undefined && v !== '');
    const allSet  = pctFields.every(v => v !== null && v !== undefined && v !== '');
    if (someSet && !allSet) {
      return res.status(400).json({ error: 'Set all three prize percentages or leave them all empty to use defaults' });
    }
    if (allSet) {
      const nums = pctFields.map(v => Number(v));
      if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 100)) {
        return res.status(400).json({ error: 'Each prize percentage must be an integer 0-100' });
      }
      if (nums[0] + nums[1] + nums[2] !== 100) {
        return res.status(400).json({ error: 'Prize percentages must sum to 100' });
      }
      if (!(nums[0] > nums[1] && nums[1] > nums[2])) {
        return res.status(400).json({ error: 'Percentages must satisfy 1st > 2nd > 3rd' });
      }
    }

    try {
      const updateData: Record<string, unknown> = {
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        logo: logo || null,
      };
      if (entryFee !== undefined) updateData.entryFee = Number(entryFee);
      if (someSet) {
        updateData.prizePctFirst = Number(prizePctFirst);
        updateData.prizePctSecond = Number(prizePctSecond);
        updateData.prizePctThird = Number(prizePctThird);
      } else if (req.body.prizePctFirst === null) {
        // Explicit clearing — admin reset to defaults
        updateData.prizePctFirst = null;
        updateData.prizePctSecond = null;
        updateData.prizePctThird = null;
      }

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