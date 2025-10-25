import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: competitionId } = req.query;

    if (!competitionId || typeof competitionId !== 'string') {
      return res.status(400).json({ error: 'Competition ID is required' });
    }

    // Get competition users
    const competitionUsers = await prisma.competitionUser.findMany({
      where: { competitionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePictureUrl: true
          }
        }
      }
    });

    // Get all games for this competition
    const games = await prisma.game.findMany({
      where: { competitionId },
      include: {
        bets: {
          select: {
            id: true,
            points: true,
            userId: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });
    

    // Group games by date first
    const gamesByDate = new Map<string, typeof games>();
    games.forEach(game => {
      const dateKey = game.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!gamesByDate.has(dateKey)) {
        gamesByDate.set(dateKey, []);
      }
      gamesByDate.get(dateKey)!.push(game);
    });

    // Create individual game days (one per date) but group them by journée
    const dates = Array.from(gamesByDate.keys()).sort();
    const gamesPerJournée = 3; // Adjust this number as needed
    
    
    // Group dates into journées by consecutive days
    const journées: Array<{ journéeNumber: number; dates: string[] }> = [];
    let currentJournée: string[] = [];
    let journéeNumber = 1;
    
    for (let i = 0; i < dates.length; i++) {
      const currentDate = new Date(dates[i]);
      const previousDate = i > 0 ? new Date(dates[i - 1]) : null;
      
      // Check if this date is consecutive to the previous one
      const isConsecutive = !previousDate || 
        (currentDate.getTime() - previousDate.getTime()) === (24 * 60 * 60 * 1000); // 1 day in milliseconds
      
      if (isConsecutive) {
        // Add to current journée
        currentJournée.push(dates[i]);
      } else {
        // Start a new journée
        if (currentJournée.length > 0) {
          journées.push({
            journéeNumber,
            dates: [...currentJournée]
          });
          journéeNumber++;
        }
        currentJournée = [dates[i]];
      }
    }
    
    // Add the last journée
    if (currentJournée.length > 0) {
      journées.push({
        journéeNumber,
        dates: [...currentJournée]
      });
    }
    
    // Create individual game days
    const gameDays = dates.map((dateKey, index) => {
      const dayGames = gamesByDate.get(dateKey) || [];
      const isCompleted = dayGames.every(game => game.status === 'FINISHED');
      const today = new Date();
      const gameDate = new Date(dateKey);
      const isCurrent = gameDate.toDateString() === today.toDateString();
      
      // Find which journée this date belongs to
      const journée = journées.find(j => j.dates.includes(dateKey));
      const journéeNumber = journée?.journéeNumber || 1;
      
      
      return {
        dayNumber: index + 1, // Sequential day number
        journéeNumber, // Which journée this belongs to
        date: gameDate.toISOString(), // Convert to proper ISO string
        isCompleted,
        isCurrent
      };
    });
    

    // Group by journée for easier processing
    const journéeGroups = new Map<number, typeof gameDays>();
    gameDays.forEach(day => {
      if (!journéeGroups.has(day.journéeNumber)) {
        journéeGroups.set(day.journéeNumber, []);
      }
      journéeGroups.get(day.journéeNumber)!.push(day);
    });

    // Calculate player scores per individual day
    const playerDayScores: Array<{
      playerId: string;
      dayNumber: number;
      points: number;
    }> = [];

    competitionUsers.forEach(compUser => {
      gameDays.forEach(day => {
        // Convert ISO date back to YYYY-MM-DD format for gamesByDate lookup
        const dateKey = new Date(day.date).toISOString().split('T')[0];
        const dayGames = gamesByDate.get(dateKey) || [];
        const dayPoints = dayGames.reduce((total, game) => {
          const userBet = game.bets.find(bet => bet.userId === compUser.userId);
          return total + (userBet?.points || 0);
        }, 0);

        playerDayScores.push({
          playerId: compUser.userId,
          dayNumber: day.dayNumber,
          points: dayPoints
        });
      });
    });

    // Prepare response data
    const players = competitionUsers.map(compUser => ({
      id: compUser.userId,
      name: compUser.user.name,
      profilePictureUrl: compUser.user.profilePictureUrl
    }));

    
    return res.status(200).json({
      players,
      gameDays,
      playerDayScores
    });

  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return res.status(500).json({
      error: 'Failed to fetch calendar data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
