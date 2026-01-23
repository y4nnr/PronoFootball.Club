import { memo } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface PlayerLastGamePerformance {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  actualScore: string;
  predictedScore: string;
  points: number | null;
  result: 'exact' | 'correct' | 'wrong' | 'no_bet';
}

interface PlayerPerformance {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  lastGamesPerformance: PlayerLastGamePerformance[];
}

interface PlayersPerformanceWidgetProps {
  playersPerformance: PlayerPerformance[];
  competitionName: string;
  totalGames: number;
  currentUserId?: string;
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

const PlayerPerformanceRow = memo(({ 
  player, 
  currentUserId 
}: { 
  player: PlayerPerformance; 
  currentUserId?: string; 
}) => {
  const { t } = useTranslation('dashboard');
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const isCurrentUser = currentUserId === player.userId;

  // Get dark mode color for performance cards - same style as Progression des Points par Journée
  const getPerformanceCardColor = (result: string, points: number | null) => {
    if (isDarkMode) {
      if (result === 'no_bet') {
        return { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4', text: 'text-gray-200' }; // blue
      } else if (points === 3) {
        return { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E', text: 'text-gray-200' }; // orange (for exact/3 points)
      } else if (points === 1) {
        return { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C', text: 'text-gray-200' }; // green
      } else {
        return { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728', text: 'text-gray-200' }; // red
      }
    }
    // Light mode - return null to use className
    return null;
  };

  // Calculate total points from last 10 games
  const totalPoints = player.lastGamesPerformance.reduce((sum, game) => {
    return sum + (game.points || 0);
  }, 0);

  return (
    <div className={`flex items-center py-2 px-3 rounded-md transition-all ${
      isCurrentUser ? 'bg-blue-50 ring-1 ring-blue-200 dark:!bg-gray-700 dark:ring-1 dark:ring-accent-dark-500/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}>
      {/* Player Profile */}
      <div className="flex items-center space-x-2 min-w-0 w-32">
        <img
          src={player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.userName.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
          alt={player.userName}
          className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 object-cover flex-shrink-0 dark:bg-white dark:p-0.5"
        />
        <div className="min-w-0 flex-1">
          <h3 className={`text-xs font-semibold truncate ${
            isCurrentUser ? 'text-blue-700 dark:text-accent-dark-400' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {player.userName}
          </h3>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="flex space-x-1 flex-1 justify-start">
        {Array.from({ length: 10 }).map((_, index) => {
          const game = player.lastGamesPerformance[index];
          return game ? (() => {
            const darkColor = getPerformanceCardColor(game.result, game.points);
            return (
              <div
                key={game.gameId}
                className={`flex-1 min-w-0 h-8 rounded-md flex items-center justify-center font-bold text-xs border ${
                  darkColor 
                    ? `${darkColor.text} border-transparent`
                    : game.result === 'no_bet' ? 'border-blue-300 bg-blue-100 text-gray-800' :
                      game.points === 3 ? 'border-yellow-400 bg-yellow-100 text-gray-800' :
                      game.points === 1 ? 'border-green-400 bg-green-100 text-gray-800' :
                      'border-red-400 bg-red-100 text-gray-800'
                }`}
                style={darkColor ? {
                  backgroundColor: darkColor.bg,
                  borderColor: darkColor.border
                } : undefined}
                title={game.result === 'no_bet' ? 
                  `${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore} (No bet placed)` :
                  `${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore} (predicted: ${game.predictedScore}) - ${game.points} points`
                }
              >
                {game.result === 'no_bet' ? '—' : game.points}
              </div>
            );
          })() : (
            <div
              key={`empty-${index}`}
              className="flex-1 min-w-0 h-8 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-400 font-bold text-xs border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              title="No data"
            >
              ?
            </div>
          );
        })}
      </div>

      {/* Total Points */}
      <div className="ml-3 w-16 flex-shrink-0">
        <div className={`h-8 rounded-md flex items-center justify-center text-gray-800 dark:text-gray-200 font-bold text-sm border ${
          isCurrentUser ? 'border-blue-300 dark:border-blue-300 bg-blue-100 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800'
        }`}>
          {totalPoints}
        </div>
      </div>
    </div>
  );
});

PlayerPerformanceRow.displayName = 'PlayerPerformanceRow';

const PlayersPerformanceWidget = memo(({ 
  playersPerformance, 
  competitionName, 
  totalGames, 
  currentUserId 
}: PlayersPerformanceWidgetProps) => {
  const { t } = useTranslation('dashboard');
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  if (playersPerformance.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400">Aucune donnée de performance disponible</p>
        </div>
      </div>
    );
  }

  // Get the games from the first player (all players have the same games)
  const games = playersPerformance[0]?.lastGamesPerformance || [];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl dark:shadow-dark-xl p-3 mb-8 w-full" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow mr-3 flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Performance des 10 Derniers Matchs</h2>
          </div>
        </div>
      </div>

      {/* Games Header - Hidden on smaller screens when it doesn't fit */}
      <div className="mb-2 hidden xl:block">
        <div className="flex items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-md">
          {/* Player Profile Area - Empty space to match player row structure */}
          <div className="flex items-center space-x-2 min-w-0 w-32">
            {/* Empty space to match avatar + name area */}
          </div>
          {/* Performance columns header */}
          <div className="flex space-x-1 flex-1 justify-start min-w-0">
            {Array.from({ length: 10 }).map((_, index) => {
              const game = games[index];
              return game ? (
                <div
                  key={game.gameId}
                  className="flex-1 min-w-0 h-16 rounded-md flex flex-col items-center justify-center text-gray-700 dark:text-gray-200 text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-0.5 py-1"
                  title={`${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore}`}
                  style={{ minWidth: '0', maxWidth: '100%' }}
                >
                  {/* Home Team */}
                  <div className="flex items-center space-x-0.5 mb-0.5 w-full justify-center min-w-0">
                    {game.homeTeamLogo && (
                      <img 
                        src={game.homeTeamLogo} 
                        alt={game.homeTeam}
                        className="w-3 h-3 xl:w-4 xl:h-4 object-contain flex-shrink-0"
                      />
                    )}
                    <span className="font-bold text-[9px] xl:text-[10px] leading-tight truncate max-w-full dark:text-gray-200">
                      {game.homeTeam.length > 6 ? game.homeTeam.substring(0, 5) + '...' : game.homeTeam}
                    </span>
                  </div>
                  {/* Score */}
                  <div className="text-[9px] xl:text-[10px] text-gray-700 dark:text-gray-200 font-bold mb-0.5">
                    {game.actualScore}
                  </div>
                  {/* Away Team */}
                  <div className="flex items-center space-x-0.5 w-full justify-center min-w-0">
                    {game.awayTeamLogo && (
                      <img 
                        src={game.awayTeamLogo} 
                        alt={game.awayTeam}
                        className="w-3 h-3 xl:w-4 xl:h-4 object-contain flex-shrink-0 dark:bg-white dark:p-0.5 dark:rounded"
                      />
                    )}
                    <span className="font-bold text-[9px] xl:text-[10px] leading-tight truncate max-w-full dark:text-gray-200">
                      {game.awayTeam.length > 6 ? game.awayTeam.substring(0, 5) + '...' : game.awayTeam}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  className="flex-1 min-w-0 h-16 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                >
                  ?
                </div>
              );
            })}
          </div>
          {/* Total Points Header */}
          <div className="ml-3 w-16 flex-shrink-0">
            <div className="h-16 rounded-md flex items-center justify-center text-gray-700 dark:text-gray-200 text-xs font-semibold border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
              Total
            </div>
          </div>
        </div>
      </div>

      {/* Players Performance Rows */}
      <div className="space-y-0">
        {playersPerformance.map((player) => (
          <PlayerPerformanceRow
            key={player.userId}
            player={player}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <div 
              className={`w-2 h-2 rounded ${isDarkMode ? 'border-transparent' : 'border border-yellow-400 bg-yellow-100'}`}
              style={isDarkMode ? {
                backgroundColor: 'rgba(255, 127, 14, 0.6)',
                borderColor: '#FF7F0E'
              } : undefined}
            ></div>
            <span className="font-medium text-xs dark:text-gray-300">Exact (3)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div 
              className={`w-2 h-2 rounded ${isDarkMode ? 'border-transparent' : 'border border-green-400 bg-green-100'}`}
              style={isDarkMode ? {
                backgroundColor: 'rgba(44, 160, 44, 0.6)',
                borderColor: '#2CA02C'
              } : undefined}
            ></div>
            <span className="font-medium text-xs dark:text-gray-300">Correct (1)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div 
              className={`w-2 h-2 rounded ${isDarkMode ? 'border-transparent' : 'border border-red-400 bg-red-100'}`}
              style={isDarkMode ? {
                backgroundColor: 'rgba(214, 39, 40, 0.6)',
                borderColor: '#D62728'
              } : undefined}
            ></div>
            <span className="font-medium text-xs dark:text-gray-300">Incorrect (0)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div 
              className={`w-2 h-2 rounded ${isDarkMode ? 'border-transparent' : 'border border-blue-300 bg-blue-100'}`}
              style={isDarkMode ? {
                backgroundColor: 'rgba(31, 119, 180, 0.6)',
                borderColor: '#1F77B4'
              } : undefined}
            ></div>
            <span className="font-medium text-xs dark:text-gray-300">No bet</span>
          </div>
        </div>
      </div>
    </div>
  );
});

PlayersPerformanceWidget.displayName = 'PlayersPerformanceWidget';

export default PlayersPerformanceWidget;
