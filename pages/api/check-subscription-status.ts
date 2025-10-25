import { NextApiRequest, NextApiResponse } from 'next';

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

    console.log('🔍 Checking Football-Data.org subscription status...');

    // Test 1: Check rate limits and subscription info
    const response = await fetch('https://api.football-data.org/v4/matches?status=LIVE', {
      headers: {
        'X-Auth-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Get rate limit info from headers
    const rateLimitRemaining = response.headers.get('X-Requests-Remaining');
    const rateLimitReset = response.headers.get('X-RequestCounter-Reset');
    const rateLimitMinute = response.headers.get('X-Requests-Used-Minute');

    console.log('📊 Rate limit info:');
    console.log('- Remaining requests:', rateLimitRemaining);
    console.log('- Reset time:', rateLimitReset);
    console.log('- Used this minute:', rateLimitMinute);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Test 2: Check if we can access Champions League data
    const clResponse = await fetch('https://api.football-data.org/v4/competitions/CL/matches?status=LIVE', {
      headers: {
        'X-Auth-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const clData = await clResponse.ok ? await clResponse.json() : null;

    return res.status(200).json({
      success: true,
      subscriptionStatus: {
        rateLimitRemaining: rateLimitRemaining,
        rateLimitReset: rateLimitReset,
        rateLimitMinute: rateLimitMinute,
        canAccessLiveData: response.ok,
        canAccessChampionsLeague: clResponse.ok,
        totalLiveMatches: data.matches?.length || 0,
        championsLeagueMatches: clData?.matches?.length || 0
      },
      recommendations: {
        isSubscriptionActive: rateLimitRemaining && parseInt(rateLimitRemaining) > 10,
        hasLiveAccess: response.ok,
        hasChampionsLeagueAccess: clResponse.ok,
        nextSteps: rateLimitRemaining && parseInt(rateLimitRemaining) > 10 
          ? 'Subscription appears active. If scores are still wrong, contact support.'
          : 'Subscription may not be fully active yet. Wait 15-30 minutes and try again.'
      }
    });

  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
    return res.status(500).json({ 
      error: 'Failed to check subscription status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
