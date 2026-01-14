import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user || typeof session.user !== 'object' || session.user === null || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { betId } = req.query;

    if (!betId || typeof betId !== 'string') {
      return res.status(400).json({ error: 'Bet ID is required' });
    }

    if (req.method === 'PUT') {
      // Update bet
      const { score1, score2 } = req.body;

      if (typeof score1 !== 'number' || typeof score2 !== 'number') {
        return res.status(400).json({ error: 'Valid scores are required' });
      }

      if (score1 < 0 || score2 < 0) {
        return res.status(400).json({ error: 'Scores cannot be negative' });
      }

      if (score1 > 99 || score2 > 99) {
        return res.status(400).json({ error: 'Scores cannot exceed 99' });
      }

      // Check if bet exists
      const existingBet = await prisma.bet.findUnique({
        where: { id: betId },
        include: {
          game: true,
        },
      });

      if (!existingBet) {
        return res.status(404).json({ error: 'Bet not found' });
      }

      // Update the bet
      const updatedBet = await prisma.bet.update({
        where: { id: betId },
        data: {
          score1: score1,
          score2: score2,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Recalculate points if the game is finished
      if (existingBet.game.status === 'FINISHED' && 
          existingBet.game.homeScore !== null && 
          existingBet.game.awayScore !== null) {
        
        // Get competition to determine sport type and scoring system
        const competition = await prisma.competition.findUnique({
          where: { id: existingBet.game.competitionId },
          select: { sportType: true }
        });
        
        const { calculateBetPoints, getScoringSystemForSport } = await import('../../../../lib/scoring-systems');
        const scoringSystem = getScoringSystemForSport(competition?.sportType || 'FOOTBALL');
        
        const points = calculateBetPoints(
          { score1, score2 },
          { home: existingBet.game.homeScore, away: existingBet.game.awayScore },
          scoringSystem
        );

        // Update points
        await prisma.bet.update({
          where: { id: betId },
          data: { points },
        });
      }

      return res.status(200).json({ message: 'Bet updated successfully', bet: updatedBet });

    } else if (req.method === 'DELETE') {
      // Delete bet
      const existingBet = await prisma.bet.findUnique({
        where: { id: betId },
      });

      if (!existingBet) {
        return res.status(404).json({ error: 'Bet not found' });
      }

      await prisma.bet.delete({
        where: { id: betId },
      });

      return res.status(200).json({ message: 'Bet deleted successfully' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error in bet management:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 