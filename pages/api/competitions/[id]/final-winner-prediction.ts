import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../api/auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

const PLACEHOLDER_TEAM_NAME = 'xxxx';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: competitionId } = req.query;
  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Competition ID is required' });
  }

  try {
    // Get competition
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true }
    });

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Only allow for Champions League competitions
    if (!competition.name.includes('Champions League')) {
      return res.status(404).json({ error: 'Feature not available for this competition' });
    }

    if (req.method === 'GET') {
      // Get user's current prediction
      const competitionUser = await prisma.competitionUser.findUnique({
        where: {
          competitionId_userId: {
            competitionId,
            userId: session.user.id
          }
        },
        include: {
          finalWinnerTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
              shortName: true
            }
          }
        }
      });

      // Get all upcoming games (including placeholder games) to find available teams
      const upcomingGames = await prisma.game.findMany({
        where: {
          competitionId,
          status: { in: ['UPCOMING', 'LIVE'] }
        },
        include: {
          homeTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
              shortName: true
            }
          },
          awayTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
              shortName: true
            }
          }
        },
        orderBy: { date: 'asc' }
      });

      // Find the next game (deadline) - earliest upcoming/live game
      const nextGame = upcomingGames.length > 0 ? upcomingGames[0] : null;
      const deadline = nextGame ? new Date(nextGame.date) : null;
      const deadlinePassed = deadline ? new Date() >= deadline : true;

      // Extract available teams (excluding placeholders)
      const availableTeamsMap = new Map<string, {
        id: string;
        name: string;
        logo: string | null;
        shortName: string | null;
      }>();

      upcomingGames.forEach(game => {
        if (game.homeTeam.name.toLowerCase() !== PLACEHOLDER_TEAM_NAME.toLowerCase() &&
            game.homeTeam.name.toLowerCase() !== 'xxxx2') {
          availableTeamsMap.set(game.homeTeam.id, game.homeTeam);
        }
        if (game.awayTeam.name.toLowerCase() !== PLACEHOLDER_TEAM_NAME.toLowerCase() &&
            game.awayTeam.name.toLowerCase() !== 'xxxx2') {
          availableTeamsMap.set(game.awayTeam.id, game.awayTeam);
        }
      });

      const availableTeams = Array.from(availableTeamsMap.values());

      return res.status(200).json({
        prediction: competitionUser?.finalWinnerTeam || null,
        deadline: deadline?.toISOString() || null,
        deadlinePassed,
        availableTeams,
        nextGame: nextGame ? {
          id: nextGame.id,
          date: nextGame.date,
          homeTeam: nextGame.homeTeam.name,
          awayTeam: nextGame.awayTeam.name
        } : null
      });
    }

    if (req.method === 'POST') {
      const { teamId } = req.body;

      if (!teamId || typeof teamId !== 'string') {
        return res.status(400).json({ error: 'Team ID is required' });
      }

      // Check if deadline has passed
      const upcomingGames = await prisma.game.findMany({
        where: {
          competitionId,
          status: { in: ['UPCOMING', 'LIVE'] }
        },
        orderBy: { date: 'asc' },
        take: 1
      });

      const deadline = upcomingGames.length > 0 ? new Date(upcomingGames[0].date) : null;
      if (deadline && new Date() >= deadline) {
        return res.status(400).json({ error: 'Deadline has passed. Prediction cannot be changed.' });
      }

      // Verify team exists and is available (in upcoming games)
      const allUpcomingGames = await prisma.game.findMany({
        where: {
          competitionId,
          status: { in: ['UPCOMING', 'LIVE'] }
        },
        include: {
          homeTeam: true,
          awayTeam: true
        }
      });

      const isTeamAvailable = allUpcomingGames.some(game =>
        (game.homeTeamId === teamId && game.homeTeam.name.toLowerCase() !== PLACEHOLDER_TEAM_NAME.toLowerCase() && game.homeTeam.name.toLowerCase() !== 'xxxx2') ||
        (game.awayTeamId === teamId && game.awayTeam.name.toLowerCase() !== PLACEHOLDER_TEAM_NAME.toLowerCase() && game.awayTeam.name.toLowerCase() !== 'xxxx2')
      );

      if (!isTeamAvailable) {
        return res.status(400).json({ error: 'Team is not available for selection (eliminated or invalid)' });
      }

      // Verify team exists in database
      const team = await prisma.team.findUnique({
        where: { id: teamId }
      });

      if (!team) {
        return res.status(400).json({ error: 'Team not found' });
      }

      // Ensure user is part of the competition
      const competitionUser = await prisma.competitionUser.upsert({
        where: {
          competitionId_userId: {
            competitionId,
            userId: session.user.id
          }
        },
        update: {
          finalWinnerTeamId: teamId
        },
        create: {
          competitionId,
          userId: session.user.id,
          finalWinnerTeamId: teamId
        },
        include: {
          finalWinnerTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
              shortName: true
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        prediction: competitionUser.finalWinnerTeam
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in final-winner-prediction API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
