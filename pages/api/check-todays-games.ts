import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Checking games scheduled for today...');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get games for today (same logic as games-of-day API)
    const todaysGames = await prisma.game.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay
        },
        status: {
          in: ['UPCOMING', 'LIVE', 'FINISHED']
        }
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`📊 Found ${todaysGames.length} games scheduled for today`);

    const formattedGames = todaysGames.map(game => ({
      id: game.id,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      liveHomeScore: game.liveHomeScore,
      liveAwayScore: game.liveAwayScore,
      externalStatus: game.externalStatus,
      lastSyncAt: game.lastSyncAt?.toISOString(),
      competition: game.competition.name,
      date: game.date.toISOString()
    }));

    return res.status(200).json({
      success: true,
      message: `Found ${todaysGames.length} games scheduled for today`,
      games: formattedGames,
      totalGames: todaysGames.length
    });

  } catch (error) {
    console.error('❌ Error checking today\'s games:', error);
    return res.status(500).json({
      error: 'Failed to check today\'s games',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
