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

    console.log('🔍 Checking Football-Data.org rate limit status...');

    // Make a simple request to check rate limit headers
    const response = await fetch('https://api.football-data.org/v4/matches?limit=1', {
      headers: {
        'X-Auth-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Extract ALL rate limit related headers
    const rateLimitHeaders = {
      'X-Requests-Available-Minute': response.headers.get('X-Requests-Available-Minute'),
      'X-Requests-Used-Minute': response.headers.get('X-Requests-Used-Minute'),
      'X-RequestCounter-Reset': response.headers.get('X-RequestCounter-Reset'),
      'X-Requests-Remaining': response.headers.get('X-Requests-Remaining'),
      'X-Requests-Available-Day': response.headers.get('X-Requests-Available-Day'),
      'X-Requests-Used-Day': response.headers.get('X-Requests-Used-Day'),
    };

    // Get all headers for debugging
    const allHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });

    const status = response.status;
    const isRateLimited = status === 429;

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      status,
      isRateLimited,
      rateLimitHeaders,
      allHeaders,
      responseOk: response.ok,
      message: isRateLimited 
        ? '⚠️ Rate limit reached! You need to wait before making more requests.'
        : '✅ Rate limit OK. You can make more requests.',
      analysis: {
        availablePerMinute: rateLimitHeaders['X-Requests-Available-Minute'] 
          ? parseInt(rateLimitHeaders['X-Requests-Available-Minute']) 
          : null,
        usedThisMinute: rateLimitHeaders['X-Requests-Used-Minute'] 
          ? parseInt(rateLimitHeaders['X-Requests-Used-Minute']) 
          : null,
        resetInSeconds: rateLimitHeaders['X-RequestCounter-Reset'] 
          ? parseInt(rateLimitHeaders['X-RequestCounter-Reset']) 
          : null,
        remainingRequests: rateLimitHeaders['X-Requests-Remaining'] 
          ? parseInt(rateLimitHeaders['X-Requests-Remaining']) 
          : null,
      }
    });

  } catch (error) {
    console.error('❌ Error checking rate limit:', error);
    return res.status(500).json({ 
      error: 'Failed to check rate limit',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

