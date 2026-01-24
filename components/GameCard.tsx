import Link from 'next/link';
import { useTranslation } from '../hooks/useTranslation';

interface Bet {
  id: string;
  userId: string;
  score1: number | null;
  score2: number | null;
  points?: number;
  user: {
    name: string;
    profilePictureUrl?: string;
  };
}

interface Team {
  name: string;
  logo?: string | null;
  shortName?: string | null;
}

interface Game {
  status: string;
  externalStatus?: string | null; // V2: External API status (HT, 1H, 2H, etc.)
  date: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  liveHomeScore?: number;
  liveAwayScore?: number;
  elapsedMinute?: number | null; // V2: Chronometer minute (0-90+ for football, 0-80+ for rugby)
  sportType?: string | null; // FOOTBALL or RUGBY
  competition?: {
    name: string;
    logo?: string | null;
  };
  bets: Bet[];
}

interface GameCardProps {
  game: Game;
  currentUserId?: string;
  href?: string;
  context?: 'home' | 'competition';
  isHighlighted?: boolean;
  highlightType?: 'score' | 'status' | 'both';
}

// Deterministic date formatting to avoid hydration errors
function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

// Format date only
function formatDate(dateString: string) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Format time only
function formatTime(dateString: string) {
  const date = new Date(dateString);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

// Abbreviate team names for mobile display - 3 letters only
function abbreviateTeamName(team: Team): string {
  // Use shortName from database if available, take first 3 letters
  if (team.shortName) {
    return team.shortName.substring(0, 3).toUpperCase();
  }
  
  // Fallback: use first 3 letters of team name
  return team.name.substring(0, 3).toUpperCase();
}

// Abbreviate competition names for mobile display
function abbreviateCompetitionName(competitionName: string): string {
  const name = competitionName.trim();
  const lowerName = name.toLowerCase();
  
  // Champions League variations
  if (lowerName.includes('champions league')) {
    if (lowerName.includes('uefa')) {
      return 'UEFA CL';
    }
    return 'Champions League';
  }
  
  // 6 Nations - remove year and any suffix
  if (lowerName.includes('6 nations') || lowerName.includes('six nations')) {
    // Remove year pattern (e.g., "2026", "2025-26", etc.)
    return name.replace(/\s*\d{4}(-\d{2})?.*$/i, '').trim();
  }
  
  // Ligue 1 - keep as is (already short)
  if (lowerName.includes('ligue 1')) {
    return 'Ligue 1';
  }
  
  // For other competitions, return as is for now
  return name;
}

export default function GameCard({ game, currentUserId, href, context = 'home', isHighlighted = false, highlightType = 'score' }: GameCardProps) {
  const { t } = useTranslation();
  const isOpen = game.status === 'UPCOMING';
  const isClickable = game.status === 'UPCOMING'; // Only UPCOMING games are clickable
  
  // Check if user has placed a bet on this game
  const userHasBet = currentUserId ? game.bets.some(bet => bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) : false;
  
  // Get user's bet points for competition context
  const userBet = currentUserId ? game.bets.find(bet => bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) : null;
  const userPoints = userBet?.points;
  
  // Compute which bets should be displayed (outside render to avoid issues)
  const displayableBets = (() => {
    // Early return if no bets
    if (!game.bets) {
      return [];
    }
    if (!Array.isArray(game.bets)) {
      return [];
    }
    if (game.bets.length === 0) {
      return [];
    }
    
    // Filter to only bets with valid numeric scores
    const betsWithValidScores = game.bets.filter(bet => {
      if (!bet) return false;
      const hasScore1 = typeof bet.score1 === 'number' && !isNaN(bet.score1) && bet.score1 >= 0;
      const hasScore2 = typeof bet.score2 === 'number' && !isNaN(bet.score2) && bet.score2 >= 0;
      return hasScore1 && hasScore2;
    });
    
    if (!betsWithValidScores || betsWithValidScores.length === 0) {
      return [];
    }
    
    // For all game statuses, include all bets with valid scores
    // The rendering logic will handle showing/hiding scores based on game status and user
    return betsWithValidScores && betsWithValidScores.length > 0 ? betsWithValidScores : [];
  })();
  
  // Explicit check - if no displayable bets, set to empty array
  // Make this check extremely strict
  const hasDisplayableBets = Boolean(
    displayableBets && 
    Array.isArray(displayableBets) && 
    displayableBets.length > 0 &&
    displayableBets.some(bet => 
      bet && 
      typeof bet.score1 === 'number' && 
      typeof bet.score2 === 'number' &&
      !isNaN(bet.score1) &&
      !isNaN(bet.score2)
    )
  );
  
  // Debug logging - always log when section might render
  if (process.env.NODE_ENV === 'development') {
    if (game.bets && game.bets.length > 0) {
      console.log('🔍 GameCard Debug:', {
        homeTeam: game.homeTeam?.name,
        awayTeam: game.awayTeam?.name,
        status: game.status,
        betsCount: game.bets.length,
        displayableBetsCount: displayableBets.length,
        hasDisplayableBets,
        bets: game.bets.map(b => ({ 
          id: b.id, 
          userId: b.userId, 
          score1: b.score1, 
          score2: b.score2,
          score1Type: typeof b.score1,
          score2Type: typeof b.score2
        }))
      });
    }
  }

  // Helper function to determine bet highlight for LIVE and FINISHED games
  const getBetHighlight = (bet: Bet) => {
    if (bet.score1 === null || bet.score2 === null) return null;
    
    let actualHomeScore: number | null | undefined;
    let actualAwayScore: number | null | undefined;
    
    if (game.status === 'LIVE') {
      actualHomeScore = game.liveHomeScore;
      actualAwayScore = game.liveAwayScore;
    } else if (game.status === 'FINISHED') {
      actualHomeScore = game.homeScore;
      actualAwayScore = game.awayScore;
    } else {
      return null;
    }
    
    if (actualHomeScore === null || actualHomeScore === undefined || 
        actualAwayScore === null || actualAwayScore === undefined) {
      return null;
    }
    
    // For FINISHED games, prefer using stored points if available (already calculated with correct scoring system)
    // This ensures rugby games with "very close" scores (3 points) show as gold
    if (game.status === 'FINISHED' && bet.points !== null && bet.points !== undefined) {
      if (bet.points === 3) return 'gold';
      if (bet.points === 1) return 'green';
      if (bet.points === 0) return 'red';
    }
    
    // Fallback: calculate based on score comparison (for LIVE games or when points not available)
    // Check for exact score match (gold)
    if (bet.score1 === actualHomeScore && bet.score2 === actualAwayScore) {
      return 'gold';
    }
    
    // Check for correct result (green)
    const betResult = bet.score1 > bet.score2 ? 'home' : bet.score1 < bet.score2 ? 'away' : 'draw';
    const actualResult = actualHomeScore > actualAwayScore ? 'home' : actualHomeScore < actualAwayScore ? 'away' : 'draw';
    
    if (betResult === actualResult) {
      return 'green';
    }
    
    // No match - red
    return 'red';
  };
  
  // Determine border color based on context
  const getBorderColor = () => {
    // Only show points-based styling for FINISHED games in competition context
    if (context === 'competition' && game.status === 'FINISHED' && userPoints !== undefined && userPoints !== null) {
      if (userPoints === 3) return 'border-yellow-400 border-2'; // Gold for 3 points
      if (userPoints === 1) return 'border-green-400 border-2'; // Green for 1 point
      if (userPoints === 0) return 'border-red-400 border-2'; // Red for 0 points
    }
    if (context === 'home' && userHasBet) {
      return 'border-blue-400 border-2'; // Blue for any bet on home page
    }
    return 'border-neutral-200';
  };

  // Determine background color based on context
  const getBackgroundColor = () => {
    // Only show points-based styling for FINISHED games in competition context
    if (context === 'competition' && game.status === 'FINISHED' && userPoints !== undefined && userPoints !== null) {
      if (userPoints === 3) return 'bg-yellow-50'; // Light gold for 3 points
      if (userPoints === 1) return 'bg-green-50'; // Light green for 1 point
      if (userPoints === 0) return 'bg-red-50'; // Light red for 0 points
    }
    if (context === 'home' && userHasBet) {
      return 'bg-blue-50'; // Light blue for any bet on home page
    }
    return 'bg-neutral-50'; // Default neutral background
  };
  
  const cardContent = (
    <div className={`bg-white dark:bg-[rgb(38,38,38)] border-2 border-gray-300 dark:border-gray-700 rounded-xl md:rounded-2xl shadow-lg dark:shadow-dark-modern-lg flex flex-col items-stretch transition overflow-hidden self-start ${isClickable ? `hover:shadow-xl dark:hover:shadow-dark-xl hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer transform hover:scale-[1.01]` : 'cursor-default'} ${
      isHighlighted ? 
        highlightType === 'status' ? 'animate-bounce ring-4 ring-blue-400 ring-opacity-75' :
        highlightType === 'both' ? 'animate-pulse ring-4 ring-purple-400 ring-opacity-75' :
        'animate-pulse ring-4 ring-yellow-400 ring-opacity-75' : ''
    }`}>
      {/* Competition Name & Logo - Section 1: Darker shade (top) */}
      {game.competition && (
        <div className="flex items-center justify-between gap-2 px-3 md:px-4 pt-3 md:pt-4 pb-2.5 md:pb-3 bg-gray-200 dark:bg-[rgb(40,40,40)] border-b border-gray-300 dark:border-gray-600">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {game.competition.logo ? (
              <img 
                src={game.competition.logo} 
                alt={game.competition.name} 
                className="w-6 h-6 md:w-7 md:h-7 dark:w-7 dark:h-7 dark:md:w-8 dark:md:h-8 rounded object-cover border border-gray-300 dark:border-gray-600 flex-shrink-0 shadow-sm dark:bg-white dark:p-0.5" 
              />
            ) : (
              <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 font-bold flex-shrink-0">
                {game.competition.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold truncate">
              <span className="md:hidden">{abbreviateCompetitionName(game.competition.name)}</span>
              <span className="hidden md:inline">{game.competition.name}</span>
            </span>
          </div>
          {/* Tick on the right (mobile and desktop) */}
          {userHasBet && (
            <div className="flex items-center flex-shrink-0">
              {context === 'home' ? (
                <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-black dark:bg-white rounded-full border-2 border-black dark:border-white">
                  <span className="text-white dark:text-black text-sm md:text-base font-bold">✓</span>
                </div>
              ) : (
                // Only show points dot for FINISHED games
                game.status === 'FINISHED' && userPoints !== undefined && userPoints !== null ? (
                  <div 
                    className={`w-3 h-3 rounded-full shadow-md ${
                      userPoints === 3 ? 'bg-yellow-500' : 
                      userPoints === 1 ? 'bg-green-500' : 
                      'bg-red-500'
                    }`} 
                    title={`Vous avez gagné ${userPoints} point${userPoints > 1 ? 's' : ''}`}
                  ></div>
                ) : (
                  // For UPCOMING/LIVE games, show a simple checkmark like home context
                  <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 bg-black dark:bg-white rounded-full border-2 border-black dark:border-white">
                    <span className="text-white dark:text-black text-sm md:text-base font-bold">✓</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
      {/* Section 2: Date/Time & Status - Dedicated section for better visibility (Mobile) */}
      <div className="flex items-center justify-between w-full px-3 md:px-4 py-3 md:hidden bg-gray-50 dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
        {/* Date/Time on left */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold uppercase tracking-wide">{formatDate(game.date)}</span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">{formatTime(game.date)}</span>
        </div>
        {/* Status on the right */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {game.status === 'LIVE' ? (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="inline-block px-2.5 py-1 text-[10px] rounded-full whitespace-nowrap bg-red-500 dark:bg-red-600 text-white font-bold shadow-md">
                  {t('live')}
                </span>
              </div>
              {game.externalStatus === 'HT' ? (
                <span className="inline-flex items-center px-2.5 py-1 bg-orange-500 dark:bg-orange-600 text-white rounded-full text-[10px] font-bold animate-pulse border-2 border-orange-300 dark:border-orange-500 shadow-md">
                  MT
                </span>
              ) : game.elapsedMinute !== null && game.elapsedMinute !== undefined ? (
                <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 bg-gray-800 text-white rounded-full text-[11px] font-bold animate-pulse shadow-md">
                  {game.elapsedMinute}'
                  {game.sportType === 'RUGBY' && game.elapsedMinute >= 80 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/80</span>
                  )}
                  {game.sportType !== 'RUGBY' && game.elapsedMinute >= 90 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/90</span>
                  )}
                </span>
              ) : (game.externalStatus === '1H' || game.externalStatus === '2H') ? (
                <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 bg-gray-800 text-white rounded-full text-[11px] font-bold animate-pulse shadow-md">
                  {game.externalStatus === '1H' ? '1/2' : '2/2'}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`inline-block px-2.5 py-1 text-[10px] rounded-full transition-all duration-300 whitespace-nowrap font-bold shadow-md ${
                game.status === 'FINISHED' ? 'bg-gray-100 dark:bg-[rgb(40,40,40)] border-2 border-black dark:border-white text-gray-700 dark:text-gray-300' :
                game.status === 'UPCOMING' ? 'bg-gray-100 dark:bg-[rgb(40,40,40)] border-2 border-blue-500 dark:border-blue-600 text-gray-700 dark:text-gray-300' :
                'bg-gray-500 dark:bg-gray-600 text-white'
              } ${
                isHighlighted && (highlightType === 'status' || highlightType === 'both') ? 'animate-bounce scale-110' : ''
              }`}>
                {game.status === 'UPCOMING' && t('upcoming')}
                {game.status === 'FINISHED' && t('finished')}
                {game.status !== 'UPCOMING' && game.status !== 'FINISHED' && game.status !== 'LIVE' && game.status}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Section 2: Date/Time & Status - Dedicated section for better visibility (Desktop) */}
      <div className="hidden md:flex md:items-center w-full justify-between px-3 md:px-4 py-3 bg-gray-50 dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
        {/* Date/Time on left */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-gray-700 dark:text-gray-300 font-semibold uppercase tracking-wide">{formatDate(game.date)}</span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
          <span className="text-xs text-gray-700 dark:text-gray-300 font-bold">{formatTime(game.date)}</span>
        </div>
        {/* Status on the right */}
        <div className="flex items-center gap-2 ml-1.5 md:ml-0 flex-shrink-0">
          {game.status === 'LIVE' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="inline-block px-2.5 py-1 text-[10px] rounded-full whitespace-nowrap bg-red-500 dark:bg-red-600 text-white font-bold shadow-md">
                {t('live')}
              </span>
              {game.externalStatus === 'HT' ? (
                <span className="inline-flex items-center px-2.5 py-1 bg-orange-500 dark:bg-orange-600 text-white rounded-full text-[10px] font-bold animate-pulse border-2 border-orange-300 dark:border-orange-500 shadow-md">
                  MT
                </span>
              ) : game.elapsedMinute !== null && game.elapsedMinute !== undefined ? (
                <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 bg-gray-800 text-white rounded-full text-[11px] font-bold animate-pulse shadow-md">
                  {game.elapsedMinute}'
                  {game.sportType === 'RUGBY' && game.elapsedMinute >= 80 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/80</span>
                  )}
                  {game.sportType !== 'RUGBY' && game.elapsedMinute >= 90 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/90</span>
                  )}
                </span>
              ) : (game.externalStatus === '1H' || game.externalStatus === '2H') ? (
                <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 bg-gray-800 text-white rounded-full text-[11px] font-bold animate-pulse shadow-md">
                  {game.externalStatus === '1H' ? '1/2' : '2/2'}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={`inline-block px-2.5 py-1 text-[10px] rounded-full transition-all duration-300 whitespace-nowrap font-bold shadow-md ${
                game.status === 'FINISHED' ? 'bg-gray-100 dark:bg-[rgb(40,40,40)] border-2 border-black dark:border-white text-gray-700 dark:text-gray-300' :
                game.status === 'UPCOMING' ? 'bg-gray-100 dark:bg-[rgb(40,40,40)] border-2 border-blue-500 dark:border-blue-600 text-gray-700 dark:text-gray-300' :
                'bg-gray-500 dark:bg-gray-600 text-white'
              } ${
                isHighlighted && (highlightType === 'status' || highlightType === 'both') ? 'animate-bounce scale-110' : ''
              }`}>
                {game.status === 'UPCOMING' && t('upcoming')}
                {game.status === 'FINISHED' && t('finished')}
                {game.status !== 'UPCOMING' && game.status !== 'FINISHED' && game.status !== 'LIVE' && game.status}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Teams & Score - Section 3: Light gray (primary section) */}
      <div className="flex items-center w-full justify-between py-4 md:py-6 px-3 md:px-4 bg-gray-50 dark:bg-[rgb(38,38,38)] border-b border-gray-200 dark:border-gray-700">
          {/* Home Team */}
        <div className="flex flex-col items-center min-w-0 w-2/5 justify-end pr-1 md:pr-2 gap-1">
          {/* Mobile: Logo on top, name below */}
          <div className="md:hidden flex flex-col items-center w-full">
            {game.homeTeam.logo ? (
              <div className={`w-10 h-10 dark:w-12 dark:h-12 mb-2 flex-shrink-0 flex items-center justify-center`}>
                <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-700 dark:text-gray-300 font-bold mb-2 flex-shrink-0 border-2 border-gray-300 dark:border-gray-600">{game.homeTeam.name.substring(0,2).toUpperCase()}</div>
            )}
            <div className="min-h-[32px] flex items-center justify-center w-full px-1">
              <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs text-center leading-tight line-clamp-2">{abbreviateTeamName(game.homeTeam)}</span>
            </div>
          </div>
          {/* Desktop: Logo on top, name below */}
          <div className="hidden md:flex flex-col items-center">
            {game.homeTeam.logo ? (
              <div className={`w-12 h-12 dark:w-14 dark:h-14 mb-2 flex-shrink-0 flex items-center justify-center`}>
                <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300 font-bold mb-2 flex-shrink-0 border-2 border-gray-300 dark:border-gray-600">{game.homeTeam.name.substring(0,2).toUpperCase()}</div>
            )}
            <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs lg:text-sm text-center truncate max-w-[90px]">{game.homeTeam.name}</span>
          </div>
        </div>
        {/* Score - PRIMARY: Largest and boldest - Maximum contrast */}
        <div className="flex-1 flex justify-center min-w-[60px] md:min-w-[80px]">
          {(() => {
            // Use consistent font size for both single and double digit scores
            // Same size for live and finished scores
            const fontSizeClass = 'text-lg md:text-xl lg:text-2xl';
            
            return (
              <span className={`${fontSizeClass} font-black text-gray-900 dark:text-gray-100 transition-all duration-300 ${
                isHighlighted && (highlightType === 'score' || highlightType === 'both') ? 'animate-pulse scale-110 text-yellow-600' : ''
              }`}>
                {game.status === 'FINISHED' && typeof game.homeScore === 'number' && typeof game.awayScore === 'number'
                  ? `${game.homeScore} - ${game.awayScore}`
                  : game.status === 'LIVE' && (typeof game.liveHomeScore === 'number' || game.liveHomeScore === 0) && (typeof game.liveAwayScore === 'number' || game.liveAwayScore === 0)
                  ? `${game.liveHomeScore ?? 0} - ${game.liveAwayScore ?? 0}`
                  : <span className="text-gray-400 dark:text-gray-500">-</span>}
              </span>
            );
          })()}
        </div>
        {/* Away Team */}
        <div className="flex flex-col items-center min-w-0 w-2/5 justify-start pl-1 md:pl-2 gap-1">
          {/* Mobile: Logo on top, name below */}
          <div className="md:hidden flex flex-col items-center w-full">
            {game.awayTeam.logo ? (
              <div className={`w-10 h-10 dark:w-12 dark:h-12 mb-2 flex-shrink-0 flex items-center justify-center`}>
                <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-700 dark:text-gray-300 font-bold mb-2 flex-shrink-0 border-2 border-gray-300 dark:border-gray-600">{game.awayTeam.name.substring(0,2).toUpperCase()}</div>
            )}
            <div className="min-h-[32px] flex items-center justify-center w-full px-1">
              <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs text-center leading-tight line-clamp-2">{abbreviateTeamName(game.awayTeam)}</span>
            </div>
          </div>
          {/* Desktop: Logo on top, name below */}
          <div className="hidden md:flex flex-col items-center">
            {game.awayTeam.logo ? (
              <div className={`w-12 h-12 dark:w-14 dark:h-14 mb-2 flex-shrink-0 flex items-center justify-center`}>
                <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300 font-bold mb-2 flex-shrink-0 border-2 border-gray-300 dark:border-gray-600">{game.awayTeam.name.substring(0,2).toUpperCase()}</div>
            )}
            <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs lg:text-sm text-center truncate max-w-[90px]">{game.awayTeam.name}</span>
          </div>
        </div>
      </div>
      {/* Bets List - Section 4: Matching main section style (bottom) */}
      {hasDisplayableBets === true ? (
          <div className="w-full pt-3 md:pt-4 px-3 md:px-4 pb-3 md:pb-4 bg-gray-50 dark:bg-[rgb(38,38,38)]">
            <div className="text-xs text-gray-700 dark:text-gray-300 font-semibold mb-2.5 md:mb-3 uppercase tracking-wide">{t('placedBets')}</div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {displayableBets.map((bet) => (
              <li key={bet.id} className="flex items-center py-2 first:pt-0 last:pb-0">
                <img
                  src={bet.user.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bet.user.name.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={bet.user.name}
                  className="w-6 h-6 md:w-7 md:h-7 rounded-full border-2 border-gray-300 dark:border-gray-600 object-cover mr-2 md:mr-3 shadow-sm"
                  title={bet.user.name}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium mr-2 md:mr-3 truncate max-w-[70px] md:max-w-[80px]">{bet.user.name}</span>
                {((game.status === 'LIVE' || game.status === 'FINISHED') && bet.score1 !== null && bet.score2 !== null) || 
                  (bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) ? (
                  (() => {
                    const highlight = getBetHighlight(bet);
                    // For LIVE games: colored text with border and light background
                    // NOTE: These colors are kept the same in dark mode to preserve production color coding
                    // Gold = exact score, Green = correct result, Red = no match
                    if (game.status === 'LIVE' && highlight) {
                      // Use same style as UPCOMING but with colored borders
                      const borderClass = highlight === 'gold' ? 'border-2 border-yellow-500 dark:border-yellow-600' :
                                         highlight === 'green' ? 'border-2 border-green-500 dark:border-green-600' :
                                         highlight === 'red' ? 'border-2 border-red-500 dark:border-red-600' :
                                         'border border-gray-300 dark:border-gray-600';
                      return (
                        <span className={`text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[rgb(40,40,40)] ${borderClass} rounded-lg px-2 md:px-2.5 py-1 ml-auto font-bold shadow-sm`}>
                          <span className="md:hidden">{bet.score1}-{bet.score2}</span>
                          <span className="hidden md:inline">{bet.score1} - {bet.score2}</span>
                        </span>
                      );
                    } else if (game.status === 'FINISHED' && highlight) {
                      // Use same style as UPCOMING but with colored borders
                      const borderClass = highlight === 'gold' ? 'border-2 border-yellow-500 dark:border-yellow-600' :
                                         highlight === 'green' ? 'border-2 border-green-500 dark:border-green-600' :
                                         highlight === 'red' ? 'border-2 border-red-500 dark:border-red-600' :
                                         'border border-gray-300 dark:border-gray-600';
                      return (
                        <span className={`text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[rgb(40,40,40)] ${borderClass} rounded-lg px-2 md:px-2.5 py-1 ml-auto font-bold shadow-sm`}>
                          <span className="md:hidden">{bet.score1}-{bet.score2}</span>
                          <span className="hidden md:inline">{bet.score1} - {bet.score2}</span>
                        </span>
                      );
                    } else {
                      // For upcoming games: default styling with light background and border
                      return (
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-2 md:px-2.5 py-1 ml-auto font-bold shadow-sm">
                          <span className="md:hidden">{bet.score1}-{bet.score2}</span>
                          <span className="hidden md:inline">{bet.score1} - {bet.score2}</span>
                        </span>
                      );
                    }
                  })()
                ) : null}
              </li>
              ))}
            </ul>
          </div>
        ) : null}
    </div>
  );
  
  // Only wrap in Link if the game is clickable (UPCOMING status)
  if (href && isClickable) {
    return <Link href={href} className="block">{cardContent}</Link>;
  }
  
  // For non-clickable games (LIVE/FINISHED), return the card without Link wrapper
  return cardContent;
} 