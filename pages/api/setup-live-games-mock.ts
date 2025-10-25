import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎯 Setting up LIVE games for "Matchs du jour" with MOCK data...');

    // Get today's date
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Find games scheduled for today (these are likely the "Matchs du jour")
    const todaysGames = await prisma.game.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true
      },
      orderBy: {
        date: 'asc'
      },
      take: 3 // Take the first 3 games of today
    });

    console.log(`📊 Found ${todaysGames.length} games scheduled for today`);

    if (todaysGames.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No games scheduled for today',
        games: []
      });
    }

    // Mock live data to simulate real external API
    const mockLiveData = [
      {
        homeScore: 2,
        awayScore: 1,
        status: 'IN_PLAY',
        statusDetail: null,
        decidedBy: null,
        realGame: 'Real Madrid vs Barcelona'
      },
      {
        homeScore: 0,
        awayScore: 2,
        status: 'IN_PLAY',
        statusDetail: null,
        decidedBy: null,
        realGame: 'Manchester City vs Bayern Munich'
      },
      {
        homeScore: 3,
        awayScore: 1,
        status: 'FINISHED',
        statusDetail: null,
        decidedBy: 'FT',
        realGame: 'Paris Saint-Germain vs Liverpool'
      }
    ];

    const updatedGames: any[] = [];

    // Update each of today's games with mock live data
    for (let i = 0; i < Math.min(todaysGames.length, mockLiveData.length); i++) {
      const game = todaysGames[i];
      const mockData = mockLiveData[i];

      try {
        // Map mock status to internal status
        let status = 'LIVE';
        let statusDetail = mockData.statusDetail;
        let decidedBy = mockData.decidedBy;

        if (mockData.status === 'FINISHED') {
          status = 'FINISHED';
        }

        // Update the game with mock live data
        const updateData: any = {
          status: status,
          liveHomeScore: mockData.homeScore,
          liveAwayScore: mockData.awayScore,
          externalStatus: mockData.status,
          externalId: `mock_${Date.now()}_${i}`,
          lastSyncAt: new Date()
        };

        if (statusDetail) {
          updateData.statusDetail = statusDetail;
        }
        if (decidedBy) {
          updateData.decidedBy = decidedBy;
        }

        // If game is finished, also update final scores
        if (status === 'FINISHED') {
          updateData.homeScore = mockData.homeScore;
          updateData.awayScore = mockData.awayScore;
          updateData.finishedAt = new Date();
        }

        const updatedGame = await prisma.game.update({
          where: { id: game.id },
          data: updateData,
          include: {
            homeTeam: true,
            awayTeam: true,
            competition: true
          }
        });

        updatedGames.push({
          id: updatedGame.id,
          homeTeam: updatedGame.homeTeam.name,
          awayTeam: updatedGame.awayTeam.name,
          status: updatedGame.status,
          homeScore: updatedGame.homeScore,
          awayScore: updatedGame.awayScore,
          liveHomeScore: updatedGame.liveHomeScore,
          liveAwayScore: updatedGame.liveAwayScore,
          externalStatus: updatedGame.externalStatus,
          statusDetail: updatedGame.statusDetail,
          decidedBy: updatedGame.decidedBy,
          lastSyncAt: updatedGame.lastSyncAt?.toISOString(),
          mockGame: mockData.realGame,
          mockScore: `${mockData.homeScore}-${mockData.awayScore}`
        });

        console.log(`✅ Updated: ${updatedGame.homeTeam.name} vs ${updatedGame.awayTeam.name} - ${updatedGame.liveHomeScore}-${updatedGame.liveAwayScore} (${updatedGame.status})`);
        console.log(`   Mock game: ${mockData.realGame} - ${mockData.homeScore}-${mockData.awayScore}`);

      } catch (error) {
        console.error(`❌ Error updating game ${game.id}:`, error);
      }
    }

    console.log(`✅ Setup completed. Updated ${updatedGames.length} games for "Matchs du jour"`);

    return res.status(200).json({
      success: true,
      message: `Successfully set up ${updatedGames.length} LIVE games for "Matchs du jour" with mock data`,
      games: updatedGames,
      mockGamesCount: mockLiveData.length,
      todaysGamesCount: todaysGames.length
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return res.status(500).json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
