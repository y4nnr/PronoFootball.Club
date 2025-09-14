import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '@lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session || !session.user || typeof session.user !== 'object' || !('role' in session.user) || typeof (session.user as { role: string }).role !== 'string' || (session.user as { role: string }).role.toLowerCase() !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { gameId } = req.query;

    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: 'Game ID is required' });
    }

    // Fetch game details with teams and competition
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        competition: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Fetch all bets for this game
    const bets = await prisma.bet.findMany({
      where: { gameId: gameId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch all users who are part of this competition (for adding new bets)
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId: game.competition.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    // Filter out users who already have bets for this game
    const usersWithBets = new Set(bets.map(bet => bet.user.id));
    const availableUsers = competitionUsers
      .map(cu => cu.user)
      .filter(user => !usersWithBets.has(user.id));

    return res.status(200).json({
      game,
      bets,
      availableUsers,
    });
  } catch (error) {
    console.error('Error fetching game bets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 