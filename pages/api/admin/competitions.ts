import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

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
    // Handle fetching competitions
    try {
      const competitions = await prisma.competition.findMany({
        orderBy: {
          startDate: 'desc',
        },
      });
      res.status(200).json({ competitions });
    } catch (error) {
      console.error('Error fetching competitions:', error);
      res.status(500).json({ error: 'Failed to fetch competitions' });
    }

  } else if (req.method === 'POST') {
    // Handle creating a new competition
    const { name, description, startDate, endDate, sportType = 'FOOTBALL' } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const newCompetition = await prisma.competition.create({
        data: {
          name,
          description,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'UPCOMING', // Default status for a new competition
          sportType: sportType as any, // FOOTBALL or RUGBY
        },
      });
      res.status(201).json(newCompetition);
    } catch (error) {
      console.error('Error creating competition:', error);
      res.status(500).json({ error: 'Failed to create competition' });
    }

  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
} 