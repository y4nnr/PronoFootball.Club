import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";

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