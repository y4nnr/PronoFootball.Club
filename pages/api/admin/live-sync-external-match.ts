import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { API_CONFIG } from '../../../lib/api-config';
import { ApiSportsV2 } from '../../../lib/api-sports-api-v2';
import { RugbyAPI } from '../../../lib/api-rugby-v1';

type ExternalMatchResponse = {
  externalMatch: {
    id: number | null;
    status: string | null;
    externalStatus: string | null;
    elapsedMinute: number | null;
    homeTeam: {
      id: number | null;
      name: string | null;
    };
    awayTeam: {
      id: number | null;
      name: string | null;
    };
    score: {
      home: number | null;
      away: number | null;
    };
    date: string | null;
    competition: {
      id: number | null;
      name: string | null;
    };
  } | null;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExternalMatchResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ externalMatch: null, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ externalMatch: null, error: 'Unauthorized - No session' });
  }

  const userRole = (session.user as { role?: string }).role?.toLowerCase();
  if (userRole !== 'admin') {
    return res.status(401).json({ externalMatch: null, error: 'Unauthorized - Admin access required' });
  }

  try {
    const { externalId, gameId, sportType } = req.query as {
      externalId?: string;
      gameId?: string;
      sportType?: string;
    };

    if (!externalId && !gameId) {
      return res.status(400).json({ externalMatch: null, error: 'externalId or gameId is required' });
    }

    // Validate configuration
    const validation = API_CONFIG.validate();
    if (!validation.valid) {
      return res.status(500).json({ externalMatch: null, error: `Configuration error: ${validation.errors.join(', ')}` });
    }

    const apiKey = API_CONFIG.apiSportsApiKey;
    if (!apiKey) {
      return res.status(500).json({ externalMatch: null, error: 'API-FOOTBALL not found in environment variables' });
    }

    // If we have externalId, fetch directly (but need to know sport type)
    if (externalId) {
      // If we have gameId, fetch game first to determine sport type
      let gameSportType: string | null = null;
      if (gameId) {
        try {
          const { prisma } = await import('../../../lib/prisma');
          const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
              competition: {
                select: { sportType: true }
              }
            }
          });
          if (game) {
            gameSportType = game.competition.sportType;
          }
        } catch (error) {
          console.error('[ADMIN LIVE SYNC] Error fetching game for sport type:', error);
        }
      }
      
      // Use sportType from query if available, otherwise from game
      const targetSportType = sportType || gameSportType;
      
      try {
        if (targetSportType === 'RUGBY') {
          // Use Rugby API
          const rugbyAPI = new RugbyAPI(apiKey);
          const match = await rugbyAPI.getMatchById(parseInt(externalId, 10));
          
          if (match) {
            const externalMatch = {
              id: match.id,
              status: match.status,
              externalStatus: match.externalStatus,
              elapsedMinute: match.elapsedMinute,
              homeTeam: {
                id: match.homeTeam.id,
                name: match.homeTeam.name,
              },
              awayTeam: {
                id: match.awayTeam.id,
                name: match.awayTeam.name,
              },
              score: {
                home: match.score.fullTime.home,
                away: match.score.fullTime.away,
              },
              date: match.utcDate,
              competition: {
                id: match.competition.id,
                name: match.competition.name,
              },
            };
            return res.status(200).json({ externalMatch });
          }
        } else {
          // Default to Football API (or if sportType is FOOTBALL or unknown)
          const apiSports = new ApiSportsV2(apiKey);
          const match = await apiSports.getMatchById(parseInt(externalId, 10));
          
          if (match) {
            const externalMatch = {
              id: match.id,
              status: match.status,
              externalStatus: match.externalStatus,
              elapsedMinute: match.elapsedMinute,
              homeTeam: {
                id: match.homeTeam.id,
                name: match.homeTeam.name,
              },
              awayTeam: {
                id: match.awayTeam.id,
                name: match.awayTeam.name,
              },
              score: {
                home: match.score.fullTime.home,
                away: match.score.fullTime.away,
              },
              date: match.utcDate,
              competition: {
                id: match.competition.id,
                name: match.competition.name,
              },
            };
            return res.status(200).json({ externalMatch });
          }
        }
      } catch (error) {
        console.error('[ADMIN LIVE SYNC] Error fetching external match by ID:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ externalMatch: null, error: `Failed to fetch external match: ${errorMessage}` });
      }
    }

    // If we have gameId, we need to search by date and teams
    if (gameId) {
      const { prisma } = await import('../../../lib/prisma');
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
        },
      });

      if (!game) {
        return res.status(404).json({ externalMatch: null, error: 'Game not found' });
      }

      const gameDate = new Date(game.date);
      const dateStr = gameDate.toISOString().split('T')[0];

      try {
        if (sportType === 'RUGBY') {
          const rugbyAPI = new RugbyAPI(apiKey);
          const matches = await rugbyAPI.getMatchesByDateRange(dateStr, dateStr);
          
          // Try to find matching match
          const matchingMatch = matches.find(m => 
            (m.homeTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase()) ||
             game.homeTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase())) &&
            (m.awayTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase()) ||
             game.awayTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase()))
          );

          if (matchingMatch) {
            const externalMatch = {
              id: matchingMatch.id,
              status: matchingMatch.status,
              externalStatus: matchingMatch.externalStatus,
              elapsedMinute: matchingMatch.elapsedMinute,
              homeTeam: {
                id: matchingMatch.homeTeam.id,
                name: matchingMatch.homeTeam.name,
              },
              awayTeam: {
                id: matchingMatch.awayTeam.id,
                name: matchingMatch.awayTeam.name,
              },
              score: {
                home: matchingMatch.score.fullTime.home,
                away: matchingMatch.score.fullTime.away,
              },
              date: matchingMatch.utcDate,
              competition: {
                id: matchingMatch.competition.id,
                name: matchingMatch.competition.name,
              },
            };
            return res.status(200).json({ externalMatch });
          }
        } else {
          // FOOTBALL
          const apiSports = new ApiSportsV2(apiKey);
          const matches = await apiSports.getMatchesByDateRange(dateStr, dateStr);
          
          // Try to find matching match
          const matchingMatch = matches.find(m => 
            (m.homeTeam.name.toLowerCase().includes(game.homeTeam.name.toLowerCase()) ||
             game.homeTeam.name.toLowerCase().includes(m.homeTeam.name.toLowerCase())) &&
            (m.awayTeam.name.toLowerCase().includes(game.awayTeam.name.toLowerCase()) ||
             game.awayTeam.name.toLowerCase().includes(m.awayTeam.name.toLowerCase()))
          );

          if (matchingMatch) {
            const externalMatch = {
              id: matchingMatch.id,
              status: matchingMatch.status,
              externalStatus: matchingMatch.externalStatus,
              elapsedMinute: matchingMatch.elapsedMinute,
              homeTeam: {
                id: matchingMatch.homeTeam.id,
                name: matchingMatch.homeTeam.name,
              },
              awayTeam: {
                id: matchingMatch.awayTeam.id,
                name: matchingMatch.awayTeam.name,
              },
              score: {
                home: matchingMatch.score.fullTime.home,
                away: matchingMatch.score.fullTime.away,
              },
              date: matchingMatch.utcDate,
              competition: {
                id: matchingMatch.competition.id,
                name: matchingMatch.competition.name,
              },
            };
            return res.status(200).json({ externalMatch });
          }
        }
      } catch (error) {
        console.error('[ADMIN LIVE SYNC] Error searching external match:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ externalMatch: null, error: `Failed to search external match: ${errorMessage}` });
      }
    }

    return res.status(404).json({ externalMatch: null, error: 'External match not found' });
  } catch (error) {
    console.error('[ADMIN LIVE SYNC] Error fetching external match:', error);
    return res.status(500).json({ externalMatch: null, error: 'Failed to fetch external match' });
  }
}
