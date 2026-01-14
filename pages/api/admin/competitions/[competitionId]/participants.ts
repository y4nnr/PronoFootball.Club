import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { prisma } from '../../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  // Check if the user is authenticated and is an admin
  if (!session || typeof session.user !== 'object' || session.user === null || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { competitionId } = req.query;

  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Invalid competition ID' });
  }

  if (req.method === 'GET') {
    try {
      // Verify competition exists
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, name: true }
      });

      if (!competition) {
        return res.status(404).json({ error: 'Competition not found' });
      }

      // Get all participants with their user info and stats
      const participants = await prisma.competitionUser.findMany({
        where: { competitionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePictureUrl: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          user: {
            name: 'asc'
          }
        }
      });

      // Get bet counts and total points for each participant
      const participantsWithStats = await Promise.all(
        participants.map(async (participant) => {
          // Count bets for this user in this competition
          const betCount = await prisma.bet.count({
            where: {
              userId: participant.userId,
              game: {
                competitionId
              }
            }
          });

          // Calculate total points for this user in this competition
          const bets = await prisma.bet.findMany({
            where: {
              userId: participant.userId,
              game: {
                competitionId,
                status: 'FINISHED'
              }
            },
            select: {
              points: true
            }
          });

          const totalPoints = bets.reduce((sum, bet) => sum + (bet.points || 0), 0);

          return {
            id: participant.id,
            userId: participant.userId,
            competitionId: participant.competitionId,
            shooters: participant.shooters || 0,
            joinedAt: participant.createdAt,
            user: participant.user,
            betCount,
            totalPoints
          };
        })
      );

      return res.status(200).json({
        participants: participantsWithStats,
        total: participantsWithStats.length
      });
    } catch (error) {
      console.error('Error fetching participants:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch participants',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

