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

    // Get today's date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    console.log(`🔍 Testing Football-Data.org API for FC Porto match on ${dateStr}`);

    // Fetch matches for today
    const response = await fetch(`https://api.football-data.org/v4/matches?date=${dateStr}`, {
      headers: {
        'X-Auth-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const matches = data.matches || [];

    console.log(`📊 Found ${matches.length} matches for today`);

    // Find FC Porto match (could be home or away)
    const portoMatch = matches.find((match: any) => 
      match.homeTeam?.name?.toLowerCase().includes('porto') ||
      match.awayTeam?.name?.toLowerCase().includes('porto') ||
      match.homeTeam?.shortName?.toLowerCase().includes('porto') ||
      match.awayTeam?.shortName?.toLowerCase().includes('porto')
    );

    if (!portoMatch) {
      // Try Primeira Liga matches
      const primeiraLigaMatches = matches.filter((match: any) => 
        match.competition?.name?.toLowerCase().includes('primeira') ||
        match.competition?.name?.toLowerCase().includes('portugal')
      );

      return res.status(200).json({
        success: true,
        date: dateStr,
        totalMatches: matches.length,
        portoMatchFound: false,
        primeiraLigaMatches: primeiraLigaMatches.length,
        allMatches: matches.map((match: any) => ({
          id: match.id,
          homeTeam: match.homeTeam?.name,
          awayTeam: match.awayTeam?.name,
          competition: match.competition?.name,
          status: match.status,
          utcDate: match.utcDate,
        })),
        primeiraLigaMatchesDetails: primeiraLigaMatches.map((match: any) => ({
          id: match.id,
          homeTeam: match.homeTeam?.name,
          awayTeam: match.awayTeam?.name,
          competition: match.competition?.name,
          status: match.status,
          utcDate: match.utcDate,
        })),
        message: 'FC Porto match not found, but here are all matches for today'
      });
    }

    // Get full match details by ID to see all available fields
    const matchDetailsResponse = await fetch(`https://api.football-data.org/v4/matches/${portoMatch.id}`, {
      headers: {
        'X-Auth-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    let fullMatchDetails = null;
    if (matchDetailsResponse.ok) {
      fullMatchDetails = await matchDetailsResponse.json();
    }

    // Extract all available fields from the match
    const matchData = {
      // Basic info
      id: portoMatch.id,
      utcDate: portoMatch.utcDate,
      status: portoMatch.status,
      matchday: portoMatch.matchday,
      
      // Teams
      homeTeam: {
        id: portoMatch.homeTeam?.id,
        name: portoMatch.homeTeam?.name,
        shortName: portoMatch.homeTeam?.shortName,
        tla: portoMatch.homeTeam?.tla,
        crest: portoMatch.homeTeam?.crest,
      },
      awayTeam: {
        id: portoMatch.awayTeam?.id,
        name: portoMatch.awayTeam?.name,
        shortName: portoMatch.awayTeam?.shortName,
        tla: portoMatch.awayTeam?.tla,
        crest: portoMatch.awayTeam?.crest,
      },
      
      // Score
      score: {
        winner: portoMatch.score?.winner,
        duration: portoMatch.score?.duration,
        fullTime: portoMatch.score?.fullTime,
        halfTime: portoMatch.score?.halfTime,
        regular: portoMatch.score?.regular,
        penalties: portoMatch.score?.penalties,
        extraTime: portoMatch.score?.extraTime,
      },
      
      // Competition
      competition: {
        id: portoMatch.competition?.id,
        name: portoMatch.competition?.name,
        code: portoMatch.competition?.code,
        type: portoMatch.competition?.type,
        emblem: portoMatch.competition?.emblem,
      },
      
      // Live/match info
      minute: portoMatch.minute ?? null,
      attendance: portoMatch.attendance ?? null,
      referees: portoMatch.referees ?? null,
      odds: portoMatch.odds ?? null,
      lastUpdated: portoMatch.lastUpdated ?? null,
      
      // Additional fields that might exist
      stage: portoMatch.stage ?? null,
      group: portoMatch.group ?? null,
      venue: portoMatch.venue ?? null,
    };

    // Also return the raw response to see all fields
    const rawMatch = {
      ...portoMatch,
      // Include all keys to see what's available
      allKeys: Object.keys(portoMatch),
    };

    return res.status(200).json({
      success: true,
      date: dateStr,
      portoMatchFound: true,
      matchData,
      rawMatch,
      fullMatchDetails: fullMatchDetails ? {
        ...fullMatchDetails,
        allKeys: Object.keys(fullMatchDetails),
      } : null,
      apiInfo: {
        endpoint: `/matches?date=${dateStr}`,
        matchEndpoint: `/matches/${portoMatch.id}`,
        baseUrl: 'https://api.football-data.org/v4',
      },
      analysis: {
        hasMinuteField: portoMatch.minute !== undefined,
        minuteValue: portoMatch.minute ?? null,
        status: portoMatch.status,
        isLive: portoMatch.status === 'IN_PLAY' || portoMatch.status === 'LIVE' || portoMatch.status === 'PAUSED',
        hasScore: portoMatch.score?.fullTime?.home !== null || portoMatch.score?.fullTime?.away !== null,
      }
    });

  } catch (error) {
    console.error('❌ Error testing FC Porto match:', error);
    return res.status(500).json({ 
      error: 'Failed to test API',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

