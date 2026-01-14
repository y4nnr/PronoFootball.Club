import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: competitionId } = req.query;

  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Competition ID is required' });
  }

  try {
    // Check if competition exists
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true
      }
    });

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Only allow joining if competition is UPCOMING or ACTIVE (not COMPLETED)
    if (competition.status === 'COMPLETED' || competition.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot join a completed competition' 
      });
    }

    // Check if user is already a member
    const existingMembership = await prisma.competitionUser.findUnique({
      where: {
        competitionId_userId: {
          competitionId: competitionId,
          userId: session.user.id
        }
      }
    });

    if (existingMembership) {
      return res.status(200).json({ 
        message: 'User is already a member of this competition',
        alreadyMember: true
      });
    }

    // Create CompetitionUser record
    await prisma.competitionUser.create({
      data: {
        competitionId: competitionId,
        userId: session.user.id
      }
    });

    return res.status(200).json({ 
      message: 'Successfully joined competition',
      alreadyMember: false
    });
  } catch (error) {
    console.error('Error joining competition:', error);
    return res.status(500).json({ 
      error: 'Failed to join competition',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

