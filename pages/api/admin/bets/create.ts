import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@lib/prisma';

// Helper function to update shooters for all users in a competition
async function updateShootersForCompetition(competitionId: string) {
  try {
    // Get all users in this competition
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: true }
    });

    // Get all finished/live games in this competition
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] }
      }
    });

    const totalGames = finishedGames.length;

    // Update shooters for each user
    for (const competitionUser of competitionUsers) {
      // Count how many games this user bet on in this competition
      const userBets = await prisma.bet.count({
        where: {
          userId: competitionUser.userId,
          game: {
            competitionId,
            status: { in: ['FINISHED', 'LIVE'] }
          }
        }
      });

      // Calculate shooters (forgotten bets)
      const shooters = totalGames - userBets;

      // Update the CompetitionUser record
      await prisma.competitionUser.update({
        where: { id: competitionUser.id },
        data: { shooters }
      });
    }
  } catch (error) {
    console.error('Error updating shooters for competition:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user || typeof session.user !== 'object' || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { gameId, userId, score1, score2 } = req.body;

    if (!gameId || !userId || typeof score1 !== 'number' || typeof score2 !== 'number') {
      return res.status(400).json({ error: 'Game ID, User ID, and valid scores are required' });
    }

    if (score1 < 0 || score2 < 0) {
      return res.status(400).json({ error: 'Scores cannot be negative' });
    }

    if (score1 > 99 || score2 > 99) {
      return res.status(400).json({ error: 'Scores cannot exceed 99' });
    }

    // Check if game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        date: true,
        status: true,
        competition: {
          include: {
            users: {
              where: {
                userId: userId
              }
            }
          }
        }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Admins can create bets for LIVE and FINISHED games (for testing and fixing mistakes)
    // Log when creating bet for non-upcoming game for audit purposes
    if (game.status !== 'UPCOMING') {
      console.log(`⚠️ [ADMIN] Admin ${session.user?.id} creating bet for ${game.status} game (ID: ${gameId}, User: ${userId})`);
    }

    // Check if user is part of the competition
    if (game.competition.users.length === 0) {
      return res.status(400).json({ error: 'User is not part of this competition' });
    }

    // Check if user already has a bet for this game
    const existingBet = await prisma.bet.findFirst({
      where: {
        gameId: gameId,
        userId: userId
      }
    });

    if (existingBet) {
      return res.status(400).json({ error: 'User already has a bet for this game' });
    }

    // Create the bet
    let bet = await prisma.bet.create({
      data: {
        gameId: gameId,
        userId: userId,
        score1: score1,
        score2: score2,
        points: 0, // Will be calculated when game finishes (or immediately if game is already finished)
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        game: {
          select: {
            id: true,
            status: true,
            homeScore: true,
            awayScore: true,
            competition: {
              select: {
                id: true,
                sportType: true
              }
            }
          }
        }
      },
    });

    // If game is already FINISHED, calculate points immediately
    if (bet.game.status === 'FINISHED' && bet.game.homeScore !== null && bet.game.awayScore !== null) {
      const { calculateBetPoints, getScoringSystemForSport } = await import('../../lib/scoring-systems');
      const scoringSystem = getScoringSystemForSport(bet.game.competition.sportType || 'FOOTBALL');
      
      const points = calculateBetPoints(
        { score1: bet.score1, score2: bet.score2 },
        { home: bet.game.homeScore, away: bet.game.awayScore },
        scoringSystem
      );
      
      bet = await prisma.bet.update({
        where: { id: bet.id },
        data: { points },
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
      
      console.log(`💰 [ADMIN] Calculated points immediately for bet on finished game: ${points} points`);
      
      // Also update shooters count for the competition
      await updateShootersForCompetition(bet.game.competition.id);
    }

    return res.status(201).json({ message: 'Bet created successfully', bet });

  } catch (error) {
    console.error('Error creating bet:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
