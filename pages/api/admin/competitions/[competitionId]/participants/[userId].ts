import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../auth/[...nextauth]';
import { prisma } from '../../../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated and is an admin
  if (!session || typeof session.user !== 'object' || session.user === null || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { competitionId, userId } = req.query;

  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Invalid competition ID' });
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  if (req.method === 'DELETE') {
    try {
      // Verify competition exists
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, name: true }
      });

      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is a participant
      const competitionUser = await prisma.competitionUser.findUnique({
        where: {
          competitionId_userId: {
            competitionId,
            userId
          }
        }
      });

      if (!competitionUser) {
        return res.status(404).json({ error: 'User is not a participant in this competition' });
      }

      // Delete the CompetitionUser record (this will remove user from competition)
      await prisma.competitionUser.delete({
        where: {
          competitionId_userId: {
            competitionId,
            userId
          }
        }
      });

      // Note: We don't delete the user's bets - they remain in the database
      // This allows for historical data preservation. If you want to delete bets too,
      // you would add that logic here.

      return res.status(200).json({ 
        message: 'User successfully removed from competition',
        userId,
        competitionId
      });
    } catch (error) {
      console.error('Error removing participant:', error);
      return res.status(500).json({ 
        error: 'Failed to remove participant',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

