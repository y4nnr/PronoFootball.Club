import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../api/auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

const PLACEHOLDER_TEAM_NAME = 'xxxx';

// Selection is locked from this date (games of Feb 17 started) – users can no longer change their pick
const SELECTION_LOCK_AT = new Date('2026-02-17T00:00:00.000Z');

// Hardcoded list of teams eligible for Champions League final winner prediction
// These are the exact team names as they appear in the database
const ELIGIBLE_CHAMPIONS_LEAGUE_TEAMS = [
  'Arsenal',
  'Bayern Munich',
  'Liverpool',
  'Tottenham', // Note: DB has "Tottenham" not "Tottenham Hotspur"
  'Barcelona',
  'Chelsea',
  'Sporting CP',
  'Manchester City',
  'Real Madrid',
  'Inter Milan',
  'Paris Saint-Germain',
  'Newcastle United',
  'Juventus',
  'Atlético Madrid',
  'Atalanta',
  'Bayer Leverkusen',
  'Borussia Dortmund',
  'Olympiacos',
  'Club Brugge',
  'Galatasaray',
  'Monaco',
  'Qarabağ',
  'Bodø/Glimt',
  'Benfica'
];

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

      // Get the next game (deadline) - earliest upcoming/live/rescheduled game
      // Note: This doesn't need to be the final game. The deadline is when the next game starts,
      // and users can select from the hardcoded eligible teams list until then.
      // The final game can be defined later and will be automatically detected when it finishes.
      const nextGame = await prisma.game.findFirst({
        where: {
          competitionId,
          status: { in: ['UPCOMING', 'LIVE', 'RESCHEDULED'] }
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

      const deadline = nextGame ? new Date(nextGame.date) : null;
      const deadlinePassed = deadline ? new Date() >= deadline : true;
      const selectionLocked = new Date() >= SELECTION_LOCK_AT;

      // Get available teams from hardcoded list (exact DB names)
      // Look up teams by name to get their full data
      const availableTeams = await prisma.team.findMany({
        where: {
          name: { in: ELIGIBLE_CHAMPIONS_LEAGUE_TEAMS },
          sportType: 'FOOTBALL'
        },
        select: {
          id: true,
          name: true,
          logo: true,
          shortName: true
        },
        orderBy: { name: 'asc' }
      });

      console.log(`[Final Winner Prediction] Found ${availableTeams.length} eligible teams from hardcoded list`);

      return res.status(200).json({
        prediction: userPrediction,
        deadline: deadline?.toISOString() || null,
        deadlinePassed,
        selectionLocked,
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

      // Reject changes when selection is locked (from Feb 17 onward)
      if (new Date() >= SELECTION_LOCK_AT) {
        return res.status(400).json({ error: 'La sélection est verrouillée. Vous ne pouvez plus la modifier.' });
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

      // Verify team exists and is in the eligible list
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, name: true, sportType: true }
      });

      if (!team) {
        return res.status(400).json({ error: 'Team not found' });
      }

      // Check if team is in the eligible list
      const isTeamEligible = ELIGIBLE_CHAMPIONS_LEAGUE_TEAMS.includes(team.name) && team.sportType === 'FOOTBALL';
      
      if (!isTeamEligible) {
        return res.status(400).json({ error: 'Team is not eligible for final winner prediction' });
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
