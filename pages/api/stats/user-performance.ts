import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

interface LastGamePerformance {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  competitionLogo: string | null;
  actualScore: string;
  predictedScore: string;
  points: number;
  result: 'exact' | 'correct' | 'wrong' | 'no_bet';
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


    // Find all active competitions where user is participating
    const activeCompetitions = await prisma.competition.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'COMPLETED']
        },
        users: {
          some: {
            userId: session.user.id
          }
        }
      },
      select: {
        id: true
      }
    });

    const competitionIds = activeCompetitions.map(c => c.id);

    if (competitionIds.length === 0) {
      return res.status(200).json({
        lastGamesPerformance: [],
        startDate: null,
        startGame: null
      });
    }

    // Fetch ALL finished games from all active competitions where user is participating
    const finishedGames = await prisma.game.findMany({
      where: {
        competitionId: {
          in: competitionIds
        },
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
      }
      // Removed take: 10 to get ALL finished games
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
          competitionLogo: game.competition.logo,
          actualScore,
          predictedScore: 'N/A',
          points: 0,
          result: 'no_bet'
        };
      }

      // Bet was placed - use the scoring system from the bet's points (already calculated)
      const predictedScore = `${userBet.score1}-${userBet.score2}`;
      let result: 'exact' | 'correct' | 'wrong' | 'no_bet' = 'wrong';
      const gamePoints = userBet.points || 0;
      
      if (gamePoints === 3) {
        result = 'exact';
      } else if (gamePoints === 1) {
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
        competitionLogo: game.competition.logo,
        actualScore,
        predictedScore,
        points: gamePoints,
        result
      };
    });

    // Find the most recent finished game for metadata
    const lastGame = finishedGames.length > 0 ? finishedGames[0] : null;
    const lastGameCompetition = lastGame ? await prisma.competition.findUnique({
      where: { id: lastGame.competitionId },
      select: { startDate: true }
    }) : null;

    // Add caching headers to reduce database load
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    
    res.status(200).json({
      lastGamesPerformance,
      startDate: lastGameCompetition?.startDate.toISOString() || null,
      startGame: lastGame ? 
        `${lastGame.homeTeam?.name || 'Home'} vs ${lastGame.awayTeam?.name || 'Away'}` : 
        'No finished games yet'
    });

  } catch (error) {
    console.error('Error fetching user performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 