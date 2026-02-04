import { prisma } from './prisma';

const PLACEHOLDER_TEAM_NAME = 'xxxx';

/**
 * Awards 5 points to users who correctly predicted the final winner of Champions League
 * This should be called when a game finishes and is determined to be the final
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

    // Get the game to check if it's the final (last game with placeholder teams)
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
    // The final is the last game in the competition (by date)
    const allGames = await prisma.game.findMany({
      where: { competitionId },
      orderBy: { date: 'desc' }
    });

    // The final is the last game (most recent date)
    const finalGame = allGames.length > 0 ? allGames[0] : null;

    // If this game is not the final, skip
    if (!finalGame || finalGame.id !== gameId) {
      return;
    }

    // Determine the winner
    let winnerTeamId: string | null = null;
    if (homeScore > awayScore) {
      winnerTeamId = game.homeTeamId;
    } else if (awayScore > homeScore) {
      winnerTeamId = game.awayTeamId;
    } else {
      // Draw - check if decided by penalties or extra time
      // For now, we'll skip draws (no winner)
      console.log(`⚠️ Final game ended in a draw, no winner points awarded`);
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

    // Award 5 points to each correct prediction
    // We'll create a special "bet" record for tracking, or we could add it to a separate table
    // For now, let's create a special bet record with gameId pointing to the final game
    // But actually, we should add this to the user's total points in the competition stats
    // The easiest way is to create a bet with 5 points that we can track
    
    // Actually, let's just log it for now and we can add it to the ranking calculation
    // Or we can create a special bet record
    
    // For simplicity, let's create a special bet record with 5 points
    // But we need to make sure it doesn't conflict with regular bets
    // Actually, the ranking is calculated from bets, so we could create a special bet
    
    // Better approach: Add the points directly to the user's competition stats
    // But the ranking is calculated from bets, so let's create a special bet record
    
    // Actually, I think the best approach is to create a special bet with 5 points
    // But we need to make sure the game allows multiple bets per user
    // Or we can check if a bet already exists and update it
    
    // Let me check the bet model - it has @@unique([gameId, userId])
    // So we can't create multiple bets for the same game/user
    
    // Alternative: Create a separate tracking mechanism
    // For now, let's just log and we'll handle it in the ranking calculation
    
    console.log(`🏆 Final winner points: ${correctPredictions.length} users correctly predicted the winner!`);
    
    // Create a special bet record for each user with 5 points
    // We'll use a special game ID or we can add a flag
    // Actually, let's just add the points to an existing bet or create a new one
    // But wait, the user might not have a bet on the final game
    
    // Best approach: Create a special "final winner" bet for tracking
    // We'll need to handle this in the ranking calculation to avoid double counting
    
    // For now, let's create a bet record with 5 points
    // We'll use the final game ID and the user ID
    for (const prediction of correctPredictions) {
      // Check if user already has a bet on this game
      const existingBet = await prisma.bet.findUnique({
        where: {
          gameId_userId: {
            gameId,
            userId: prediction.userId
          }
        }
      });

      if (existingBet) {
        // Add 5 points to existing bet (final winner bonus)
        await prisma.bet.update({
          where: { id: existingBet.id },
          data: { points: existingBet.points + 5 }
        });
        console.log(`✅ Added 5 final winner points to existing bet for user ${prediction.user.name}`);
      } else {
        // Create a special bet record with 5 points for final winner
        // Use dummy scores (0-0) since this is just for tracking points
        await prisma.bet.create({
          data: {
            gameId,
            userId: prediction.userId,
            score1: 0,
            score2: 0,
            points: 5
          }
        });
        console.log(`✅ Created final winner bet (5 points) for user ${prediction.user.name}`);
      }
    }

    console.log(`🏆 Final winner points awarded: ${correctPredictions.length} users received 5 points each`);
  } catch (error) {
    console.error('Error awarding final winner points:', error);
    // Don't throw - we don't want to break the main flow
  }
}
