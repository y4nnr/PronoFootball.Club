import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '../../../lib/prisma';

type NewsItem = {
  date: string;
  competition: string;
  logo: string;
  summary: string;
  matchDayDate: string; // ISO date string for sorting
};

// Helper to format a Date in a short, human readable form (e.g. 17/12/2025)
function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NewsItem[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current user session (optional - for filtering when fetching)
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id || null;

    // Find competitions to process
    // - If user is logged in: only their active competitions
    // - If no user: all active competitions
    let competitionsToProcess: Array<{
      id: string;
      name: string;
      logo: string | null;
    }> = [];

    if (userId) {
      // User is logged in - filter by their competitions
      const userCompetitions = await prisma.competitionUser.findMany({
        where: {
          userId: userId,
          competition: {
            status: {
              in: ['ACTIVE', 'active', 'UPCOMING', 'upcoming'],
            },
          },
        },
        include: {
          competition: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
      });
      competitionsToProcess = userCompetitions.map(uc => uc.competition);
    } else {
      // No user session - process all active competitions
      const allActiveCompetitions = await prisma.competition.findMany({
        where: {
          status: {
            in: ['ACTIVE', 'active', 'UPCOMING', 'upcoming'],
          },
        },
        select: {
          id: true,
          name: true,
          logo: true,
        },
      });
      competitionsToProcess = allActiveCompetitions;
    }

    if (competitionsToProcess.length === 0) {
      return res.status(200).json([]);
    }

    const competitionIds = competitionsToProcess.map(c => c.id);

    // Fetch all stored news from database
    let storedNews = [];
    try {
      storedNews = await prisma.news.findMany({
        where: {
          competitionId: { in: competitionIds },
        },
        include: {
          competition: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          matchDayDate: 'desc', // Newest first
        },
        // No limit - return all news
      });
    } catch (dbError) {
      console.error('Error fetching news from database:', dbError);
      return res.status(200).json([]);
    }

    // Format and return news items
    const newsItems: NewsItem[] = storedNews.map(news => ({
      date: formatDisplayDate(news.matchDayDate),
      competition: news.competition.name,
      logo: news.logo || '/images/competitions/champions-league.png',
      summary: news.summary,
      matchDayDate: news.matchDayDate.toISOString(), // For client-side sorting if needed
    }));

    return res.status(200).json(newsItems);
  } catch (error) {
    console.error('Error in /api/news/all:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}





