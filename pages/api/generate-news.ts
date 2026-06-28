import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { prisma } from '../../lib/prisma';
import { computeFinalStandings } from '../../lib/competition-completion';
import { computeStandingsAtDate } from '../../lib/classement';

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

// Per-matchday ranking snapshots used by the daily news prompt.
// Delegates the actual sort + position assignment to computeStandingsAtDate so
// the news matches what the user sees on the Classement (4-criterion logic).
async function getRankingEvolution(competitionId: string) {
  const PLACEHOLDER_TEAM_NAMES = ['xxxx', 'xxx2', 'xxxx2'];

  const finishedGames = await prisma.game.findMany({
    where: {
      competitionId,
      status: 'FINISHED',
      AND: [
        { homeTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
        { awayTeam: { name: { notIn: PLACEHOLDER_TEAM_NAMES } } },
      ],
    },
    orderBy: { date: 'asc' },
    select: { id: true, date: true },
  });

  if (finishedGames.length === 0) return [];

  const gamesByDate = new Map<string, typeof finishedGames>();
  finishedGames.forEach(game => {
    const dateKey = game.date.toISOString().split('T')[0];
    if (!gamesByDate.has(dateKey)) gamesByDate.set(dateKey, []);
    gamesByDate.get(dateKey)!.push(game);
  });

  const sortedDates = Array.from(gamesByDate.keys()).sort();
  const limitedDates = sortedDates.slice(-20); // Last 20 matchdays

  const rankingEvolution: Array<{
    date: string;
    rankings: {
      userId: string;
      userName: string;
      position: number;
      totalPoints: number;
    }[];
  }> = [];

  for (const dateKey of limitedDates) {
    const gamesOnDate = gamesByDate.get(dateKey)!;
    const latestGameOnDate = gamesOnDate[gamesOnDate.length - 1];

    const standings = await computeStandingsAtDate(competitionId, {
      upToDate: latestGameOnDate.date,
      treatAsCompleted: false,
    });

    rankingEvolution.push({
      date: latestGameOnDate.date.toISOString(),
      rankings: standings.map(s => ({
        userId: s.userId,
        userName: s.userName,
        position: s.position,
        totalPoints: s.totalPoints,
      })),
    });
  }

  return rankingEvolution;
}

type FinalStandingForPrompt = {
  user: { id: string; name: string };
  totalPoints: number;
  exactScores: number;
  shooters: number;
  totalScoreDifference: number;
  position: number;
};

/**
 * Build a season-finale news summary. Names every co-champion and every co-host
 * (the 4-criterion sort can leave ties even at the very end).
 *
 * Prompt is intentionally about pool standings only — NOT about the underlying
 * match results (e.g. "Real Madrid won the final" is irrelevant to the pool).
 */
async function generateFinaleSummary(params: {
  competitionName: string;
  finalStandings: FinalStandingForPrompt[];
  openAIApiKey: string | null;
}): Promise<string> {
  const { competitionName, finalStandings, openAIApiKey } = params;

  const lastPosition = finalStandings[finalStandings.length - 1].position;
  const champions = finalStandings.filter(s => s.position === 1);
  const hosts = finalStandings.filter(s => s.position === lastPosition);

  // Detect écart-tiebreaker scenarios: players with the SAME pts/exact/shooters
  // as the champions (or hosts) but who ended up 2nd/penultimate on the écart
  // criterion alone. These deserve a nod in the finale news.
  const sameFirst3 = (a: FinalStandingForPrompt, b: FinalStandingForPrompt) =>
    a.totalPoints === b.totalPoints &&
    a.exactScores === b.exactScores &&
    a.shooters === b.shooters;

  const championshipAlmost: FinalStandingForPrompt[] = [];
  for (let i = champions.length; i < finalStandings.length; i++) {
    if (sameFirst3(finalStandings[i], champions[0])) championshipAlmost.push(finalStandings[i]);
    else break;
  }
  const hostAlmost: FinalStandingForPrompt[] = [];
  for (let i = finalStandings.length - hosts.length - 1; i >= 0; i--) {
    if (sameFirst3(finalStandings[i], hosts[0])) hostAlmost.unshift(finalStandings[i]);
    else break;
  }

  const formatPlayers = (rows: FinalStandingForPrompt[]) =>
    rows
      .map(r => `${r.user.name} (${r.totalPoints} pts, ${r.exactScores} scores exacts, ${r.shooters} shooters, écart ${r.totalScoreDifference})`)
      .join(' / ');

  // Hardcoded fallback if no OpenAI key or call fails. Always definitive.
  const buildFallback = () => {
    const champLabel = champions.length > 1 ? 'Co-champions' : 'Champion';
    const hostLabel = hosts.length > 1 ? 'Hôtes du dîner' : 'Hôte du dîner';
    const almostChamp = championshipAlmost.length > 0
      ? ` Titre décroché d'un cheveu par l'écart aux scores réels sur : ${formatPlayers(championshipAlmost)}.`
      : '';
    const almostHost = hostAlmost.length > 0
      ? ` Dîner évité de justesse par l'écart sur : ${formatPlayers(hostAlmost)}.`
      : '';
    return `${competitionName} terminée. ${champLabel} : ${formatPlayers(champions)}. ${hostLabel} : ${formatPlayers(hosts)}.${almostChamp}${almostHost}`;
  };

  if (!openAIApiKey) {
    return buildFallback();
  }

  const contextForAI = {
    competition: competitionName,
    nbJoueurs: finalStandings.length,
    champions: champions.map(c => ({
      pseudo: c.user.name,
      points: c.totalPoints,
      scoresExacts: c.exactScores,
      shooters: c.shooters,
      ecart: c.totalScoreDifference,
    })),
    hotesDuDiner: hosts.map(h => ({
      pseudo: h.user.name,
      points: h.totalPoints,
      scoresExacts: h.exactScores,
      shooters: h.shooters,
      ecart: h.totalScoreDifference,
    })),
    // Players tied on points + exact + shooters with the champion(s) — decided
    // by écart alone. If non-empty, acknowledge their near-miss.
    presquChampionsParEcart: championshipAlmost.map(a => ({
      pseudo: a.user.name,
      points: a.totalPoints,
      scoresExacts: a.exactScores,
      shooters: a.shooters,
      ecart: a.totalScoreDifference,
    })),
    // Players who escaped the last place only on écart — deserve a sympathetic nod.
    presquHotesParEcart: hostAlmost.map(a => ({
      pseudo: a.user.name,
      points: a.totalPoints,
      scoresExacts: a.exactScores,
      shooters: a.shooters,
      ecart: a.totalScoreDifference,
    })),
    classementComplet: finalStandings.map(s => ({
      position: s.position,
      pseudo: s.user.name,
      points: s.totalPoints,
    })),
  };

  const prompt = `
Tu es un journaliste pour une ligue privée de pronostics appelée PronoFootball.Club.
La compétition "${competitionName}" vient de se terminer. Annonce le palmarès de la ligue (PAS les résultats sportifs réels).

Contraintes de sortie :
- Une à deux phrases, 30 à 45 mots maximum.
- En français, ton "news entre amis", à la fois célébratoire et taquin pour la fin de saison.
- Ne JAMAIS mentionner les équipes ni les résultats des matchs réels — c'est une news sur les pronos, pas sur le football/rugby.
- Ne pas inventer de contexte : utiliser uniquement les données fournies.

Contenu OBLIGATOIRE :
- Mentionner explicitement le ou les champion(s) avec leurs points finaux.
- Mentionner explicitement le ou les hôte(s) du dîner avec leurs points finaux.
- Si plusieurs co-champions ou co-hôtes : tous les nommer.

Départage par écart (à lire attentivement) :
- L'"écart aux scores réels" est le 4e et dernier critère du classement : somme des |pronostic - score réel| sur tous les paris. Plus petit = mieux. Il ne sert que quand deux joueurs sont à EXACTE égalité sur les points, scores exacts ET shooters.
- Si "presquChampionsParEcart" est NON VIDE : nomme le(s) joueur(s) concernés en UNE incise claire qui mentionne EXPLICITEMENT le critère "écart aux scores réels" ET les deux valeurs (celle du champion et celle du/des presque-champion(s)). Pas de phrase séparée d'éloge — l'incise suffit.
- Si "presquHotesParEcart" est NON VIDE : même traitement côté dîner — incise claire avec les deux valeurs d'écart.
- Si ces champs sont VIDES : ne parle PAS du critère d'écart.

Formulations acceptées pour l'incise :
- "devançant X sur l'écart aux scores réels (235 contre 280)"
- "à égalité parfaite avec X, départagé par l'écart aux scores réels (235 vs 280)"
- "X évite le dîner grâce à un écart aux scores réels plus faible (60 contre 90)"
Formulations INTERDITES (trop vagues) :
- "à l'écart près"
- "sur le fil"
- "d'un cheveu"

Important :
- "Hôte du dîner" = celui qui paie/organise le dîner (le dernier au classement). À traiter comme une petite humiliation amicale.
- Un "shooter" est une bourde / un prono manqué (sanction = un verre à boire). Jamais positif.

Qualité du français (relire AVANT de répondre) :
- Écris les nombres en lettres si ≤ douze, en chiffres au-delà. Les valeurs numériques d'écart aux scores réels (souvent > 100) se mettent en chiffres.
- "zéro" est INVARIABLE : écrire "zéro point", "zéro shooter", "zéro score exact" (JAMAIS "zéros points").
- Nombres composés : traits d'union entre éléments ("quatre-vingt-sept", "cent-trente-cinq").
- "cent" et "vingt" prennent un s pluriel SEULEMENT s'ils terminent le nombre ("deux cents", "quatre-vingts") et PAS s'ils sont suivis d'un autre nombre ("deux cent trente", "quatre-vingt-sept").
- Accords : vérifier pluriels, genres, participes passés avant de répondre.
- Pas de fautes : en cas de doute sur un mot, choisis une alternative certaine.

Exemples de bonnes formulations :
- Sans départage : "Yann remporte la Ligue des Champions 25/26 avec quatre-vingt-sept points et douze scores exacts ; Nono offrira le dîner avec ses quarante-et-un points."
- Avec co-champions : "Steph et Keke co-champions du Top 14 à égalité parfaite ; le dîner est pour Fifi, dernier de la promotion."
- Avec départage par écart au sommet : "Yann sacré champion du Six Nations 2026 à dix points, devançant Benouz sur l'écart aux scores réels (235 contre 280) ; Fifi offrira le dîner avec zéro point."
- Avec départage par écart au dernier : "Yann champion à quatre-vingts points ; Steph offrira le dîner avec ses vingt points, Fifi ayant évité l'addition grâce à un meilleur écart aux scores réels (60 contre 90)."

Données (format JSON) :
${JSON.stringify(contextForAI, null, 2)}

Génère maintenant la news de fin de compétition pour "${competitionName}".
`.trim();

  try {
    const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!completionRes.ok) {
      console.error('OpenAI API error (finale):', await completionRes.text());
      return buildFallback();
    }

    const data = (await completionRes.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return buildFallback();
    return content.replace(/\s+/g, ' ').replace(/\n/g, ' ');
  } catch (error) {
    console.error('Error generating finale summary with OpenAI:', error);
    return buildFallback();
  }
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
  isFinale?: boolean;
  finalStandings?: FinalStandingForPrompt[];
}) {
  const { competitionName, competitionId, matchDayDate, games, rankingEvolution, openAIApiKey, isFinale, finalStandings } = params;

  // Finale branch: dedicated prompt that names champion(s) + dinner host(s).
  if (isFinale && finalStandings && finalStandings.length > 0) {
    return await generateFinaleSummary({
      competitionName,
      finalStandings,
      openAIApiKey,
    });
  }

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

Qualité du français (relire AVANT de répondre) :
- Écris les nombres en lettres si ≤ douze, en chiffres au-delà (ex : "trois points", "vingt-cinq points").
- "zéro" est INVARIABLE : écrire "zéro point", "zéro shooter", "zéro score exact" (JAMAIS "zéros points").
- Nombres composés : traits d'union entre les éléments ("quatre-vingt-sept", "cent-trente-cinq").
- "cent" et "vingt" prennent un s au pluriel SEULEMENT s'ils terminent le nombre ("deux cents", "quatre-vingts") et PAS quand suivis d'un autre nombre ("deux cent trente", "quatre-vingt-sept").
- Accords : vérifier pluriels, genres, participes passés avant de répondre.
- Positions : "à la Xᵉ place" / "en Xᵉ position" (JAMAIS "au Xᵉ place").
- Préfère "un point de plus / X points" plutôt que "X points ajoutés".
- Pas de fautes d'orthographe : si tu doutes d'un mot, choisis une formulation alternative certaine.

Contenu attendu :
- Mettre en valeur les changements importants dans le classement général (leader, top 3, grosses progressions/chutes, égalités, surprises).
- Mentionner les joueurs ayant marqué beaucoup de points, réalisé des scores exacts, ou connu une journée compliquée.
- Ne parler des résultats des matchs (équipes) QUE si cela explique clairement un impact sur les pronostics (ex : “peu l’avaient vu”, “carnage dans les pronos”). Sinon, ne pas citer les équipes.
- S’il n’y a pas de gros changement, mentionne quand même un fait saillant (meilleur score du jour, remontée notable, journée calme, etc.).

Règle CRITIQUE sur les shooters (à relire attentivement) :
- Un "shooter" = un match où le joueur a OUBLIÉ DE PARIER. C'est factuel : la valeur est dans le champ "shooters" des données.
- NE PAS confondre "shooter" avec "zéro point". Un joueur peut parier et mal prédire : il a 0 point mais 0 shooter. C'est un pronostic raté, pas un shooter.
- Ne mentionner les shooters QUE si la valeur "shooters" > 0 dans les données du joueur pour ce jour. Si shooters = 0, INTERDIT d'utiliser les mots "shooter", "addition", "prono manqué", "bourde", ou toute référence à un verre / une note à régler.
- Pour un joueur avec 0 point et 0 shooter ce jour-là : parler de pronostic raté, journée blanche, stagnation au classement, etc. — mais sans vocabulaire de sanction.
- Quand on mentionne des shooters (valeur > 0), formuler comme une sanction : "s'offre un shooter de plus", "addition qui s'alourdit", sans moraliser.

Tu reçois pour cela :
- Le classement AVANT et APRÈS la journée (joueurs, points, position)
- Les performances du jour : pointsMarques, scoresExacts, shooters (nombre de matchs non pariés ce jour), changementPosition
- Les matchs joués aujourd'hui avec leur score

Exemples de bonnes phrases :
- "Nono prend la tête grâce à deux scores exacts, pendant que Yann chute à la quatrième place et s'offre deux shooters de plus." (OK si Yann a shooters > 0)
- "Steph confirme sa forme avec six points, mais la journée sourit aussi à Keke qui remonte dans le top trois."
- "Renato garde la première place avec un point, tandis que Yann et Steph font journée blanche sans marquer." (OK si shooters = 0)
- "Peu avaient vu la victoire de Galatasaray : carnage dans les pronos, sauf Fifi qui engrange trois points et grimpe."

Exemples à NE PAS faire :
- ❌ "Yann reste muet et continue d'accumuler les shooters" — si shooters = 0 dans les données.
- ❌ "Steph s'offre une addition salée" — si Steph n'a pas de shooters ce jour.

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
      status: string;
    }> = [];

    if (userId) {
      // User is logged in — only ACTIVE competitions the user is a member of feed the dashboard widget.
      // Past (COMPLETED) and cancelled comps stay out so the news feed reflects what's in flight now.
      const userCompetitions = await prisma.competitionUser.findMany({
        where: {
          userId: userId,
          competition: {
            status: { in: ['ACTIVE', 'active'] },
          },
        },
        include: {
          competition: {
            select: {
              id: true,
              name: true,
              logo: true,
              status: true,
            },
          },
        },
      });
      competitionsToProcess = userCompetitions.map(uc => uc.competition);
    } else {
      // No user session (automation) - process every non-cancelled competition.
      // For COMPLETED comps the loop is mostly a no-op (existing news + the
      // existence guard short-circuit), but it allows the finale prompt to
      // fire for a competition that has just auto-completed.
      const allActiveCompetitions = await prisma.competition.findMany({
        where: {
          status: {
            notIn: ['CANCELLED', 'cancelled'],
          },
        },
        select: {
          id: true,
          name: true,
          logo: true,
          status: true,
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
          } else if (competition.status.toLowerCase() === 'completed') {
            // Force mode on a COMPLETED competition with no existing news = no-op.
            // Historical comps cleaned up intentionally should NOT be backfilled
            // just because someone hits ?force=true. Only regenerate if a News
            // row already exists (i.e., the user explicitly wants to refresh it).
            log(`⚠️ Competition ${competition.name}: COMPLETED with no news — force mode will NOT backfill (use admin to insert a seed row first)`);
          } else {
            // No news exists for an ACTIVE/UPCOMING competition — backfill its
            // latest finished match day.
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
        // Skip this in force mode as we only want to regenerate the latest news.
        // Skip this for COMPLETED competitions to avoid backfilling history when
        // the cron sees an old finished season for the first time. The today/yesterday
        // check above is sufficient to catch a comp that has just auto-completed.
        const isCompletedComp = competition.status.toLowerCase() === 'completed';
        if (!forceRegenerate && !isCompletedComp) {
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

          // Finale detection: competition is COMPLETED (auto-completion has fired)
          // AND this date is the latest match day with games in the competition.
          // Both must be true to switch to the finale prompt.
          const allDateKeys = Array.from(gamesByDate.keys()).sort();
          const latestDateKey = allDateKeys[allDateKeys.length - 1];
          const isFinale =
            competition.status.toLowerCase() === 'completed' &&
            dateKey === latestDateKey;

          let finalStandings: FinalStandingForPrompt[] | undefined;
          if (isFinale) {
            log(`🏆 Competition ${competition.name}: Final match day detected — using finale prompt`);
            finalStandings = await computeFinalStandings(competition.id);
          }

          log(`📰 Competition ${competition.name}: Generating news for ${dateKey} (${formatDisplayDate(matchDayDate)})${isFinale ? ' [FINALE]' : ''}`);

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
            isFinale,
            finalStandings,
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
    // Logged-in users: only ACTIVE competitions they belong to. COMPLETED comps drop out — the
    // previous "include the most-recently-COMPLETED comp" carve-out caused CL 25/26 news to keep
    // appearing in the widget after the season ended.
    // Anonymous (automation) callers still iterate every non-cancelled comp so the news-cron can
    // generate the finale prompt for a competition that has just auto-completed.
    type CompForFetch = { id: string; status: string };
    let fetchCompetitions: CompForFetch[];
    if (userId) {
      const userCompetitionsForFetch = await prisma.competitionUser.findMany({
        where: {
          userId: userId,
          competition: { status: { in: ['ACTIVE', 'active'] } },
        },
        include: {
          competition: { select: { id: true, status: true } },
        },
      });
      fetchCompetitions = userCompetitionsForFetch.map(uc => uc.competition);
    } else {
      fetchCompetitions = await prisma.competition.findMany({
        where: { status: { notIn: ['CANCELLED', 'cancelled'] } },
        select: { id: true, status: true },
      });
    }

    const fetchCompetitionIds = fetchCompetitions.map(c => c.id);

    let allNewsItems: NewsItem[] = [];

    try {
      // Fetch news for each competition separately to get top 2 per competition
      for (const competitionId of fetchCompetitionIds) {
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


