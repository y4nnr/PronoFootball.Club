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

    // Get today's and tomorrow's dates to check both
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    console.log(`🔍 Testing Football-Data.org API for Chelsea match on ${todayStr} and ${tomorrowStr}`);

    // Use the FootballDataAPI class which handles rate limiting
    // Check both today and tomorrow
    const matches = await footballAPI.getMatchesByDateRange(todayStr, tomorrowStr);

    console.log(`📊 Found ${matches.length} matches for today`);

    // Find Chelsea match (could be home or away)
    const chelseaMatch = matches.find((match: any) => 
      match.homeTeam?.name?.toLowerCase().includes('chelsea') ||
      match.awayTeam?.name?.toLowerCase().includes('chelsea') ||
      match.homeTeam?.shortName?.toLowerCase().includes('chelsea') ||
      match.awayTeam?.shortName?.toLowerCase().includes('chelsea') ||
      match.homeTeam?.tla?.toLowerCase() === 'che' ||
      match.awayTeam?.tla?.toLowerCase() === 'che'
    );

    if (!chelseaMatch) {
      // Try Premier League matches
      const premierLeagueMatches = matches.filter((match: any) => 
        match.competition?.name?.toLowerCase().includes('premier') ||
        match.competition?.code?.toLowerCase() === 'pl'
      );

    return res.status(200).json({
      success: true,
      dateRange: { today: todayStr, tomorrow: tomorrowStr },
      totalMatches: matches.length,
      chelseaMatchFound: false,
      premierLeagueMatches: premierLeagueMatches.length,
      allMatches: matches.map((match: any) => ({
        id: match.id,
        homeTeam: match.homeTeam?.name,
        awayTeam: match.awayTeam?.name,
        competition: match.competition?.name,
        status: match.status,
        utcDate: match.utcDate,
        date: match.utcDate ? new Date(match.utcDate).toISOString().split('T')[0] : null,
      })),
      premierLeagueMatchesDetails: premierLeagueMatches.map((match: any) => ({
        id: match.id,
        homeTeam: match.homeTeam?.name,
        awayTeam: match.awayTeam?.name,
        competition: match.competition?.name,
        status: match.status,
        utcDate: match.utcDate,
        date: match.utcDate ? new Date(match.utcDate).toISOString().split('T')[0] : null,
      })),
      message: `Chelsea match not found, but here are all matches for ${todayStr} and ${tomorrowStr}`
    });
    }

    // Get full match details by ID to see all available fields
    // Use the makeRequest method which handles rate limiting
    let fullMatchDetails = null;
    try {
      fullMatchDetails = await (footballAPI as any).makeRequest(`/matches/${chelseaMatch.id}`);
    } catch (error) {
      console.log('⚠️ Could not fetch full match details:', error);
    }

    // Extract all available fields from the match
    const matchData = {
      // Basic info
      id: chelseaMatch.id,
      utcDate: chelseaMatch.utcDate,
      status: chelseaMatch.status,
      matchday: chelseaMatch.matchday,
      
      // Teams
      homeTeam: {
        id: chelseaMatch.homeTeam?.id,
        name: chelseaMatch.homeTeam?.name,
        shortName: chelseaMatch.homeTeam?.shortName,
        tla: chelseaMatch.homeTeam?.tla,
        crest: chelseaMatch.homeTeam?.crest,
      },
      awayTeam: {
        id: chelseaMatch.awayTeam?.id,
        name: chelseaMatch.awayTeam?.name,
        shortName: chelseaMatch.awayTeam?.shortName,
        tla: chelseaMatch.awayTeam?.tla,
        crest: chelseaMatch.awayTeam?.crest,
      },
      
      // Score
      score: {
        winner: chelseaMatch.score?.winner,
        duration: chelseaMatch.score?.duration,
        fullTime: chelseaMatch.score?.fullTime,
        halfTime: chelseaMatch.score?.halfTime,
        regular: chelseaMatch.score?.regular,
        penalties: chelseaMatch.score?.penalties,
        extraTime: chelseaMatch.score?.extraTime,
      },
      
      // Competition
      competition: {
        id: chelseaMatch.competition?.id,
        name: chelseaMatch.competition?.name,
        code: chelseaMatch.competition?.code,
        type: chelseaMatch.competition?.type,
        emblem: chelseaMatch.competition?.emblem,
      },
      
      // Live/match info - THIS IS THE KEY PART
      minute: chelseaMatch.minute ?? null,
      attendance: chelseaMatch.attendance ?? null,
      referees: chelseaMatch.referees ?? null,
      odds: chelseaMatch.odds ?? null,
      lastUpdated: chelseaMatch.lastUpdated ?? null,
      
      // Additional fields that might exist
      stage: chelseaMatch.stage ?? null,
      group: chelseaMatch.group ?? null,
      venue: chelseaMatch.venue ?? null,
    };

    // Also return the raw response to see all fields
    const rawMatch = {
      ...chelseaMatch,
      // Include all keys to see what's available
      allKeys: Object.keys(chelseaMatch),
    };

    // Detailed analysis of minute field
    const minuteAnalysis = {
      exists: chelseaMatch.minute !== undefined,
      value: chelseaMatch.minute,
      type: typeof chelseaMatch.minute,
      isNull: chelseaMatch.minute === null,
      isUndefined: chelseaMatch.minute === undefined,
      // Check if it's a number or string
      isNumber: typeof chelseaMatch.minute === 'number',
      isString: typeof chelseaMatch.minute === 'string',
    };

    return res.status(200).json({
      success: true,
      dateRange: { today: todayStr, tomorrow: tomorrowStr },
      matchDate: chelseaMatch.utcDate ? new Date(chelseaMatch.utcDate).toISOString().split('T')[0] : null,
      chelseaMatchFound: true,
      matchData,
      rawMatch,
      fullMatchDetails: fullMatchDetails ? {
        ...fullMatchDetails,
        allKeys: Object.keys(fullMatchDetails),
        minute: fullMatchDetails.minute ?? null,
      } : null,
      apiInfo: {
        endpoint: `/matches?date=${dateStr}`,
        matchEndpoint: `/matches/${chelseaMatch.id}`,
        baseUrl: 'https://api.football-data.org/v4',
      },
      analysis: {
        hasMinuteField: chelseaMatch.minute !== undefined,
        minuteValue: chelseaMatch.minute ?? null,
        minuteType: typeof chelseaMatch.minute,
        status: chelseaMatch.status,
        isLive: chelseaMatch.status === 'IN_PLAY' || chelseaMatch.status === 'LIVE' || chelseaMatch.status === 'PAUSED',
        hasScore: chelseaMatch.score?.fullTime?.home !== null || chelseaMatch.score?.fullTime?.away !== null,
        minuteAnalysis,
      }
    });

  } catch (error) {
    console.error('❌ Error testing Chelsea match:', error);
    return res.status(500).json({ 
      error: 'Failed to test API',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

