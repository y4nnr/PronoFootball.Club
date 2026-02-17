import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
import { GameStatus } from '@prisma/client';

const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

// Helper function to update shooters for all users in a competition (excludes placeholder-team games)
async function updateShootersForCompetition(competitionId: string) {
  try {
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: { user: true }
    });

    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: { in: ['FINISHED', 'LIVE'] },
        AND: [
          { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
          { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } }
        ]
      }
    });

    const totalGames = finishedGames.length;

    for (const competitionUser of competitionUsers) {
      const userBets = await prisma.bet.count({
        where: {
          userId: competitionUser.userId,
          game: {
            competitionId,
            status: { in: ['FINISHED', 'LIVE'] },
            AND: [
              { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
              { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } }
            ]
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
    const { homeTeamId, awayTeamId, date, homeScore, awayScore, status, externalId } = req.body;
    if (!homeTeamId || !awayTeamId || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const now = new Date();
      const gameDate = new Date(date);
      const normalizedHomeScore = homeScore === '' ? null : homeScore;
      const normalizedAwayScore = awayScore === '' ? null : awayScore;
      
      // Validate status if provided
      const validStatuses = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED', 'RESCHEDULED'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be one of: UPCOMING, LIVE, FINISHED, CANCELLED, RESCHEDULED' });
      }
      
      // Get current game to preserve status if not explicitly provided
      // Status transitions should be handled by game-status-worker.js, not by editing games
      const currentGame = await prisma.game.findUnique({
        where: { id: gameId },
        select: { status: true }
      });
      
      if (!currentGame) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      // Use provided status if given, otherwise keep current status
      // This prevents accidental status changes when editing other fields (date, teams, scores)
      const gameStatus: GameStatus = status ? (status as GameStatus) : currentGame.status;
      
      // Prepare update data
      const updateData: any = {
        homeTeamId,
        awayTeamId,
        date: gameDate,
        homeScore: normalizedHomeScore,
        awayScore: normalizedAwayScore,
      };
      
      // Allow setting externalId explicitly (for fixing mismatched games)
      if (externalId !== undefined) {
        if (externalId === null || externalId === '') {
          updateData.externalId = null;
          updateData.externalStatus = null;
        } else {
          updateData.externalId = externalId.toString();
        }
      }
      
      // Only update status if explicitly provided
      if (status) {
        updateData.status = gameStatus;
        
        // When setting to RESCHEDULED, clear external API fields to force fresh lookup after reschedule
        if (gameStatus === 'RESCHEDULED') {
          updateData.externalId = null;
          updateData.externalStatus = null;
          updateData.liveHomeScore = null;
          updateData.liveAwayScore = null;
          updateData.elapsedMinute = null;
        } else {
          // Clear live scores if status is not LIVE/FINISHED
          if (gameStatus !== 'LIVE' && gameStatus !== 'FINISHED') {
            updateData.liveHomeScore = null;
            updateData.liveAwayScore = null;
          }
          
          // Clear elapsedMinute if status is not LIVE
          if (gameStatus !== 'LIVE') {
            updateData.elapsedMinute = null;
          }
          
          // Clear externalId if status is UPCOMING (game hasn't started yet)
          if (gameStatus === 'UPCOMING') {
            updateData.externalId = null;
            updateData.externalStatus = null;
          }
        }
      }
      // If status is not provided, don't change it - let game-status-worker.js handle status transitions
      
      const updatedGame = await prisma.game.update({
        where: { id: gameId },
        data: updateData,
      });

      // Only recalculate bet points if status was explicitly changed
      // If status was not provided, preserve existing bet points
      if (status) {
        // Status was explicitly provided, so handle bet point recalculation
        if (gameStatus === GameStatus.FINISHED && normalizedHomeScore !== undefined && normalizedHomeScore !== null && normalizedAwayScore !== undefined && normalizedAwayScore !== null) {
          // Game is now finished with scores, recalculate all bets
          const competition = await prisma.competition.findUnique({
            where: { id: updatedGame.competitionId },
            select: { sportType: true }
          });
          
          const { calculateBetPoints, getScoringSystemForSport } = await import('../../../../lib/scoring-systems');
          const scoringSystem = getScoringSystemForSport(competition?.sportType || 'FOOTBALL');
          
          const bets = await prisma.bet.findMany({ where: { gameId } });
          for (const bet of bets) {
            const points = calculateBetPoints(
              { score1: bet.score1, score2: bet.score2 },
              { home: normalizedHomeScore, away: normalizedAwayScore },
              scoringSystem
            );
            await prisma.bet.update({ where: { id: bet.id }, data: { points } });
          }
        } else if (gameStatus !== GameStatus.FINISHED) {
          // Game is not finished, reset all bet points to 0
          await prisma.bet.updateMany({ where: { gameId }, data: { points: 0 } });
        }
      }
      // If status was not provided, don't change bet points - preserve them

      // Update shooters count for all users in this competition
      await updateShootersForCompetition(updatedGame.competitionId);

      // Award final winner points if this is the Champions League final
      if (gameStatus === GameStatus.FINISHED && normalizedHomeScore !== undefined && normalizedHomeScore !== null && normalizedAwayScore !== undefined && normalizedAwayScore !== null) {
        const { awardFinalWinnerPoints } = await import('../../../../lib/award-final-winner-points');
        await awardFinalWinnerPoints(
          gameId,
          updatedGame.competitionId,
          normalizedHomeScore,
          normalizedAwayScore
        );
      }

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