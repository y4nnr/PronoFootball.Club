import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

interface PlayerLastGamePerformance {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  actualScore: string;
  predictedScore: string;
  points: number | null;
  result: 'exact' | 'correct' | 'wrong' | 'no_bet';
}

interface PlayerPerformance {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  lastGamesPerformance: PlayerLastGamePerformance[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: competitionId } = req.query;

    if (!competitionId || typeof competitionId !== 'string') {
      return res.status(400).json({ error: 'Competition ID is required' });
    }

    // Verify competition exists
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true }
    });

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Get all users in this competition
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePictureUrl: true
          }
        }
      }
    });

    if (competitionUsers.length === 0) {
      return res.status(200).json({ playersPerformance: [] });
    }

    const userIds = competitionUsers.map(cu => cu.user.id);

    // Get the last 10 finished games from this competition
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId,
        status: 'FINISHED'
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
        bets: {
          where: {
            userId: { in: userIds }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: 10
    });

    // Create a map of gameId -> game data for easy lookup (currently unused but kept for future use)
    // const gamesMap = new Map(finishedGames.map(game => [game.id, game]));

    // For each player, create their last 10 games performance
    const playersPerformance: PlayerPerformance[] = competitionUsers.map(competitionUser => {
      const user = competitionUser.user;
      
      const lastGamesPerformance: PlayerLastGamePerformance[] = finishedGames.map(game => {
        const actualScore = `${game.homeScore}-${game.awayScore}`;
        const userBet = game.bets.find(bet => bet.userId === user.id);

        if (!userBet) {
          // No bet placed
          return {
            gameId: game.id,
            date: game.date.toISOString(),
            homeTeam: game.homeTeam.name,
            awayTeam: game.awayTeam.name,
            homeTeamLogo: game.homeTeam.logo,
            awayTeamLogo: game.awayTeam.logo,
            competition: game.competition.name,
            actualScore,
            predictedScore: 'N/A',
            points: null,
            result: 'no_bet'
          };
        }

        // Bet was placed
        const predictedScore = `${userBet.score1}-${userBet.score2}`;
        let result: 'exact' | 'correct' | 'wrong' | 'no_bet';
        if (userBet.points === 3) {
          result = 'exact';
        } else if (userBet.points > 0) {
          result = 'correct';
        } else {
          result = 'wrong';
        }

        return {
          gameId: game.id,
          date: game.date.toISOString(),
          homeTeam: game.homeTeam.name,
          awayTeam: game.awayTeam.name,
          homeTeamLogo: game.homeTeam.logo,
          awayTeamLogo: game.awayTeam.logo,
          competition: game.competition.name,
          actualScore,
          predictedScore,
          points: userBet.points,
          result
        };
      });

      return {
        userId: user.id,
        userName: user.name,
        profilePictureUrl: user.profilePictureUrl,
        lastGamesPerformance
      };
    });

    res.status(200).json({
      playersPerformance,
      competitionName: competition.name,
      totalGames: finishedGames.length
    });

  } catch (error) {
    console.error('Error fetching players performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
