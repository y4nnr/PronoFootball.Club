import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LastGamePerformance {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  actualScore: string;
  predictedScore: string;
  points: number;
  result: 'exact' | 'correct' | 'wrong';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }


    // Find the most recent competition that has finished games
    // Only look for Champions League 25/26 and future competitions where user is participating
    const recentCompetition = await prisma.competition.findFirst({
      where: {
        OR: [
          { name: { contains: 'UEFA Champions League 25/26' } },
          { name: { contains: 'Champions League 25/26' } }
        ],
        status: {
          in: ['ACTIVE', 'COMPLETED']
        },
        games: {
          some: {
            status: 'FINISHED'
          }
        },
        users: {
          some: {
            userId: session.user.id
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    if (!recentCompetition) {
      return res.status(200).json({
        lastGamesPerformance: [],
        startDate: null,
        startGame: null
      });
    }

    // Find the last finished game from this competition
    const lastGameOfRecentCompetition = await prisma.game.findFirst({
      where: {
        competitionId: recentCompetition.id,
        status: 'FINISHED'
      },
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (!lastGameOfRecentCompetition) {
      return res.status(200).json({
        lastGamesPerformance: [],
        startDate: null,
        startGame: null
      });
    }

    // Fetch the last 10 finished games from the Champions League 25/26
    // Only from competitions where the user is participating
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId: recentCompetition.id,
        status: 'FINISHED'
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
        bets: {
          where: {
            userId: session.user.id
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: 10
    });


    const lastGamesPerformance: LastGamePerformance[] = finishedGames.map(game => {
      const actualScore = `${game.homeScore}-${game.awayScore}`;
      const userBet = game.bets[0]; // Get the user's bet if it exists

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
      let result: 'exact' | 'correct' | 'wrong';
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

    res.status(200).json({
      lastGamesPerformance,
      startDate: recentCompetition.startDate.toISOString(),
      startGame: lastGameOfRecentCompetition ? 
        `${lastGameOfRecentCompetition.homeTeam?.name || 'Home'} vs ${lastGameOfRecentCompetition.awayTeam?.name || 'Away'}` : 
        'No finished games yet'
    });

  } catch (error) {
    console.error('Error fetching user performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
} 