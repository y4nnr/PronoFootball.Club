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
      // Handle case where finalWinnerTeamId column might not exist yet (migration not applied)
      let userPrediction = null;
      
      try {
        // First, try to query with the relation
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
        userPrediction = competitionUser?.finalWinnerTeam || null;
      } catch (error: any) {
        // If the column/relation doesn't exist yet, query without the include
        const errorMessage = String(error?.message || '');
        const errorCode = error?.code || '';
        
        if (errorCode === 'P2009' || 
            errorCode === 'P2017' ||
            errorMessage.includes('finalWinnerTeamId') || 
            errorMessage.includes('FinalWinnerPrediction') ||
            errorMessage.includes('Unknown arg') ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('Unknown field')) {
          console.log('[Final Winner Prediction] Column/relation finalWinnerTeamId not found - migration may not be applied');
          // Just set prediction to null - feature will work but won't show existing predictions
          userPrediction = null;
        } else {
          // Re-throw other errors so they're caught by outer handler
          console.error('[Final Winner Prediction] Unexpected error querying prediction:', error);
          throw error;
        }
      }

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

      console.log(`[Final Winner Prediction] Found ${upcomingGames.length} upcoming/live games for competition ${competitionId}`);

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
        const homeTeamNameLower = game.homeTeam.name.toLowerCase();
        const awayTeamNameLower = game.awayTeam.name.toLowerCase();
        const placeholderLower = PLACEHOLDER_TEAM_NAME.toLowerCase();
        
        if (homeTeamNameLower !== placeholderLower && homeTeamNameLower !== 'xxxx2') {
          availableTeamsMap.set(game.homeTeam.id, game.homeTeam);
          console.log(`[Final Winner Prediction] Added team: ${game.homeTeam.name}`);
        } else {
          console.log(`[Final Winner Prediction] Skipped placeholder home team: ${game.homeTeam.name}`);
        }
        
        if (awayTeamNameLower !== placeholderLower && awayTeamNameLower !== 'xxxx2') {
          availableTeamsMap.set(game.awayTeam.id, game.awayTeam);
          console.log(`[Final Winner Prediction] Added team: ${game.awayTeam.name}`);
        } else {
          console.log(`[Final Winner Prediction] Skipped placeholder away team: ${game.awayTeam.name}`);
        }
      });

      const availableTeams = Array.from(availableTeamsMap.values());
      console.log(`[Final Winner Prediction] Total available teams: ${availableTeams.length}`);

      // If no upcoming games, check if competition has any games at all
      if (upcomingGames.length === 0) {
        const totalGames = await prisma.game.count({
          where: { competitionId }
        });
        console.log(`[Final Winner Prediction] No upcoming games found. Total games in competition: ${totalGames}`);
      }

      return res.status(200).json({
        prediction: userPrediction,
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
      // Handle case where finalWinnerTeamId column might not exist yet
      let competitionUser;
      try {
        competitionUser = await prisma.competitionUser.upsert({
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
      } catch (error: any) {
        // If the column doesn't exist, return a helpful error message
        if (error?.code === 'P2009' || error?.message?.includes('finalWinnerTeamId') || error?.message?.includes('FinalWinnerPrediction')) {
          console.error('[Final Winner Prediction] Database migration not applied - finalWinnerTeamId column missing');
          return res.status(500).json({ 
            error: 'Database migration required. Please run: npx prisma db push or npx prisma migrate dev' 
          });
        }
        // Re-throw other errors
        throw error;
      }

      return res.status(200).json({
        success: true,
        prediction: competitionUser.finalWinnerTeam
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in final-winner-prediction API:', error);
    console.error('Error details:', {
      code: error?.code,
      message: error?.message,
      meta: error?.meta
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      code: error?.code
    });
  }
}
