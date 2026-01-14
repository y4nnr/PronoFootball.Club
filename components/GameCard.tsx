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

// Abbreviate team names for mobile display - always use shortName if available
function abbreviateTeamName(team: Team): string {
  // Always use shortName from database if available
  if (team.shortName) {
    return team.shortName;
  }
  
  // Fallback: if no shortName, use automatic abbreviation
  const teamName = team.name;
  
  // If name is short (8 chars or less), return as is
  if (teamName.length <= 8) {
    return teamName;
  }
  
  // Split by spaces and common separators
  const words = teamName.split(/[\s-]+/);
  
  // If multiple words, take first letter of each word (e.g., "Paris Saint-Germain" -> "PSG")
  if (words.length > 1) {
    return words.map(word => word.charAt(0).toUpperCase()).join('');
  }
  
  // For single word teams, take first 4-5 characters
  return teamName.substring(0, 5).toUpperCase();
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
      {/* Competition Name & Logo */}
      {game.competition && (
        <div className="flex items-center gap-2 pb-2 md:pb-2.5 border-b border-neutral-200">
          {game.competition.logo ? (
            <img 
              src={game.competition.logo} 
              alt={game.competition.name} 
              className="w-5 h-5 md:w-6 md:h-6 rounded object-cover border border-gray-200 flex-shrink-0" 
            />
          ) : (
            <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-gray-200 flex items-center justify-center text-[8px] md:text-[10px] text-gray-500 flex-shrink-0">
              {game.competition.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-[10px] md:text-xs text-neutral-600 font-medium truncate flex-1">
            {game.competition.name}
          </span>
        </div>
      )}
      {/* Date & Status */}
      <div className="flex flex-col md:flex-row md:items-center w-full justify-between pb-2 md:pb-3 border-b border-neutral-200 gap-1.5 md:gap-0">
        {/* Mobile: First line with Date/Time (2 lines) + Status + Tick */}
        {/* Desktop: Date/Time on left */}
        <div className="flex items-center w-full md:w-auto justify-between md:justify-start gap-1.5">
          {/* Date/Time box - 2 lines on mobile, 1 line on desktop */}
          <span className="text-[9px] md:text-[10px] lg:text-xs text-gray-700 font-semibold bg-gray-100 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md border border-gray-200 flex-shrink-0 flex flex-col md:flex-row md:items-center">
            <span className="md:hidden leading-tight">{formatDate(game.date)}</span>
            <span className="md:hidden leading-tight">{formatTime(game.date)}</span>
            <span className="hidden md:inline">{formatDateTime(game.date)}</span>
          </span>
          {/* Mobile: Status + Tick on same line as date/time */}
          <div className="flex items-center gap-1 ml-1.5 md:hidden flex-shrink-0">
            {userHasBet && (
              <div className="flex items-center">
                {context === 'home' ? (
                  <div className="flex items-center justify-center w-4 h-4 bg-blue-100 rounded-full">
                    <span className="text-blue-600 text-[10px] font-bold">✓</span>
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
              <span className="inline-block px-2.5 py-1 text-[10px] rounded-full whitespace-nowrap bg-red-100 text-red-800">
                {t('live')}
              </span>
            ) : (
              <span className={`inline-block px-2.5 py-1 text-[10px] rounded-full transition-all duration-300 whitespace-nowrap ${
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
        {/* Desktop: Status + Tick + Chronometer on right */}
        <div className="hidden md:flex items-center gap-1 ml-1.5 md:ml-0 flex-shrink-0">
          {userHasBet && (
            <div className="flex items-center">
              {context === 'home' ? (
                <div className="flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-blue-100 rounded-full">
                  <span className="text-blue-600 text-[10px] md:text-xs font-bold">✓</span>
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
              {/* Live status badge - NO animation, static */}
              <span className="inline-block px-2.5 md:px-2 py-1 md:py-1 text-[10px] md:text-[10px] lg:text-xs rounded-full whitespace-nowrap bg-red-100 text-red-800">
                {t('live')}
              </span>
              {/* Chronometer */}
              {game.externalStatus === 'HT' ? (
                <span className="inline-flex items-center px-2 md:px-2.5 py-1 md:py-1 bg-orange-100 text-orange-800 rounded-full text-[10px] md:text-[10px] lg:text-xs font-bold animate-pulse">
                  MT
                </span>
              ) : game.elapsedMinute !== null && game.elapsedMinute !== undefined ? (
                <span className="inline-flex items-center justify-center min-w-[32px] px-2 md:px-2.5 py-1 md:py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] md:text-[11px] lg:text-xs font-semibold animate-pulse border border-gray-300">
                  {game.elapsedMinute}'
                  {/* Show max time indicator for rugby (80 min) vs football (90 min) */}
                  {game.sportType === 'RUGBY' && game.elapsedMinute >= 80 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/80</span>
                  )}
                  {game.sportType !== 'RUGBY' && game.elapsedMinute >= 90 && (
                    <span className="ml-0.5 text-[9px] opacity-75">/90</span>
                  )}
                </span>
              ) : (game.externalStatus === '1H' || game.externalStatus === '2H') ? (
                // Fallback: show half indicator when chrono is not available
                <span className="inline-flex items-center justify-center min-w-[32px] px-2 md:px-2.5 py-1 md:py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] md:text-[11px] lg:text-xs font-semibold animate-pulse border border-gray-300">
                  {game.externalStatus === '1H' ? '1/2' : '2/2'}
                </span>
              ) : null}
            </div>
          ) : (
            <span className={`inline-block px-2.5 md:px-2 py-1 md:py-1 text-[10px] md:text-[10px] lg:text-xs rounded-full transition-all duration-300 whitespace-nowrap ${
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
        {/* Mobile: Second line (LIVE games only): Chronometer */}
        {game.status === 'LIVE' && (
          <div className="flex items-center md:hidden gap-1.5">
            {game.externalStatus === 'HT' ? (
              <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-[10px] font-bold animate-pulse">
                MT
              </span>
            ) : game.elapsedMinute !== null && game.elapsedMinute !== undefined ? (
              <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold animate-pulse border border-gray-300">
                {game.elapsedMinute}'
                {/* Show max time indicator for rugby (80 min) vs football (90 min) */}
                {game.sportType === 'RUGBY' && game.elapsedMinute >= 80 && (
                  <span className="ml-0.5 text-[9px] opacity-75">/80</span>
                )}
                {game.sportType !== 'RUGBY' && game.elapsedMinute >= 90 && (
                  <span className="ml-0.5 text-[9px] opacity-75">/90</span>
                )}
              </span>
            ) : (game.externalStatus === '1H' || game.externalStatus === '2H') ? (
              // Fallback: show half indicator when chrono is not available
              <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] font-semibold animate-pulse border border-gray-300">
                {game.externalStatus === '1H' ? '1/2' : '2/2'}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {/* Teams & Score */}
      <div className="flex items-center w-full justify-between py-2 md:py-3 border-b border-neutral-200">
          {/* Home Team */}
        <div className="flex flex-col md:flex-row items-center min-w-0 w-2/5 justify-end pr-1 md:pr-2 gap-1 md:gap-0">
          {/* Mobile: Logo on top, name below */}
          <div className="md:hidden flex flex-col items-center w-full">
            {game.homeTeam.logo ? (
              <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 mb-1 flex-shrink-0">{game.homeTeam.name.substring(0,2)}</div>
            )}
            <div className="min-h-[32px] flex items-center justify-center w-full px-1">
              <span className="text-gray-900 font-medium text-[10px] text-center leading-tight line-clamp-2">{abbreviateTeamName(game.homeTeam)}</span>
            </div>
          </div>
          {/* Desktop: Name and logo side by side */}
          <div className="hidden md:flex items-center">
            <span className="text-gray-900 font-medium text-xs lg:text-sm text-right truncate max-w-[90px]">{game.homeTeam.name}</span>
            {game.homeTeam.logo ? (
              <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 rounded-full ml-2 object-cover border border-gray-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 ml-2 flex items-center justify-center text-xs text-gray-500">{game.homeTeam.name.substring(0,2)}</div>
            )}
          </div>
        </div>
        {/* Score */}
        <div className="flex-1 flex justify-center min-w-[50px] md:min-w-[60px]">
          <span className={`text-sm md:text-base lg:text-lg font-bold text-gray-900 transition-all duration-300 ${
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
        <div className="flex flex-col md:flex-row items-center min-w-0 w-2/5 justify-start pl-1 md:pl-2 gap-1 md:gap-0">
          {/* Mobile: Logo on top, name below */}
          <div className="md:hidden flex flex-col items-center w-full">
            {game.awayTeam.logo ? (
              <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 mb-1 flex-shrink-0">{game.awayTeam.name.substring(0,2)}</div>
            )}
            <div className="min-h-[32px] flex items-center justify-center w-full px-1">
              <span className="text-gray-900 font-medium text-[10px] text-center leading-tight line-clamp-2">{abbreviateTeamName(game.awayTeam)}</span>
            </div>
          </div>
          {/* Desktop: Logo and name side by side */}
          <div className="hidden md:flex items-center">
            {game.awayTeam.logo ? (
              <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 mr-2 flex items-center justify-center text-xs text-gray-500">{game.awayTeam.name.substring(0,2)}</div>
            )}
            <span className="text-gray-900 font-medium text-xs lg:text-sm text-left truncate max-w-[90px]">{game.awayTeam.name}</span>
          </div>
        </div>
      </div>
      {/* Bets List */}
      {game.bets && game.bets.length > 0 && (
        <div className="w-full pt-2 md:pt-3">
          <div className="text-[9px] md:text-[10px] lg:text-[11px] text-neutral-500 font-semibold mb-1 ml-1 tracking-wide uppercase">{t('placedBets')}</div>
          <ul className="divide-y divide-neutral-100">
            {game.bets.map((bet) => (
              <li key={bet.id} className="flex items-center py-0.5 md:py-1 first:pt-0 last:pb-0">
                <img
                  src={bet.user.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bet.user.name.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={bet.user.name}
                  className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-200 object-cover mr-1.5 md:mr-2"
                  title={bet.user.name}
                />
                <span className="text-[10px] md:text-xs text-gray-700 mr-1.5 md:mr-2 truncate max-w-[70px] md:max-w-[80px]">{bet.user.name}</span>
                {((game.status === 'LIVE' || game.status === 'FINISHED') && bet.score1 !== null && bet.score2 !== null) || 
                  (bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) ? (
                  (() => {
                    const highlight = getBetHighlight(bet);
                    // For LIVE games: colored text only with blinking animation
                    if (game.status === 'LIVE' && highlight) {
                      const textColor = highlight === 'gold' ? 'text-yellow-600' :
                                       highlight === 'green' ? 'text-green-600' :
                                       highlight === 'red' ? 'text-red-600' :
                                       'text-gray-700';
                      return (
                        <span className={`text-[10px] md:text-xs font-mono ${textColor} px-1.5 md:px-2 py-0.5 ml-auto font-bold animate-pulse`}>
                          {bet.score1} - {bet.score2}
                        </span>
                      );
                    } else if (game.status === 'FINISHED' && highlight) {
                      // For finished games: colored text with very light background
                      const textColor = highlight === 'gold' ? 'text-yellow-600' :
                                       highlight === 'green' ? 'text-green-600' :
                                       highlight === 'red' ? 'text-red-600' :
                                       'text-gray-700';
                      const bgColor = highlight === 'gold' ? 'bg-yellow-50' :
                                     highlight === 'green' ? 'bg-green-50' :
                                     highlight === 'red' ? 'bg-red-50' :
                                     'bg-gray-50';
                      return (
                        <span className={`text-[10px] md:text-xs font-mono ${textColor} ${bgColor} rounded px-1.5 md:px-2 py-0.5 ml-auto font-bold`}>
                          {bet.score1} - {bet.score2}
                        </span>
                      );
                    } else {
                      return (
                        <span className="text-[10px] md:text-xs font-mono text-gray-700 px-1.5 md:px-2 py-0.5 ml-auto font-bold">
                          {bet.score1} - {bet.score2}
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