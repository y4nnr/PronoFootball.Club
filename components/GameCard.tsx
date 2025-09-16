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
}

interface Game {
  status: string;
  date: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  bets: Bet[];
}

interface GameCardProps {
  game: Game;
  currentUserId?: string;
  href?: string;
  context?: 'home' | 'competition';
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

export default function GameCard({ game, currentUserId, href, context = 'home' }: GameCardProps) {
  const { t } = useTranslation();
  const isOpen = game.status === 'UPCOMING';
  const isClickable = game.status === 'UPCOMING'; // Only UPCOMING games are clickable
  
  // Check if user has placed a bet on this game
  const userHasBet = currentUserId ? game.bets.some(bet => bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) : false;
  
  // Get user's bet points for competition context
  const userBet = currentUserId ? game.bets.find(bet => bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) : null;
  const userPoints = userBet?.points;
  
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
    <div className={`${getBackgroundColor()} border rounded-2xl shadow flex flex-col items-stretch transition p-5 gap-3 ${getBorderColor()} ${isClickable ? 'hover:shadow-lg hover:border-primary-400 cursor-pointer' : 'cursor-default'}`}>
      {/* Date & Status */}
      <div className="flex items-center w-full justify-between pb-3 border-b border-neutral-200">
        <span className="text-xs text-neutral-500">
          {formatDateTime(game.date)}
        </span>
        <div className="flex items-center gap-2">
          {userHasBet && (
            <div className="flex items-center gap-1">
              {context === 'home' ? (
                <div className="flex items-center justify-center w-5 h-5 bg-blue-100 rounded-full">
                  <span className="text-blue-600 text-xs font-bold">✓</span>
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
          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
            game.status === 'FINISHED' ? 'bg-green-100 text-green-800' :
            game.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {game.status === 'UPCOMING' && t('upcoming')}
            {game.status === 'FINISHED' && t('finished')}
            {game.status === 'LIVE' && t('live')}
            {game.status !== 'UPCOMING' && game.status !== 'FINISHED' && game.status !== 'LIVE' && game.status}
          </span>
        </div>
      </div>
      {/* Teams & Score */}
      <div className="flex items-center w-full justify-between py-3 border-b border-neutral-200">
        {/* Home Team */}
        <div className="flex items-center min-w-0 w-2/5 justify-end pr-2">
          <span className="text-gray-900 font-medium text-sm text-right truncate max-w-[90px]">{game.homeTeam.name}</span>
          {game.homeTeam.logo ? (
            <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 rounded-full ml-2 object-cover border border-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 ml-2 flex items-center justify-center text-xs text-gray-500">{game.homeTeam.name.substring(0,2)}</div>
          )}
        </div>
        {/* Score */}
        <div className="flex-1 flex justify-center">
          <span className="text-lg font-bold text-gray-900">
            {game.status === 'FINISHED' && typeof game.homeScore === 'number' && typeof game.awayScore === 'number'
              ? `${game.homeScore} - ${game.awayScore}`
              : '-'}
          </span>
        </div>
        {/* Away Team */}
        <div className="flex items-center min-w-0 w-2/5 pl-2">
          {game.awayTeam.logo ? (
            <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 mr-2 flex items-center justify-center text-xs text-gray-500">{game.awayTeam.name.substring(0,2)}</div>
          )}
          <span className="text-gray-900 font-medium text-sm text-left truncate max-w-[90px]">{game.awayTeam.name}</span>
        </div>
      </div>
      {/* Bets List */}
      {game.bets && game.bets.length > 0 && (
        <div className="w-full pt-3">
          <div className="text-[11px] text-neutral-500 font-semibold mb-1 ml-1 tracking-wide uppercase">{t('placedBets')}</div>
          <ul className="divide-y divide-neutral-100">
            {game.bets.map((bet) => (
              <li key={bet.id} className="flex items-center py-1 first:pt-0 last:pb-0">
                <img
                  src={bet.user.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bet.user.name.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={bet.user.name}
                  className="w-6 h-6 rounded-full border border-gray-200 object-cover mr-2"
                  title={bet.user.name}
                />
                <span className="text-xs text-gray-700 mr-2 truncate max-w-[80px]">{bet.user.name}</span>
                {((game.status === 'LIVE' || game.status === 'FINISHED') && bet.score1 !== null && bet.score2 !== null) || 
                  (bet.userId === currentUserId && bet.score1 !== null && bet.score2 !== null) ? (
                  <span className="text-xs font-mono text-gray-900 bg-gray-100 rounded px-2 py-0.5 ml-auto">{bet.score1} - {bet.score2}</span>
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