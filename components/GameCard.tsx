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
  date: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  liveHomeScore?: number;
  liveAwayScore?: number;
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

  // Helper function to determine bet highlight for LIVE games
  const getBetHighlight = (bet: Bet) => {
    if (game.status !== 'LIVE') return null;
    if (bet.score1 === null || bet.score2 === null) return null;
    
    const liveHomeScore = game.liveHomeScore;
    const liveAwayScore = game.liveAwayScore;
    
    if (liveHomeScore === null || liveHomeScore === undefined || 
        liveAwayScore === null || liveAwayScore === undefined) {
      return null;
    }
    
    // Check for exact score match (gold)
    if (bet.score1 === liveHomeScore && bet.score2 === liveAwayScore) {
      return 'gold';
    }
    
    // Check for correct result (green)
    const betResult = bet.score1 > bet.score2 ? 'home' : bet.score1 < bet.score2 ? 'away' : 'draw';
    const liveResult = liveHomeScore > liveAwayScore ? 'home' : liveHomeScore < liveAwayScore ? 'away' : 'draw';
    
    if (betResult === liveResult) {
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
      {/* Date & Status */}
      <div className="flex items-center w-full justify-between pb-2 md:pb-3 border-b border-neutral-200">
        <span className="text-[9px] md:text-[10px] lg:text-xs text-neutral-500">
          {formatDateTime(game.date)}
        </span>
        <div className="flex items-center gap-1">
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
          <span className={`inline-block px-2.5 md:px-2 py-1 md:py-1 text-[10px] md:text-[10px] lg:text-xs rounded-full transition-all duration-300 whitespace-nowrap ${
            game.status === 'FINISHED' ? 'bg-green-100 text-green-800' :
            game.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
            game.status === 'LIVE' ? 'bg-red-100 text-red-800 animate-pulse' :
            'bg-gray-100 text-gray-800'
          } ${
            isHighlighted && (highlightType === 'status' || highlightType === 'both') ? 'animate-bounce scale-110' : ''
          }`}>
            {game.status === 'UPCOMING' && t('upcoming')}
            {game.status === 'FINISHED' && t('finished')}
            {game.status === 'LIVE' && t('live')}
            {game.status !== 'UPCOMING' && game.status !== 'FINISHED' && game.status !== 'LIVE' && game.status}
          </span>
        </div>
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
                    const bgColor = highlight === 'gold' ? 'bg-green-200 border-yellow-400 border-2' :
                                   highlight === 'green' ? 'bg-green-200 border-green-400 border-2' :
                                   highlight === 'red' ? 'bg-red-200 border-red-400 border-2' :
                                   'bg-gray-100';
                    const textColor = highlight === 'gold' ? 'text-green-900' :
                                    highlight === 'green' ? 'text-green-900' :
                                    highlight === 'red' ? 'text-red-900' :
                                    'text-gray-900';
                    const animateClass = highlight === 'gold' ? 'animate-pulse' : '';
                    return (
                      <span className={`text-[10px] md:text-xs font-mono ${textColor} ${bgColor} ${animateClass} rounded px-1.5 md:px-2 py-0.5 ml-auto font-bold`}>
                        {bet.score1} - {bet.score2}
                      </span>
                    );
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