import { NextApiRequest, NextApiResponse } from 'next';
import { FootballDataAPI } from '../../lib/football-data-api';

// Helper function to normalize team names for better matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(fc|cf|ac|sc|united|city|town|rovers|wanderers|athletic|sporting)\b/g, '') // Remove common suffixes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

// Helper function to map external status to internal status with details
function mapExternalStatus(externalStatus: string): { 
  status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  detail?: string;
  decidedBy?: string;
} {
  switch (externalStatus) {
    case 'SCHEDULED':
    case 'TIMED':
      return { status: 'UPCOMING' };
    
    case 'IN_PLAY':
      return { status: 'LIVE' };
    
    case 'PAUSED':
      return { status: 'LIVE', detail: 'HT' };
    
    case 'AET':
      return { status: 'FINISHED', detail: 'AET', decidedBy: 'AET' };
    
    case 'PEN':
      return { status: 'FINISHED', detail: 'PEN', decidedBy: 'PEN' };
    
    case 'FINISHED':
      return { status: 'FINISHED', decidedBy: 'FT' };
    
    case 'POSTPONED':
      return { status: 'UPCOMING', detail: 'PPD' };
    
    case 'SUSPENDED':
      return { status: 'LIVE', detail: 'SUS' };
    
    case 'CANCELED':
    case 'CANCELLED':
      return { status: 'FINISHED', detail: 'CANC', decidedBy: 'FT' };
    
    default:
      return { status: 'UPCOMING' };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 Testing refactored live sync logic...');

    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY not found in environment variables');
    }
    const footballAPI = new FootballDataAPI(apiKey);

    // Test API connection by trying to get live matches
    let isConnected = false;
    try {
      const liveMatches = await footballAPI.getLiveMatches();
      isConnected = true;
      console.log(`✅ API connection successful, found ${liveMatches.length} live matches`);
    } catch (error) {
      console.error('❌ API connection failed:', error);
      return res.status(500).json({ error: 'API connection failed' });
    }

    // Get live matches
    const liveMatches = await footballAPI.getLiveMatches();
    console.log(`📊 Found ${liveMatches.length} live matches from external API`);

    // Test status mapping
    const testStatuses = ['SCHEDULED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'AET', 'PEN', 'POSTPONED', 'SUSPENDED', 'CANCELED'];
    const statusMappings = testStatuses.map(status => ({
      external: status,
      ...mapExternalStatus(status)
    }));

    // Test team name normalization
    const testTeamNames = [
      'Real Madrid CF',
      'FC Barcelona',
      'Manchester United',
      'Bayern München',
      'Paris Saint-Germain',
      'AC Milan',
      'Sporting CP'
    ];
    const normalizedNames = testTeamNames.map(name => ({
      original: name,
      normalized: normalizeTeamName(name)
    }));

    return res.status(200).json({
      success: true,
      message: 'Refactored live sync logic test completed',
      results: {
        apiConnection: isConnected,
        totalMatches: liveMatches.length,
        statusMappings,
        teamNameNormalization: normalizedNames,
        sampleMatches: liveMatches.slice(0, 3).map(match => ({
          id: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          status: match.status,
          score: match.score.fullTime,
          date: match.utcDate
        }))
      }
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
