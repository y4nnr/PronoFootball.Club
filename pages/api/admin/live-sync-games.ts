import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

type LiveSyncGame = {
  id: string;
  date: string;
  status: string;
  externalStatus: string | null;
  elapsedMinute: number | null;
  externalId: string | null;
  lastSyncAt: string | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
  };
  competition: {
    id: string;
    name: string;
    sportType: string;
  };
  liveHomeScore: number | null;
  liveAwayScore: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type LiveSyncGamesResponse = {
  games: LiveSyncGame[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LiveSyncGamesResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized - No session' });
  }

  const userRole = (session.user as { role?: string }).role?.toLowerCase();
  if (userRole !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized - Admin access required' });
  }

  try {
    const {
      sportType,
      status,
      minutes,
      limit,
    } = req.query as {
      sportType?: string;
      status?: string;
      minutes?: string;
      limit?: string;
    };

    const now = new Date();
    const minutesBack = minutes ? parseInt(minutes, 10) : 180; // default: last 3 hours
    const since = new Date(now.getTime() - minutesBack * 60 * 1000);
    const take = limit ? Math.min(parseInt(limit, 10) || 200, 500) : 200;

    const where: any = {
      lastSyncAt: {
        not: null,
        gte: since,
      },
    };

    if (sportType === 'FOOTBALL' || sportType === 'RUGBY') {
      where.competition = {
        sportType,
      };
    }

    if (status === 'UPCOMING' || status === 'LIVE' || status === 'FINISHED' || status === 'CANCELLED') {
      where.status = status;
    }

    const games = await prisma.game.findMany({
      where,
      orderBy: {
        lastSyncAt: 'desc',
      },
      take,
      select: {
        id: true,
        date: true,
        status: true,
        externalStatus: true,
        elapsedMinute: true,
        externalId: true,
        lastSyncAt: true,
        liveHomeScore: true,
        liveAwayScore: true,
        homeScore: true,
        awayScore: true,
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
        competition: {
          select: {
            id: true,
            name: true,
            sportType: true,
          },
        },
      },
    });

    const response: LiveSyncGamesResponse = {
      games: games.map((g) => ({
        id: g.id,
        date: g.date.toISOString(),
        status: g.status,
        externalStatus: g.externalStatus,
        elapsedMinute: g.elapsedMinute,
        externalId: g.externalId,
        lastSyncAt: g.lastSyncAt ? g.lastSyncAt.toISOString() : null,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        competition: g.competition,
        liveHomeScore: g.liveHomeScore,
        liveAwayScore: g.liveAwayScore,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
      })),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('[ADMIN LIVE SYNC] Error fetching live sync games:', error);
    return res.status(500).json({ error: 'Failed to fetch live sync games' });
  }
}

