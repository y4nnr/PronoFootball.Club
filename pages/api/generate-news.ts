import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';

type NewsItem = {
  date: string;
  competition: string;
  logo: string;
  summary: string;
};

// Small helper to format a Date as YYYY-MM-DD (using local time, not UTC)
function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Small helper to format a Date in a short, human readable form (e.g. 17/12/2025)
function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Helper function to get ranking evolution data (reusing logic from ranking-evolution API)
async function getRankingEvolution(competitionId: string) {
  const finishedGames = await prisma.game.findMany({
    where: {
      competitionId,
      status: { in: ['FINISHED', 'LIVE'] },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      status: true,
    },
  });

  if (finishedGames.length === 0) {
    return [];
  }

  const competitionUsers = await prisma.competitionUser.findMany({
    where: { competitionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profilePictureUrl: true,
        },
      },
    },
  });

  const userMap = new Map();
  competitionUsers.forEach(cu => {
    userMap.set(cu.userId, {
      name: cu.user.name,
      profilePictureUrl: cu.user.profilePictureUrl
    });
  });

  const userIds = competitionUsers.map(cu => cu.userId);

  // Group games by date (matchday)
  const gamesByDate = new Map<string, typeof finishedGames>();
  finishedGames.forEach(game => {
    const dateKey = game.date.toISOString().split('T')[0];
    if (!gamesByDate.has(dateKey)) {
      gamesByDate.set(dateKey, []);
    }
    gamesByDate.get(dateKey)!.push(game);
  });

  const rankingEvolution: Array<{
    date: string;
    rankings: {
      userId: string;
      userName: string;
      position: number;
      totalPoints: number;
    }[];
  }> = [];

  const sortedDates = Array.from(gamesByDate.keys()).sort();
  const limitedDates = sortedDates.slice(-20); // Last 20 matchdays

  for (const dateKey of limitedDates) {
    const gamesOnDate = gamesByDate.get(dateKey)!;
    const latestGameOnDate = gamesOnDate[gamesOnDate.length - 1];
    
    const betsUpToDate = await prisma.bet.findMany({
      where: {
        game: {
          competitionId,
          date: { lte: latestGameOnDate.date },
          status: { in: ['FINISHED', 'LIVE'] },
        },
        userId: { in: userIds },
      },
      select: {
        userId: true,
        points: true,
      },
    });

    const userPoints = new Map<string, number>();
    userIds.forEach(userId => userPoints.set(userId, 0));
    
    betsUpToDate.forEach(bet => {
      const currentPoints = userPoints.get(bet.userId) || 0;
      userPoints.set(bet.userId, currentPoints + (bet.points || 0));
    });

    const rankings = Array.from(userPoints.entries())
      .map(([userId, totalPoints]) => {
        const userData = userMap.get(userId);
        return {
          userId,
          userName: userData?.name || 'Unknown',
          totalPoints,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((user, index) => ({
        ...user,
        position: index + 1,
      }));

    rankingEvolution.push({
      date: latestGameOnDate.date.toISOString(),
      rankings,
    });
  }

  return rankingEvolution;
}

async function generateSummaryForMatchDay(params: {
  competitionName: string;
  competitionId: string;
  matchDayDate: Date;
  games: {
    id: string;
    date: Date;
    homeTeam: { name: string };
    awayTeam: { name: string };
    homeScore: number | null;
    awayScore: number | null;
    bets: {
      points: number;
      score1: number;
      score2: number;
      user: { name: string | null; id: string };
    }[];
  }[];
  rankingEvolution: Array<{
    date: string;
    rankings: {
      userId: string;
      userName: string;
      position: number;
      totalPoints: number;
    }[];
  }>;
  openAIApiKey: string | null;
}) {
  const { competitionName, competitionId, matchDayDate, games, rankingEvolution, openAIApiKey } = params;

  const totalGames = games.length;
  const allBets = games.flatMap((g) => g.bets);
  
  // Find ranking BEFORE and AFTER this match day
  const dateKey = formatDateKey(matchDayDate);
  const matchDayISO = matchDayDate.toISOString();
  
  // Sort ranking evolution by date
  const sortedEvolution = [...rankingEvolution].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Find the ranking entry for this match day (or closest before)
  let rankingAfterIndex = sortedEvolution.findIndex(r => r.date >= matchDayISO);
  if (rankingAfterIndex === -1) {
    rankingAfterIndex = sortedEvolution.length - 1;
  }
  
  const rankingAfter = sortedEvolution[rankingAfterIndex];
  const rankingBefore = rankingAfterIndex > 0 ? sortedEvolution[rankingAfterIndex - 1] : null;

  // Calculate points scored on this day per user
  const pointsOnDay = new Map<string, number>();
  const exactScoresOnDay = new Map<string, number>();
  const shootersOnDay = new Map<string, number>(); // missed bets
  
  // Get all users in competition to track shooters
  const allUserIds = new Set<string>();
  rankingAfter.rankings.forEach(r => allUserIds.add(r.userId));
  
  // Initialize shooters count (games where user didn't bet)
  games.forEach(game => {
    allUserIds.forEach(userId => {
      const hasBet = game.bets.some(b => b.user.id === userId);
      if (!hasBet) {
        shootersOnDay.set(userId, (shootersOnDay.get(userId) || 0) + 1);
      }
    });
  });

  // Calculate points and exact scores per user
  games.forEach(game => {
    if (game.homeScore === null || game.awayScore === null) return;
    
    game.bets.forEach(bet => {
      if (!bet.user?.id) return;
      const userId = bet.user.id;
      pointsOnDay.set(userId, (pointsOnDay.get(userId) || 0) + (bet.points || 0));
      
      // Check if exact score (3 points = exact score)
      if (bet.points === 3) {
        exactScoresOnDay.set(userId, (exactScoresOnDay.get(userId) || 0) + 1);
      }
    });
  });

  // Build player performance data with ranking changes
  const playerPerformances: Array<{
    userName: string;
    positionBefore: number | null;
    positionAfter: number;
    pointsBefore: number;
    pointsAfter: number;
    pointsOnDay: number;
    exactScores: number;
    shooters: number;
    positionChange: number; // positive = climbed, negative = fell
  }> = [];

  rankingAfter.rankings.forEach(rankAfter => {
    const rankBefore = rankingBefore?.rankings.find(r => r.userId === rankAfter.userId);
    const positionBefore = rankBefore?.position ?? null;
    const pointsBefore = rankBefore?.totalPoints ?? 0;
    const pointsAfter = rankAfter.totalPoints;
    const pointsOnDayValue = pointsOnDay.get(rankAfter.userId) || 0;
    const exactScores = exactScoresOnDay.get(rankAfter.userId) || 0;
    const shooters = shootersOnDay.get(rankAfter.userId) || 0;
    
    const positionChange = positionBefore !== null 
      ? positionBefore - rankAfter.position // positive = climbed up
      : 0;

    playerPerformances.push({
      userName: rankAfter.userName,
      positionBefore,
      positionAfter: rankAfter.position,
      pointsBefore,
      pointsAfter,
      pointsOnDay: pointsOnDayValue,
      exactScores,
      shooters,
      positionChange,
    });
  });

  // Match results for the day
  const matchResults = games
    .filter(g => g.homeScore !== null && g.awayScore !== null)
    .map(g => ({
      homeTeam: g.homeTeam.name,
      awayTeam: g.awayTeam.name,
      score: `${g.homeScore}-${g.awayScore}`,
    }));

  // Build context for OpenAI
  const contextForAI = {
    classementAvant: rankingBefore ? rankingBefore.rankings.map(r => ({
      pseudo: r.userName,
      points: r.totalPoints,
      position: r.position,
    })) : [],
    classementApres: rankingAfter.rankings.map(r => ({
      pseudo: r.userName,
      points: r.totalPoints,
      position: r.position,
    })),
    performancesDuJour: playerPerformances.map(p => ({
      pseudo: p.userName,
      pointsMarques: p.pointsOnDay,
      scoresExacts: p.exactScores,
      shooters: p.shooters,
      positionAvant: p.positionBefore,
      positionApres: p.positionAfter,
      changementPosition: p.positionChange,
    })),
    matchsJoues: matchResults,
  };

  // Fallback if no OpenAI key
  if (!openAIApiKey || totalGames === 0) {
    const dateLabel = formatDisplayDate(matchDayDate);
    if (!totalGames) {
      return `Aucun match joué le ${dateLabel} en ${competitionName}.`;
    }
    
    const topPerformer = playerPerformances
      .sort((a, b) => b.pointsOnDay - a.pointsOnDay)[0];
    
    if (topPerformer && topPerformer.pointsOnDay > 0) {
      return `${dateLabel} — ${topPerformer.userName} domine avec ${topPerformer.pointsOnDay} points et ${topPerformer.exactScores} score${topPerformer.exactScores > 1 ? 's' : ''} exact${topPerformer.exactScores > 1 ? 's' : ''}.`;
    }
    return `${dateLabel} — ${totalGames} match${totalGames > 1 ? 's' : ''} joué${totalGames > 1 ? 's' : ''} en ${competitionName}.`;
  }

  try {
    const formattedDate = formatDisplayDate(matchDayDate);

    const prompt = `
Tu es un journaliste pour une ligue privée de pronostics de football appelée PronoFootball.Club.
Ta mission : résumer une journée de compétition en UNE SEULE PHRASE courte, dynamique, en français, à afficher sur un tableau de bord.

Contraintes de sortie :
- UNE seule phrase (pas de retour à la ligne, pas de deuxième phrase).
- 15 à 25 mots maximum.
- Ton léger, fun, “news entre amis”, mais factuel.
- Va droit au fait (pas d’intro type “Aujourd’hui…”).
- Ne pas inventer de contexte ou de résultats : uniquement basé sur les données fournies.

Qualité du français :
- Écris les nombres en lettres (un, deux, trois…).
- Positions : “à la Xᵉ place” / “en Xᵉ position” (jamais “au Xᵉ place”).
- Préfère “un point de plus / X points” plutôt que “X points ajoutés”.

Contenu attendu :
- Mettre en valeur les changements importants dans le classement général (leader, top 3, grosses progressions/chutes, égalités, surprises).
- Mentionner les joueurs ayant marqué beaucoup de points, réalisé des scores exacts, ou connu une journée compliquée.
- Ne parler des résultats des matchs (équipes) QUE si cela explique clairement un impact sur les pronostics (ex : “peu l’avaient vu”, “carnage dans les pronos”). Sinon, ne pas citer les équipes.
- S’il n’y a pas de gros changement, mentionne quand même un fait saillant (meilleur score du jour, remontée notable, journée calme, etc.).

Important (shooters = pénalité) :
- Un “shooter” est une sanction (un verre à boire), pas une réussite.
- Quand tu mentionnes des shooters, formule-le comme une bourde / un prono manqué / une addition salée (“il/elle s’offre un shooter de plus”, “addition de shooters”), jamais comme quelque chose de positif.
- Tu peux faire un clin d’œil “soirée/boire” léger, mais sans moraliser.

Tu reçois pour cela :
- Le classement AVANT et APRÈS la journée (joueurs, points, position)
- Les performances du jour : points marqués, scores exacts, shooters
- Les matchs joués aujourd'hui avec leur score
- (optionnel) séries, moyenne de points, autres stats

Exemples de bonnes phrases :
- "Nono prend la tête grâce à deux scores exacts, pendant que Yann chute à la quatrième place et s’offre deux shooters de plus."
- "Steph confirme sa forme avec six points, mais la journée sourit aussi à Keke qui remonte dans le top trois."
- "Peu avaient vu la victoire de Galatasaray : carnage dans les pronos, sauf Fifi qui engrange trois points et grimpe."

Données (format JSON compact) :
${JSON.stringify(contextForAI, null, 2)}

Génère maintenant UNE phrase résumant la journée du ${formattedDate} pour la compétition "${competitionName}".
`.trim();

    const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!completionRes.ok) {
      console.error('OpenAI API error:', await completionRes.text());
      throw new Error('OpenAI API error');
    }

    const data = (await completionRes.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return content.replace(/\s+/g, ' ').replace(/\n/g, ' ');
  } catch (error) {
    console.error('Error generating news summary with OpenAI:', error);
    const dateLabel = formatDisplayDate(matchDayDate);
    const topPerformer = playerPerformances
      .sort((a, b) => b.pointsOnDay - a.pointsOnDay)[0];
    
    if (topPerformer && topPerformer.pointsOnDay > 0) {
      return `${dateLabel} — ${topPerformer.userName} domine avec ${topPerformer.pointsOnDay} points.`;
    }
    return `${dateLabel} — ${totalGames} match${totalGames > 1 ? 's' : ''} joué${totalGames > 1 ? 's' : ''} en ${competitionName}.`;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NewsItem[] | { error: string } | { news: NewsItem[]; debug?: any }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const debugMode = req.query.debug === 'true';
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      shouldGenerate: req.query.generate === 'true',
      forceRegenerate: req.query.force === 'true',
      logs: [],
    };

  const log = (message: string, data?: any) => {
    const logEntry = { message, data, time: new Date().toISOString() };
    debugInfo.logs.push(logEntry);
    console.log(`[GENERATE-NEWS] ${message}`, data || '');
  };

  try {
    // 0) Check if Prisma client has been regenerated (News model available)
    if (!prisma.news) {
      const errorMsg = 'Prisma client not regenerated. The News model is not available. Please run "npx prisma generate" on the server.';
      log(errorMsg);
      return res.status(500).json({ 
        error: 'Prisma client not regenerated',
        message: errorMsg,
        hint: 'Run "npx prisma generate" and restart the server'
      });
    }

    // 1) Get current user session (optional - for filtering when fetching)
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id || null;

    // 2) Check if we should generate news (query param: ?generate=true)
    const shouldGenerate = req.query.generate === 'true';
    // 3) Check if we should force regeneration (query param: ?force=true)
    const forceRegenerate = req.query.force === 'true';

    // 3) Find competitions to process
    // - If user is logged in: only their active competitions (for dashboard)
    // - If no user (automation): all active competitions
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
      // No user session (automation) - process all active competitions
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

    // Safety check: if no competition IDs, return empty
    if (competitionIds.length === 0) {
      return res.status(200).json([]);
    }

    // 4) If generate=true, generate and store news in DB
    if (shouldGenerate) {
      const openAIApiKey = process.env.OPENAI_API_KEY || null;

      for (const competition of competitionsToProcess) {

        // Get ranking evolution data for this competition
        const rankingEvolution = await getRankingEvolution(competition.id);

        if (rankingEvolution.length === 0) {
          continue; // Skip competitions with no ranking data
        }

        // Get today and yesterday dates in local timezone (Europe/Paris)
        // Use local time to match game.date which is stored in local time
        const now = new Date();
        // Get local date components (not UTC)
        const localYear = now.getFullYear();
        const localMonth = now.getMonth();
        const localDate = now.getDate();
        const today = new Date(localYear, localMonth, localDate);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const todayKey = formatDateKey(today);
        const yesterdayKey = formatDateKey(yesterday);

        log(`📅 Competition ${competition.name}: Checking dates - Today: ${todayKey}, Yesterday: ${yesterdayKey}`);

        // Fetch ALL games for this competition (not just finished) to check scheduled games
        const allRecentGames = await prisma.game.findMany({
          where: {
            competitionId: competition.id,
            OR: [
              // Games scheduled for today or yesterday
              {
                date: {
                  gte: yesterday,
                  lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // today + 1 day
                },
              },
              // Also get recently finished games (for the 2 last match days logic)
              {
                status: { in: ['FINISHED', 'LIVE'] },
              },
            ],
          },
          include: {
            homeTeam: true,
            awayTeam: true,
            bets: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
          take: 200, // safety limit
        });

        if (!allRecentGames.length) {
          log(`ℹ️ Competition ${competition.name}: No recent games found`);
          continue; // Skip competitions with no games
        }

        log(`📊 Competition ${competition.name}: Found ${allRecentGames.length} recent games`);

        // Group games by their scheduled date (game.date, not finish date)
        const gamesByDate = new Map<string, typeof allRecentGames>();
        for (const game of allRecentGames) {
          const key = formatDateKey(game.date);
          if (!gamesByDate.has(key)) {
            gamesByDate.set(key, []);
          }
          gamesByDate.get(key)!.push(game);
        }

        log(`📊 Competition ${competition.name}: Games grouped by date`, { dates: Array.from(gamesByDate.keys()).sort() });

        // Helper function to check if all games on a date are finished
        const areAllGamesFinished = (games: typeof allRecentGames): boolean => {
          if (games.length === 0) return false;
          return games.every(game => game.status === 'FINISHED');
        };

        // Helper function to check if news already exists for a date
        const newsExistsForDate = async (matchDayDate: Date): Promise<boolean> => {
          const existingNews = await prisma.news.findUnique({
            where: {
              competitionId_matchDayDate: {
                competitionId: competition.id,
                matchDayDate: matchDayDate,
              },
            },
          });
          return !!existingNews;
        };

        // Initialize list of dates to generate news for
        const datesToGenerate: string[] = [];

        // If force mode, find the latest news date and regenerate it
        if (forceRegenerate) {
          log(`🔄 Competition ${competition.name}: Force mode enabled - will regenerate latest news`);
          
          // Find the latest news in database for this competition
          const latestNews = await prisma.news.findFirst({
            where: {
              competitionId: competition.id,
            },
            orderBy: {
              matchDayDate: 'desc',
            },
          });

          if (latestNews) {
            const latestDateKey = formatDateKey(latestNews.matchDayDate);
            log(`📰 Competition ${competition.name}: Found latest news for ${latestDateKey}, will regenerate`);
            
            // Get games for this date
            const gamesOnDate = gamesByDate.get(latestDateKey);
            if (gamesOnDate && gamesOnDate.length > 0 && areAllGamesFinished(gamesOnDate)) {
              datesToGenerate.push(latestDateKey);
              log(`✨ Competition ${competition.name}: Will force regenerate news for ${latestDateKey}`);
            } else {
              log(`⚠️ Competition ${competition.name}: Cannot regenerate - games not found or not all finished for ${latestDateKey}`);
            }
          } else {
            // No news exists, find the latest date with finished games
            const finishedGamesByDate = new Map<string, typeof allRecentGames>();
            for (const game of allRecentGames) {
              if (game.status === 'FINISHED') {
                const key = formatDateKey(game.date);
                if (!finishedGamesByDate.has(key)) {
                  finishedGamesByDate.set(key, []);
                }
                finishedGamesByDate.get(key)!.push(game);
              }
            }

            const sortedFinishedDateKeys = Array.from(finishedGamesByDate.keys())
              .sort()
              .reverse();

            if (sortedFinishedDateKeys.length > 0) {
              const latestDateKey = sortedFinishedDateKeys[0];
              const gamesOnDate = finishedGamesByDate.get(latestDateKey);
              if (gamesOnDate && areAllGamesFinished(gamesOnDate)) {
                datesToGenerate.push(latestDateKey);
                log(`✨ Competition ${competition.name}: No news exists, will generate for latest finished date ${latestDateKey}`);
              }
            } else {
              log(`⚠️ Competition ${competition.name}: No finished games found to regenerate`);
            }
          }
        } else {
          // Normal mode: Check today and yesterday first (priority for recent days)
          const datesToCheck = [todayKey, yesterdayKey];

          for (const dateKey of datesToCheck) {
            const gamesOnDate = gamesByDate.get(dateKey);
            if (!gamesOnDate || gamesOnDate.length === 0) {
              log(`ℹ️ Competition ${competition.name}: No games scheduled for ${dateKey}`);
              continue; // No games scheduled for this date
            }

            log(`🔍 Competition ${competition.name}: Checking ${dateKey} - ${gamesOnDate.length} game(s) found`);
            const gameStatuses = gamesOnDate.map(g => `${g.homeTeam.name} vs ${g.awayTeam.name}: ${g.status}`);
            log(`   Game statuses for ${dateKey}`, { statuses: gameStatuses });

            // Check if all games are finished
            if (!areAllGamesFinished(gamesOnDate)) {
              const unfinishedCount = gamesOnDate.filter(g => g.status !== 'FINISHED').length;
              log(`⏳ Competition ${competition.name}: Not all games finished for ${dateKey} (${unfinishedCount} unfinished), skipping news generation`);
              continue; // Wait for all games to finish
            }

            // Check if news already exists
            const matchDayDate = gamesOnDate[0].date;
            const newsExists = await newsExistsForDate(matchDayDate);
            if (newsExists) {
              log(`✅ Competition ${competition.name}: News already exists for ${dateKey}, skipping`);
              continue; // News already generated
            }

            // All conditions met: generate news for this date
            log(`✨ Competition ${competition.name}: All conditions met for ${dateKey} - will generate news`);
            datesToGenerate.push(dateKey);
          }
        }

        // Also maintain the original logic: generate for the last 2 completed match days
        // (in case there are more than 2 days of completed games)
        // Skip this in force mode as we only want to regenerate the latest news
        if (!forceRegenerate) {
          const finishedGamesByDate = new Map<string, typeof allRecentGames>();
          for (const game of allRecentGames) {
            if (game.status === 'FINISHED') {
              const key = formatDateKey(game.date);
              if (!finishedGamesByDate.has(key)) {
                finishedGamesByDate.set(key, []);
              }
              finishedGamesByDate.get(key)!.push(game);
            }
          }

          const sortedFinishedDateKeys = Array.from(finishedGamesByDate.keys())
            .sort()
            .reverse()
            .slice(0, 2); // Last 2 match days with finished games

          // Add these dates to generate list if not already included
          for (const dateKey of sortedFinishedDateKeys) {
            if (!datesToGenerate.includes(dateKey)) {
              const gamesOnDate = finishedGamesByDate.get(dateKey);
              if (gamesOnDate && gamesOnDate.length > 0) {
                const matchDayDate = gamesOnDate[0].date;
                const newsExists = await newsExistsForDate(matchDayDate);
                if (!newsExists) {
                  datesToGenerate.push(dateKey);
                }
              }
            }
          }
        }

        if (datesToGenerate.length === 0) {
          log(`ℹ️ Competition ${competition.name}: No news to generate at this time`);
          continue;
        }

        const logoUrl =
          competition.logo ||
          '/images/competitions/champions-league.png'; // fallback logo

        // Generate and store news for each match day
        for (const dateKey of datesToGenerate) {
          const gamesOnDate = gamesByDate.get(dateKey) || finishedGamesByDate.get(dateKey);
          if (!gamesOnDate || !gamesOnDate.length) continue;

          // Only process if all games are finished
          if (!areAllGamesFinished(gamesOnDate)) {
            console.log(`⏳ Competition ${competition.name}: Skipping ${dateKey} - not all games finished`);
            continue;
          }

          const matchDayDate = gamesOnDate[0].date;

          log(`📰 Competition ${competition.name}: Generating news for ${dateKey} (${formatDisplayDate(matchDayDate)})`);

          const summary = await generateSummaryForMatchDay({
            competitionName: competition.name,
            competitionId: competition.id,
            matchDayDate,
            games: gamesOnDate.map((g) => ({
              id: g.id,
              date: g.date,
              homeTeam: { name: g.homeTeam.name },
              awayTeam: { name: g.awayTeam.name },
              homeScore: g.homeScore,
              awayScore: g.awayScore,
              bets: g.bets.map((b) => ({
                points: b.points,
                score1: b.score1,
                score2: b.score2,
                user: { 
                  id: b.user.id,
                  name: b.user.name,
                },
              })),
            })),
            rankingEvolution,
            openAIApiKey,
          });

          // Store in database (upsert: update if exists, create if not)
          await prisma.news.upsert({
            where: {
              competitionId_matchDayDate: {
                competitionId: competition.id,
                matchDayDate: matchDayDate,
              },
            },
            update: {
              summary,
              logo: logoUrl,
              updatedAt: new Date(),
            },
            create: {
              competitionId: competition.id,
              matchDayDate: matchDayDate,
              summary,
              logo: logoUrl,
            },
          });

          log(`✅ Competition ${competition.name}: News generated and stored for ${dateKey}`);
        }
      }
    }

    // 5) Fetch stored news from database
    // - If user is logged in: only their competitions
    // - If no user (automation): all competitions (though this shouldn't happen in fetch mode)
    // For each competition, get the 2 latest news items
    let allNewsItems: NewsItem[] = [];
    
    try {
      // Fetch news for each competition separately to get top 2 per competition
      for (const competitionId of competitionIds) {
        const competitionNews = await prisma.news.findMany({
          where: {
            competitionId: competitionId,
          },
          include: {
            competition: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            matchDayDate: 'desc',
          },
          take: 2, // Get 2 latest news per competition
        });

        // Format news items for this competition
        const formattedNews = competitionNews.map(news => ({
          date: formatDisplayDate(news.matchDayDate),
          competition: news.competition.name,
          logo: news.logo || '/images/competitions/champions-league.png',
          summary: news.summary,
        }));

        allNewsItems.push(...formattedNews);
      }
    } catch (dbError) {
      console.error('Error fetching news from database:', dbError);
      // If database error, return empty array (news table might not exist yet or other issue)
      return res.status(200).json([]);
    }

    // 6) Sort all news items by date (newest first) globally across all competitions
    allNewsItems.sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split('/').map(Number);
      const [dayB, monthB, yearB] = b.date.split('/').map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB.getTime() - dateA.getTime(); // Descending (newest first)
    });

    // Return max 8 items total (2 per competition, up to 4 competitions)
    const result = allNewsItems.slice(0, 8);
    
    // If debug mode, return debug info along with news
    if (debugMode) {
      return res.status(200).json({ 
        news: result,
        debug: debugInfo 
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in /api/generate-news:', error);
    // Log the full error for debugging
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


