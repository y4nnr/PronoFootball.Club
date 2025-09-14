import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { competitionId, userName } = req.query;
  if (!competitionId || typeof competitionId !== 'string' || !userName || typeof userName !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid competitionId or userName' });
  }

  try {
    const user = await prisma.user.findFirst({ where: { name: userName } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const bets = await prisma.bet.findMany({
      where: {
        userId: user.id,
        game: { competitionId }
      },
      include: { game: true }
    });

    const betDetails = bets.map(bet => ({
      gameId: bet.gameId,
      gameDate: bet.game.date,
      gameStatus: bet.game.status,
      homeScore: bet.game.homeScore,
      awayScore: bet.game.awayScore,
      betScore1: bet.score1,
      betScore2: bet.score2,
      points: bet.points
    }));

    // Calculate total score by summing points for FINISHED games
    const totalScore = betDetails
      .filter(bet => bet.gameStatus === 'FINISHED')
      .reduce((sum, bet) => sum + bet.points, 0);

    res.status(200).json({
      user: user.name,
      competitionId,
      bets: betDetails,
      totalScore
    });
  } catch (error) {
    console.error('Error fetching debug bets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 