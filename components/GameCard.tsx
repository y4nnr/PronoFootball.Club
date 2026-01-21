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
    if (context === 'competition' && userPoints !== undefined) {
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
    if (context === 'competition' && userPoints !== undefined) {
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
    <div className={`${getBackgroundColor()} border rounded-xl md:rounded-2xl shadow flex flex-col items-stretch transition p-3 md:p-4 lg:p-5 gap-2 md:gap-3 ${getBorderColor()} ${isClickable ? 'hover:shadow-lg hover:border-primary-400 cursor-pointer' : 'cursor-default'} ${
      isHighlighted ? 
        highlightType === 'status' ? 'animate-bounce ring-4 ring-blue-400 ring-opacity-75' :
        highlightType === 'both' ? 'animate-pulse ring-4 ring-purple-400 ring-opacity-75' :
        'animate-pulse ring-4 ring-yellow-400 ring-opacity-75' : ''
    }`}>
      {/* Competition Name & Logo - Secondary importance, similar to date/time */}
      {game.competition && (
        <div className="flex items-center justify-between gap-2 pb-2.5 md:pb-3 border-b border-neutral-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {game.competition.logo ? (
              <img 
                src={game.competition.logo} 
                alt={game.competition.name} 
                className="w-6 h-6 md:w-7 md:h-7 rounded object-cover border border-gray-200 flex-shrink-0" 
              />
            ) : (
              <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                {game.competition.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-800 font-semibold truncate">
              <span className="md:hidden">{abbreviateCompetitionName(game.competition.name)}</span>
              <span className="hidden md:inline">{game.competition.name}</span>
            </span>
          </div>
          {/* Tick on the right (mobile only) */}
          {userHasBet && (
            <div className="md:hidden flex items-center flex-shrink-0">
              {context === 'home' ? (
                <div className="flex items-center justify-center w-4 h-4 bg-blue-100 rounded-full">
                  <span className="text-blue-600 text-xs font-semibold">✓</span>
                </div>
              ) : (
                <div 
                  className={`w-2 h-2 rounded-full ${
                    userPoints === 3 ? 'bg-yellow-500' : 
                    userPoints === 1 ? 'bg-green-500' : 
                    'bg-red-500'
                  }`} 
                  title={`Vous avez gagné ${userPoints || 0} point${(userPoints || 0) > 1 ? 's' : ''}`}
                ></div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Mobile: Date/Time and Status on same line, chronometer below status */}
      <div className="flex items-center w-full justify-between pb-2.5 md:hidden border-b border-neutral-200">
        {/* Date/Time on left - date above time */}
        <div className="flex items-center flex-shrink-0">
          <span className="inline-flex flex-col items-center px-3 py-1.5 text-xs text-gray-800 font-semibold bg-gray-100 rounded-full">
            <span className="leading-tight">{formatDate(game.date)}</span>
            <span className="leading-tight mt-0.5">{formatTime(game.date)}</span>
          </span>
        </div>
        {/* Status on the right - status on top, chronometer below */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {game.status === 'LIVE' ? (
            <>
              <span className="inline-block px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap bg-red-100 text-red-800 font-medium">
                {t('live')}
              </span>
              {game.externalStatus === 'HT' ? (
                <span className="inline-flex items-center px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-[10px] font-semibold animate-pulse">
                  MT
                </span>
              ) : game.elapsedMinute !== null && game.elapsedMinute !== undefined ? (
                <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold animate-pulse">
                  {game.elapsedMinute}'
                  {game.sportType === 'RUGBY' && game.elapsedMinute >= 80 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/80</span>
                  )}
                  {game.sportType !== 'RUGBY' && game.elapsedMinute >= 90 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/90</span>
                  )}
                </span>
              ) : (game.externalStatus === '1H' || game.externalStatus === '2H') ? (
                <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold animate-pulse">
                  {game.externalStatus === '1H' ? '1/2' : '2/2'}
                </span>
              ) : null}
            </>
          ) : (
            <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 whitespace-nowrap font-medium ${
              game.status === 'FINISHED' ? 'bg-green-100 text-green-800' :
              game.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            } ${
              isHighlighted && (highlightType === 'status' || highlightType === 'both') ? 'animate-bounce scale-110' : ''
            }`}>
              {game.status === 'UPCOMING' && t('upcoming')}
              {game.status === 'FINISHED' && t('finished')}
              {game.status !== 'UPCOMING' && game.status !== 'FINISHED' && game.status !== 'LIVE' && game.status}
            </span>
          )}
        </div>
      </div>
      {/* Desktop: Date & Status - Secondary importance */}
      <div className="hidden md:flex md:items-center w-full justify-between pb-3 border-b border-neutral-200">
        <span className="inline-block px-3 py-1.5 text-sm text-gray-800 font-semibold bg-gray-100 rounded-full flex-shrink-0">
          {formatDateTime(game.date)}
        </span>
        <div className="flex items-center gap-1 ml-1.5 md:ml-0 flex-shrink-0">
          {userHasBet && (
            <div className="flex items-center">
              {context === 'home' ? (
                <div className="flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-blue-100 rounded-full">
                  <span className="text-blue-600 text-xs font-semibold">✓</span>
                </div>
              ) : (
                <div 
                  className={`w-2 h-2 rounded-full ${
                    userPoints === 3 ? 'bg-yellow-500' : 
                    userPoints === 1 ? 'bg-green-500' : 
                    'bg-red-500'
                  }`} 
                  title={`Vous avez gagné ${userPoints || 0} point${(userPoints || 0) > 1 ? 's' : ''}`}
                ></div>
              )}
            </div>
          )}
          {game.status === 'LIVE' ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-block px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap bg-red-100 text-red-800 font-medium">
                {t('live')}
              </span>
              {game.externalStatus === 'HT' ? (
                <span className="inline-flex items-center px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-[10px] font-semibold animate-pulse">
                  MT
                </span>
              ) : game.elapsedMinute !== null && game.elapsedMinute !== undefined ? (
                <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold animate-pulse">
                  {game.elapsedMinute}'
                  {game.sportType === 'RUGBY' && game.elapsedMinute >= 80 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/80</span>
                  )}
                  {game.sportType !== 'RUGBY' && game.elapsedMinute >= 90 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/90</span>
                  )}
                </span>
              ) : (game.externalStatus === '1H' || game.externalStatus === '2H') ? (
                <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold animate-pulse">
                  {game.externalStatus === '1H' ? '1/2' : '2/2'}
                </span>
              ) : null}
            </div>
          ) : (
            <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 whitespace-nowrap font-medium ${
              game.status === 'FINISHED' ? 'bg-green-100 text-green-800' :
              game.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            } ${
              isHighlighted && (highlightType === 'status' || highlightType === 'both') ? 'animate-bounce scale-110' : ''
            }`}>
              {game.status === 'UPCOMING' && t('upcoming')}
              {game.status === 'FINISHED' && t('finished')}
              {game.status !== 'UPCOMING' && game.status !== 'FINISHED' && game.status !== 'LIVE' && game.status}
            </span>
          )}
        </div>
      </div>
      {/* Teams & Score - PRIMARY: Most prominent section */}
      <div className="flex items-center w-full justify-between py-3 md:py-4 border-b border-neutral-200">
          {/* Home Team */}
        <div className="flex flex-col items-center min-w-0 w-2/5 justify-end pr-1 md:pr-2 gap-1">
          {/* Mobile: Logo on top, name below */}
          <div className="md:hidden flex flex-col items-center w-full">
            {game.homeTeam.logo ? (
              <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 mb-1 flex-shrink-0">{game.homeTeam.name.substring(0,2)}</div>
            )}
            <div className="min-h-[32px] flex items-center justify-center w-full px-1">
              <span className="text-gray-900 font-medium text-xs text-center leading-tight line-clamp-2">{abbreviateTeamName(game.homeTeam)}</span>
            </div>
          </div>
          {/* Desktop: Logo on top, name below */}
          <div className="hidden md:flex flex-col items-center">
            {game.homeTeam.logo ? (
              <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 mb-1 flex-shrink-0">{game.homeTeam.name.substring(0,2)}</div>
            )}
            <span className="text-gray-900 font-medium text-xs lg:text-sm text-center truncate max-w-[90px]">{game.homeTeam.name}</span>
          </div>
        </div>
        {/* Score - PRIMARY: Largest and boldest */}
        <div className="flex-1 flex justify-center min-w-[50px] md:min-w-[60px]">
          <span className={`text-base md:text-xl lg:text-2xl font-bold text-gray-900 transition-all duration-300 ${
            isHighlighted && (highlightType === 'score' || highlightType === 'both') ? 'animate-pulse scale-110 text-yellow-600' : ''
          }`}>
            {game.status === 'FINISHED' && typeof game.homeScore === 'number' && typeof game.awayScore === 'number'
              ? `${game.homeScore} - ${game.awayScore}`
              : game.status === 'LIVE' && typeof game.liveHomeScore === 'number' && typeof game.liveAwayScore === 'number'
              ? `${game.liveHomeScore} - ${game.liveAwayScore}`
              : '-'}
          </span>
        </div>
        {/* Away Team */}
        <div className="flex flex-col items-center min-w-0 w-2/5 justify-start pl-1 md:pl-2 gap-1">
          {/* Mobile: Logo on top, name below */}
          <div className="md:hidden flex flex-col items-center w-full">
            {game.awayTeam.logo ? (
              <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 mb-1 flex-shrink-0">{game.awayTeam.name.substring(0,2)}</div>
            )}
            <div className="min-h-[32px] flex items-center justify-center w-full px-1">
              <span className="text-gray-900 font-medium text-xs text-center leading-tight line-clamp-2">{abbreviateTeamName(game.awayTeam)}</span>
            </div>
          </div>
          {/* Desktop: Logo on top, name below */}
          <div className="hidden md:flex flex-col items-center">
            {game.awayTeam.logo ? (
              <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 mb-1 flex-shrink-0">{game.awayTeam.name.substring(0,2)}</div>
            )}
            <span className="text-gray-900 font-medium text-xs lg:text-sm text-center truncate max-w-[90px]">{game.awayTeam.name}</span>
          </div>
        </div>
      </div>
      {/* Bets List */}
      {game.bets && game.bets.length > 0 && (
        <div className="w-full pt-2.5 md:pt-3">
          <div className="text-xs text-gray-500 font-medium mb-1.5 ml-1 uppercase tracking-wide">{t('placedBets')}</div>
          <ul className="divide-y divide-neutral-100">
            {game.bets.map((bet) => (
              <li key={bet.id} className="flex items-center py-1 first:pt-0 last:pb-0">
                <img
                  src={bet.user.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bet.user.name.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={bet.user.name}
                  className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-200 object-cover mr-1.5 md:mr-2"
                  title={bet.user.name}
                />
                <span className="text-xs text-gray-700 mr-1.5 md:mr-2 truncate max-w-[70px] md:max-w-[80px]">{bet.user.name}</span>
                {((game.status === 'LIVE' || game.status === 'FINISHED') && bet.score1 !== null && bet.score2 !== null) || 
                  (bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) ? (
                  (() => {
                    const highlight = getBetHighlight(bet);
                    // For LIVE games: colored text with border and light background
                    if (game.status === 'LIVE' && highlight) {
                      const textColor = highlight === 'gold' ? 'text-yellow-600' :
                                       highlight === 'green' ? 'text-green-600' :
                                       highlight === 'red' ? 'text-red-600' :
                                       'text-gray-700';
                      const bgColor = highlight === 'gold' ? 'bg-yellow-50' :
                                     highlight === 'green' ? 'bg-green-50' :
                                     highlight === 'red' ? 'bg-red-50' :
                                     'bg-gray-50';
                      const borderClass = highlight === 'gold' ? 'border border-yellow-400' :
                                         highlight === 'green' ? 'border border-green-300' :
                                         highlight === 'red' ? 'border border-red-300' :
                                         'border border-gray-300';
                      return (
                        <span className={`text-xs font-mono ${textColor} ${bgColor} ${borderClass} rounded-md px-1.5 md:px-2 py-0.5 ml-auto font-semibold`}>
                          <span className="md:hidden">{bet.score1}-{bet.score2}</span>
                          <span className="hidden md:inline">{bet.score1} - {bet.score2}</span>
                        </span>
                      );
                    } else if (game.status === 'FINISHED' && highlight) {
                      // For finished games: colored text with very light background and border
                      const textColor = highlight === 'gold' ? 'text-yellow-600' :
                                       highlight === 'green' ? 'text-green-600' :
                                       highlight === 'red' ? 'text-red-600' :
                                       'text-gray-700';
                      const bgColor = highlight === 'gold' ? 'bg-yellow-50' :
                                     highlight === 'green' ? 'bg-green-50' :
                                     highlight === 'red' ? 'bg-red-50' :
                                     'bg-gray-50';
                      const borderClass = highlight === 'gold' ? 'border border-yellow-400' :
                                         highlight === 'green' ? 'border border-green-300' :
                                         highlight === 'red' ? 'border border-red-300' :
                                         'border border-gray-300';
                      return (
                        <span className={`text-xs font-mono ${textColor} ${bgColor} ${borderClass} rounded-md px-1.5 md:px-2 py-0.5 ml-auto font-semibold`}>
                          <span className="md:hidden">{bet.score1}-{bet.score2}</span>
                          <span className="hidden md:inline">{bet.score1} - {bet.score2}</span>
                        </span>
                      );
                    } else {
                      // For upcoming games: default styling with border and light background
                      return (
                        <span className="text-xs font-mono text-gray-700 bg-gray-50 border border-gray-300 rounded-md px-1.5 md:px-2 py-0.5 ml-auto font-semibold">
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
      )}
    </div>
  );
  
  // Only wrap in Link if the game is clickable (UPCOMING status)
  if (href && isClickable) {
    return <Link href={href} className="block">{cardContent}</Link>;
  }
  
  // For non-clickable games (LIVE/FINISHED), return the card without Link wrapper
  return cardContent;
} 