import { NextApiRequest, NextApiResponse } from 'next';

// Mock Football-Data.org API responses
const mockMatches = [
  {
    id: 12345,
    utcDate: new Date().toISOString(),
    status: 'IN_PLAY',
    score: {
      fullTime: { home: 2, away: 1 },
      halfTime: { home: 1, away: 0 }
    },
    homeTeam: { name: 'Real Madrid' },
    awayTeam: { name: 'Barcelona' },
    competition: { name: 'Champions League' }
  },
  {
    id: 12346,
    utcDate: new Date().toISOString(),
    status: 'IN_PLAY',
    score: {
      fullTime: { home: 0, away: 2 },
      halfTime: { home: 0, away: 1 }
    },
    homeTeam: { name: 'Manchester City' },
    awayTeam: { name: 'Bayern Munich' },
    competition: { name: 'Champions League' }
  },
  {
    id: 12347,
    utcDate: new Date().toISOString(),
    status: 'FINISHED',
    score: {
      fullTime: { home: 3, away: 1 },
      halfTime: { home: 2, away: 0 }
    },
    homeTeam: { name: 'Paris Saint-Germain' },
    awayTeam: { name: 'Liverpool' },
    competition: { name: 'Champions League' }
  }
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { competitions, status } = req.query;

  let filteredMatches = mockMatches;

  // Filter by competition (simulate Champions League)
  if (competitions === 'CL') {
    filteredMatches = mockMatches.filter(match => 
      match.competition.name === 'Champions League'
    );
  }

  // Filter by status
  if (status) {
    const statuses = Array.isArray(status) ? status : status.split(',');
    filteredMatches = filteredMatches.filter(match => 
      statuses.includes(match.status)
    );
  }

  res.status(200).json({
    count: filteredMatches.length,
    matches: filteredMatches
  });
}
