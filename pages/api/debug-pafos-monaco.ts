import { NextApiRequest, NextApiResponse } from 'next';
import { FootballDataAPI } from '../../lib/football-data-api';
import { prisma } from '../../lib/prisma';

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

    // Get today's matches
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`🔍 Fetching matches for ${todayStr} to ${tomorrowStr}`);

    // Get all matches from today
    const allMatches = await footballAPI.getMatchesByDateRange(todayStr, tomorrowStr);
    
    // Filter for Champions League matches
    const clMatches = allMatches.filter(match => 
      match.competition && match.competition.name === 'UEFA Champions League'
    );

    console.log(`📊 Found ${clMatches.length} Champions League matches`);

    // Find Pafos/Monaco related matches
    const pafosMonacoMatches = clMatches.filter(match => {
      const homeName = match.homeTeam.name.toLowerCase();
      const awayName = match.awayTeam.name.toLowerCase();
      return homeName.includes('pafos') || homeName.includes('pafo') || 
             homeName.includes('monaco') ||
             awayName.includes('pafos') || awayName.includes('pafo') || 
             awayName.includes('monaco');
    });

    // Get our database teams
    const ourTeams = await prisma.team.findMany({
      where: {
        OR: [
          { name: { contains: 'Pafos', mode: 'insensitive' } },
          { name: { contains: 'Pafo', mode: 'insensitive' } },
          { name: { contains: 'Monaco', mode: 'insensitive' } }
        ]
      }
    });

    // Get our LIVE games with Pafos/Monaco
    const ourLiveGames = await prisma.game.findMany({
      where: {
        status: 'LIVE',
        OR: [
          { homeTeam: { name: { contains: 'Pafos', mode: 'insensitive' } } },
          { homeTeam: { name: { contains: 'Pafo', mode: 'insensitive' } } },
          { homeTeam: { name: { contains: 'Monaco', mode: 'insensitive' } } },
          { awayTeam: { name: { contains: 'Pafos', mode: 'insensitive' } } },
          { awayTeam: { name: { contains: 'Pafo', mode: 'insensitive' } } },
          { awayTeam: { name: { contains: 'Monaco', mode: 'insensitive' } } }
        ]
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    // Also get UPCOMING games (in case the game hasn't been marked as LIVE yet)
    const ourUpcomingGames = await prisma.game.findMany({
      where: {
        status: 'UPCOMING',
        OR: [
          { homeTeam: { name: { contains: 'Pafos', mode: 'insensitive' } } },
          { homeTeam: { name: { contains: 'Pafo', mode: 'insensitive' } } },
          { homeTeam: { name: { contains: 'Monaco', mode: 'insensitive' } } },
          { awayTeam: { name: { contains: 'Pafos', mode: 'insensitive' } } },
          { awayTeam: { name: { contains: 'Pafo', mode: 'insensitive' } } },
          { awayTeam: { name: { contains: 'Monaco', mode: 'insensitive' } } }
        ]
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    const ourGames = [...ourLiveGames, ...ourUpcomingGames];

    // Test matching
    const matchingResults = [];
    for (const externalMatch of pafosMonacoMatches) {
      const allOurTeams = ourGames.flatMap(game => [
        { id: game.homeTeam.id, name: game.homeTeam.name },
        { id: game.awayTeam.id, name: game.awayTeam.name }
      ]);

      const homeMatch = footballAPI.findBestTeamMatch(externalMatch.homeTeam.name, allOurTeams);
      const awayMatch = footballAPI.findBestTeamMatch(externalMatch.awayTeam.name, allOurTeams);

      matchingResults.push({
        external: {
          home: externalMatch.homeTeam.name,
          away: externalMatch.awayTeam.name,
          status: externalMatch.status,
          score: externalMatch.score
        },
        normalized: {
          home: footballAPI.normalizeTeamName(externalMatch.homeTeam.name),
          away: footballAPI.normalizeTeamName(externalMatch.awayTeam.name)
        },
        matching: {
          home: homeMatch ? {
            team: homeMatch.team.name,
            score: homeMatch.score,
            method: homeMatch.method
          } : null,
          away: awayMatch ? {
            team: awayMatch.team.name,
            score: awayMatch.score,
            method: awayMatch.method
          } : null
        }
      });
    }

    return res.status(200).json({
      success: true,
      dateRange: { from: todayStr, to: tomorrowStr },
      totalCLMatches: clMatches.length,
      pafosMonacoMatches: pafosMonacoMatches.length,
      externalMatches: pafosMonacoMatches.map(m => ({
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        status: m.status,
        score: m.score,
        utcDate: m.utcDate
      })),
      ourTeams: ourTeams.map(t => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName
      })),
      ourLiveGames: ourLiveGames.map(g => ({
        id: g.id,
        homeTeam: g.homeTeam.name,
        awayTeam: g.awayTeam.name,
        status: g.status,
        date: g.date
      })),
      ourUpcomingGames: ourUpcomingGames.map(g => ({
        id: g.id,
        homeTeam: g.homeTeam.name,
        awayTeam: g.awayTeam.name,
        status: g.status,
        date: g.date
      })),
      matchingResults
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: 'Failed to debug Pafos/Monaco matching',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

