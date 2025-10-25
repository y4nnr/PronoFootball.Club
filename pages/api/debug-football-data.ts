import { NextApiRequest, NextApiResponse } from 'next';
import { FootballDataAPI } from '../../lib/football-data-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY not found');
    }

    const footballAPI = new FootballDataAPI(apiKey);
    const liveMatches = await footballAPI.getLiveMatches();

    const formattedMatches = liveMatches.map(match => ({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away,
      status: match.status,
      competition: match.competition.name,
      normalizedHome: footballAPI.normalizeTeamName(match.homeTeam.name),
      normalizedAway: footballAPI.normalizeTeamName(match.awayTeam.name)
    }));

    return res.status(200).json({
      success: true,
      matches: formattedMatches,
      total: liveMatches.length
    });

  } catch (error) {
    console.error('❌ Error fetching Football-Data.org matches:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch matches',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
