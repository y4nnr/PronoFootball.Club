import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { GameStatus } from '@prisma/client';

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
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role.toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { gameId } = req.query;
  if (!gameId || typeof gameId !== 'string') {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  if (req.method === 'PUT') {
    const { homeTeamId, awayTeamId, date, homeScore, awayScore, status } = req.body;
    if (!homeTeamId || !awayTeamId || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const now = new Date();
      const gameDate = new Date(date);
      const normalizedHomeScore = homeScore === '' ? null : homeScore;
      const normalizedAwayScore = awayScore === '' ? null : awayScore;
      
      // Validate status if provided
      const validStatuses = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be one of: UPCOMING, LIVE, FINISHED, CANCELLED' });
      }
      
      // Use provided status or auto-calculate if not provided
      let gameStatus: GameStatus;
      if (status) {
        gameStatus = status as GameStatus;
      } else {
        // Auto-calculate status based on scores and date
        if (
          normalizedHomeScore !== undefined && normalizedHomeScore !== null &&
          normalizedAwayScore !== undefined && normalizedAwayScore !== null &&
          gameDate <= now
        ) {
          gameStatus = GameStatus.FINISHED;
        } else if (gameDate <= now) {
          gameStatus = GameStatus.LIVE;
        } else {
          gameStatus = GameStatus.UPCOMING;
        }
      }
      const updatedGame = await prisma.game.update({
        where: { id: gameId },
        data: {
          homeTeamId,
          awayTeamId,
          date: gameDate,
          homeScore: normalizedHomeScore,
          awayScore: normalizedAwayScore,
          status: gameStatus,
        },
      });

      // If the game is now finished and scores are set, recalculate all bets
      if (gameStatus === GameStatus.FINISHED && normalizedHomeScore !== undefined && normalizedHomeScore !== null && normalizedAwayScore !== undefined && normalizedAwayScore !== null) {
        const bets = await prisma.bet.findMany({ where: { gameId } });
        for (const bet of bets) {
          let points = 0;
          if (bet.score1 === normalizedHomeScore && bet.score2 === normalizedAwayScore) {
            points = 3;
          } else {
            const actualResult = normalizedHomeScore > normalizedAwayScore ? 'home' : normalizedHomeScore < normalizedAwayScore ? 'away' : 'draw';
            const predictedResult = bet.score1 > bet.score2 ? 'home' : bet.score1 < bet.score2 ? 'away' : 'draw';
            if (actualResult === predictedResult) {
              points = 1;
            }
          }
          await prisma.bet.update({ where: { id: bet.id }, data: { points } });
        }
      } else if (status !== GameStatus.FINISHED) {
        // If the game is not finished, reset all bet points to 0
        await prisma.bet.updateMany({ where: { gameId }, data: { points: 0 } });
      }

      // Update shooters count for all users in this competition
      await updateShootersForCompetition(updatedGame.competitionId);

      return res.status(200).json(updatedGame);
    } catch (error) {
      console.error('Error updating game:', error);
      return res.status(500).json({ error: 'Failed to update game' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.game.delete({ where: { id: gameId } });
      return res.status(200).json({ message: 'Game deleted' });
    } catch (error) {
      console.error('Error deleting game:', error);
      return res.status(500).json({ error: 'Failed to delete game' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 