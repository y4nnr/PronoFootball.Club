import { memo } from 'react';
import { useTranslation } from '../hooks/useTranslation';

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
  const isCurrentUser = currentUserId === player.userId;

  return (
    <div className={`flex items-center py-2 px-3 rounded-md transition-all ${
      isCurrentUser ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
    }`}>
      {/* Player Profile */}
      <div className="flex items-center space-x-2 min-w-0 w-32">
        <img
          src={player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.userName.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
          alt={player.userName}
          className="w-6 h-6 rounded-full border border-gray-200 object-cover flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h3 className={`text-xs font-semibold truncate ${
            isCurrentUser ? 'text-blue-700' : 'text-gray-900'
          }`}>
            {player.userName}
          </h3>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="flex space-x-1 flex-1 justify-start">
        {Array.from({ length: 10 }).map((_, index) => {
          const game = player.lastGamesPerformance[index];
          return game ? (
            <div
              key={game.gameId}
              className={`flex-1 min-w-0 h-8 rounded-md flex items-center justify-center text-gray-800 font-bold text-xs border ${
                game.result === 'no_bet' ? 'border-blue-300 bg-blue-100' :
                game.points === 3 ? 'border-yellow-400 bg-yellow-100' :
                game.points === 1 ? 'border-green-400 bg-green-100' :
                'border-red-400 bg-red-100'
              }`}
              title={game.result === 'no_bet' ? 
                `${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore} (No bet placed)` :
                `${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore} (predicted: ${game.predictedScore}) - ${game.points} points`
              }
            >
              {game.result === 'no_bet' ? '—' : game.points}
            </div>
          ) : (
            <div
              key={`empty-${index}`}
              className="flex-1 min-w-0 h-8 rounded-md flex items-center justify-center text-gray-400 font-bold text-xs border border-dashed border-gray-300 bg-white"
              title="No data"
            >
              ?
            </div>
          );
        })}
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

  if (playersPerformance.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 mb-8">
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-3">📊</div>
          <p className="text-gray-500">Aucune donnée de performance disponible</p>
        </div>
      </div>
    );
  }

  // Get the games from the first player (all players have the same games)
  const games = playersPerformance[0]?.lastGamesPerformance || [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 mb-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="p-1.5 bg-primary-600 rounded-full shadow mr-2 flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Performance des 10 Derniers Matchs</h2>
          </div>
        </div>
      </div>

      {/* Games Header */}
      <div className="mb-2">
        <div className="flex items-center py-2 px-3 bg-gray-50 rounded-md">
          {/* Player Profile Area - Empty space to match player row structure */}
          <div className="flex items-center space-x-2 min-w-0 w-32">
            {/* Empty space to match avatar + name area */}
          </div>
          {/* Performance columns header */}
          <div className="flex space-x-1 flex-1 justify-start">
            {Array.from({ length: 10 }).map((_, index) => {
              const game = games[index];
              return game ? (
                <div
                  key={game.gameId}
                  className="flex-1 min-w-0 h-10 rounded-md flex flex-col items-center justify-center text-gray-700 text-xs border border-gray-300 bg-white"
                  title={`${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore}`}
                >
                  <div className="flex items-center space-x-0.5 mb-0.5">
                    {game.homeTeamLogo && (
                      <img 
                        src={game.homeTeamLogo} 
                        alt={game.homeTeam}
                        className="w-3 h-3 object-contain"
                      />
                    )}
                    <span className="font-bold text-[9px]">{game.homeTeam.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center space-x-0.5">
                    {game.awayTeamLogo && (
                      <img 
                        src={game.awayTeamLogo} 
                        alt={game.awayTeam}
                        className="w-3 h-3 object-contain"
                      />
                    )}
                    <span className="font-bold text-[9px]">{game.awayTeam.substring(0, 2).toUpperCase()}</span>
                  </div>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  className="flex-1 min-w-0 h-10 rounded-md flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-300 bg-white"
                >
                  ?
                </div>
              );
            })}
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
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 border border-yellow-400 bg-yellow-100 rounded"></div>
            <span className="font-medium text-xs">Exact (3)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 border border-green-400 bg-green-100 rounded"></div>
            <span className="font-medium text-xs">Correct (1)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 border border-red-400 bg-red-100 rounded"></div>
            <span className="font-medium text-xs">Incorrect (0)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 border border-blue-300 bg-blue-100 rounded"></div>
            <span className="font-medium text-xs">No bet</span>
          </div>
        </div>
      </div>
    </div>
  );
});

PlayersPerformanceWidget.displayName = 'PlayersPerformanceWidget';

export default PlayersPerformanceWidget;
