import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';

interface Game {
  id: string;
  homeScore: number | null;
  awayScore: number | null;
  bets: Array<{
    score1: number;
    score2: number;
    user: {
      id: string;
      name: string;
      profilePictureUrl: string | null;
    };
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { competitionId } = req.query;
  if (!competitionId) {
    return res.status(400).json({ error: 'Competition ID is required' });
  }

  try {
    // Get all games for the competition
    const games = await prisma.game.findMany({
      where: {
        competitionId: competitionId as string,
        status: 'FINISHED',
        homeScore: { not: null },
        awayScore: { not: null }
      },
      include: {
        bets: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });

    // Calculate points for each user
    const userPoints = new Map<string, {
      id: string;
      name: string;
      profilePictureUrl: string | null;
      totalPoints: number;
      exactScores: number;
      correctResults: number;
    }>();

    games.forEach((game: Game) => {
      if (game.homeScore === null || game.awayScore === null) return;
      
      // At this point, we know homeScore and awayScore are not null
      const homeScore = game.homeScore as number;
      const awayScore = game.awayScore as number;
      
      game.bets.forEach(bet => {
        const user = bet.user;
        if (!userPoints.has(user.id)) {
          userPoints.set(user.id, {
            id: user.id,
            name: user.name,
            profilePictureUrl: user.profilePictureUrl,
            totalPoints: 0,
            exactScores: 0,
            correctResults: 0
          });
        }

        const userStats = userPoints.get(user.id)!;
        
        // Check for exact score (3 points)
        if (bet.score1 === homeScore && bet.score2 === awayScore) {
          userStats.totalPoints += 3;
          userStats.exactScores += 1;
        }
        // Check for correct result (1 point)
        else if (
          (bet.score1 > bet.score2 && homeScore > awayScore) ||
          (bet.score1 < bet.score2 && homeScore < awayScore) ||
          (bet.score1 === bet.score2 && homeScore === awayScore)
        ) {
          userStats.totalPoints += 1;
          userStats.correctResults += 1;
        }
      });
    });

    // Convert to array and sort by total points
    const rankings = Array.from(userPoints.values())
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return res.status(200).json(rankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return res.status(500).json({ error: 'Failed to fetch rankings' });
  }
} 