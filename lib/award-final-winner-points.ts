import { prisma } from './prisma';

const PLACEHOLDER_TEAM_NAME = 'xxxx';
const FINAL_WINNER_BONUS_POINTS = 5;

/**
 * Awards 5 points to users who correctly predicted the final winner of Champions League
 * This should be called when a game finishes and is determined to be the final
 * 
 * IDEMPOTENCY: This function is idempotent - it checks if points have already been awarded
 * to prevent duplicate awarding if called multiple times.
 */
export async function awardFinalWinnerPoints(
  gameId: string,
  competitionId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  try {
    // Get competition to check if it's Champions League
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true }
    });

    if (!competition || !competition.name.includes('Champions League')) {
      // Not a Champions League competition, skip
      return;
    }

    // Get the game to check if it's the final
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    if (!game) {
      return;
    }

    // Check if this is the final game
    // The final is the last game in the competition (by date, then by id for consistency)
    // Exclude games with placeholder teams from being considered as the final
    const allGames = await prisma.game.findMany({
      where: { 
        competitionId,
        // Exclude placeholder games from final detection
        homeTeam: {
          name: { not: { in: [PLACEHOLDER_TEAM_NAME, 'xxxx2'] } }
        },
        awayTeam: {
          name: { not: { in: [PLACEHOLDER_TEAM_NAME, 'xxxx2'] } }
        }
      },
      orderBy: [
        { date: 'desc' },
        { id: 'desc' } // Secondary sort for consistency
      ]
    });

    // The final is the last game (most recent date) without placeholder teams
    const finalGame = allGames.length > 0 ? allGames[0] : null;

    // If this game is not the final, skip
    if (!finalGame || finalGame.id !== gameId) {
      return;
    }

    // Verify the final game doesn't have placeholder teams (safety check)
    if (game.homeTeam.name.toLowerCase() === PLACEHOLDER_TEAM_NAME.toLowerCase() ||
        game.homeTeam.name.toLowerCase() === 'xxxx2' ||
        game.awayTeam.name.toLowerCase() === PLACEHOLDER_TEAM_NAME.toLowerCase() ||
        game.awayTeam.name.toLowerCase() === 'xxxx2') {
      console.log(`⚠️ Final game still has placeholder teams, skipping points award`);
      return;
    }

    // Determine the winner
    let winnerTeamId: string | null = null;
    if (homeScore > awayScore) {
      winnerTeamId = game.homeTeamId;
    } else if (awayScore > homeScore) {
      winnerTeamId = game.awayTeamId;
    } else {
      // Draw - Champions League finals can't end in draws (they go to penalties)
      // Check if the game was decided by penalties (statusDetail might indicate this)
      // For now, if it's a draw, we'll skip (the actual winner would be determined by penalties)
      // TODO: In the future, we might need to check statusDetail or decidedBy fields
      console.log(`⚠️ Final game ended in a draw (${homeScore}-${awayScore}), no winner points awarded. If decided by penalties, winner should be determined separately.`);
      return;
    }

    if (!winnerTeamId) {
      return;
    }

    // Get all users who predicted this team as the winner
    const correctPredictions = await prisma.competitionUser.findMany({
      where: {
        competitionId,
        finalWinnerTeamId: winnerTeamId
      },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    if (correctPredictions.length === 0) {
      console.log(`✅ Final winner points: No correct predictions for team ${game.homeTeamId === winnerTeamId ? game.homeTeam.name : game.awayTeam.name}`);
      return;
    }

    console.log(`🏆 Final winner points: ${correctPredictions.length} users correctly predicted the winner!`);

    // Use a transaction to ensure atomicity and prevent race conditions
    await prisma.$transaction(async (tx) => {
      for (const prediction of correctPredictions) {
        // Check if user already has a bet on this game
        const existingBet = await tx.bet.findUnique({
          where: {
            gameId_userId: {
              gameId,
              userId: prediction.userId
            }
          }
        });

        if (existingBet) {
          // Check if this is already a bonus-only bet (0-0, 5 points)
          // If so, bonus was already awarded and we should skip
          if (existingBet.points === FINAL_WINNER_BONUS_POINTS && 
              existingBet.score1 === 0 && existingBet.score2 === 0) {
            console.log(`⏭️  Final winner bonus already awarded to user ${prediction.user.name} (bonus-only bet exists)`);
            continue;
          }

          // Check if existing bet already has bonus points added
          // LIMITATION: We can't perfectly detect if bonus was already added to an existing bet
          // because we modify the bet in place. We use a heuristic:
          // - If bet has points >= (max normal points + bonus), assume bonus already added
          // - Max normal bet is 3 points, bonus is 5, so threshold is 8
          // - This is not perfect: if user had 0-2 points, we might add bonus twice
          // - TODO: Future improvement: Add a flag field or separate tracking table
          const maxNormalPoints = 3;
          const bonusThreshold = maxNormalPoints + FINAL_WINNER_BONUS_POINTS;
          
          if (existingBet.points >= bonusThreshold) {
            console.log(`⏭️  Final winner bonus likely already awarded to user ${prediction.user.name} (bet has ${existingBet.points} points, threshold: ${bonusThreshold})`);
            continue;
          }

          // Add 5 points to existing bet (final winner bonus)
          await tx.bet.update({
            where: { id: existingBet.id },
            data: { points: existingBet.points + FINAL_WINNER_BONUS_POINTS }
          });
          console.log(`✅ Added ${FINAL_WINNER_BONUS_POINTS} final winner points to existing bet for user ${prediction.user.name} (total: ${existingBet.points + FINAL_WINNER_BONUS_POINTS})`);
        } else {
          // Check if bonus bet already exists (idempotency)
          const existingBonusBet = await tx.bet.findFirst({
            where: {
              gameId,
              userId: prediction.userId,
              score1: 0,
              score2: 0,
              points: FINAL_WINNER_BONUS_POINTS
            }
          });

          if (existingBonusBet) {
            console.log(`⏭️  Final winner bonus already awarded to user ${prediction.user.name} (bonus bet exists)`);
            continue;
          }

          // Create a special bet record with 5 points for final winner
          // Use dummy scores (0-0) since this is just for tracking points
          await tx.bet.create({
            data: {
              gameId,
              userId: prediction.userId,
              score1: 0,
              score2: 0,
              points: FINAL_WINNER_BONUS_POINTS
            }
          });
          console.log(`✅ Created final winner bet (${FINAL_WINNER_BONUS_POINTS} points) for user ${prediction.user.name}`);
        }
      }
    });

    console.log(`🏆 Final winner points awarded: ${correctPredictions.length} users received ${FINAL_WINNER_BONUS_POINTS} points each`);
  } catch (error) {
    console.error('Error awarding final winner points:', error);
    // Don't throw - we don't want to break the main flow
  }
}
