import { memo, useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface PlayerPointsProgressionWidgetProps {
  competitionId: string;
  currentUserId?: string;
}

interface GameDay {
  date: string;
  points: number;
  cumulativePoints: number;
}

interface PlayerData {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  totalPoints: number;
  gameDays: GameDay[];
  rank: number;
}

// Light-mode palette cycled by chronological game-day index.
const GAME_DAY_COLORS = [
  { bg: '#BFDBFE', border: '#60A5FA' }, // blue
  { bg: '#BBF7D0', border: '#4ADE80' }, // green
  { bg: '#FEF08A', border: '#FACC15' }, // yellow
  { bg: '#FECACA', border: '#F87171' }, // red
  { bg: '#DDD6FE', border: '#A78BFA' }, // violet
  { bg: '#A5F3FC', border: '#22D3EE' }, // cyan
  { bg: '#D9F99D', border: '#84CC16' }, // lime
  { bg: '#FED7AA', border: '#FB923C' }, // orange
  { bg: '#FBCFE8', border: '#F472B6' }, // pink
  { bg: '#C7D2FE', border: '#818CF8' }, // indigo
  { bg: '#99F6E4', border: '#2DD4BF' }, // teal
  { bg: '#FECDD3', border: '#FB7185' }, // rose
  { bg: '#E9D5FF', border: '#C084FC' }, // purple
  { bg: '#BAE6FD', border: '#38BDF8' }, // sky
  { bg: '#BBF7D0', border: '#4ADE80' },
  { bg: '#FEF08A', border: '#FACC15' },
  { bg: '#FECACA', border: '#F87171' },
  { bg: '#DDD6FE', border: '#A78BFA' },
  { bg: '#A5F3FC', border: '#22D3EE' },
  { bg: '#D9F99D', border: '#84CC16' },
];

// Dark-mode palette cycled by the same index as light mode.
const DARK_GAME_DAY_COLORS = [
  { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4' }, // blue
  { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C' },  // green
  { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E' }, // orange
  { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728' },  // red
  { bg: 'rgba(148, 103, 189, 0.6)', border: '#9467BD' },// purple
  { bg: 'rgba(140, 86, 75, 0.6)', border: '#8C564B' },  // brown
  { bg: 'rgba(188, 189, 34, 0.6)', border: '#BCBD22' }, // yellow-green
  { bg: 'rgba(23, 190, 207, 0.6)', border: '#17BECF' }, // teal
  { bg: 'rgba(127, 127, 127, 0.6)', border: '#7F7F7F' },// gray
  { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4' },
  { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C' },
  { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E' },
  { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728' },
  { bg: 'rgba(148, 103, 189, 0.6)', border: '#9467BD' },
];

const WIDGET_TITLE = 'Progression des Points par Journée';

const HEADER_ICON = (
  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

function transformRankingData(rankingData: any[]): PlayerData[] {
  if (rankingData.length === 0) return [];

  const allPlayers = new Map<string, { userName: string; profilePictureUrl: string | null }>();
  rankingData.forEach((dataPoint: any) => {
    dataPoint.rankings.forEach((ranking: any) => {
      if (!allPlayers.has(ranking.userId)) {
        allPlayers.set(ranking.userId, {
          userName: ranking.userName,
          profilePictureUrl: ranking.profilePictureUrl,
        });
      }
    });
  });

  const progressions: PlayerData[] = [];

  allPlayers.forEach((playerInfo, userId) => {
    const gameDays: GameDay[] = [];
    let previousPoints = 0;
    let latestTotal = 0;

    rankingData.forEach((dataPoint: any) => {
      const playerRanking = dataPoint.rankings.find((r: any) => r.userId === userId);
      if (!playerRanking) return;
      const dayPoints = playerRanking.totalPoints - previousPoints;
      if (dayPoints > 0) {
        gameDays.push({
          date: dataPoint.date,
          points: dayPoints,
          cumulativePoints: playerRanking.totalPoints,
        });
      }
      previousPoints = playerRanking.totalPoints;
      latestTotal = playerRanking.totalPoints;
    });

    // Include every participant, even those with 0 total points, so the widget
    // matches Classement / Hôte du Dîner which list all participants.
    progressions.push({
      userId,
      userName: playerInfo.userName,
      profilePictureUrl: playerInfo.profilePictureUrl,
      totalPoints: latestTotal,
      gameDays,
      rank: 0,
    });
  });

  progressions.sort(
    (a, b) => b.totalPoints - a.totalPoints || a.userName.localeCompare(b.userName)
  );
  progressions.forEach((player, index) => { player.rank = index + 1; });

  return progressions;
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-4 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
    <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
      <div className="flex items-center">
        <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
          {HEADER_ICON}
        </div>
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">{WIDGET_TITLE}</h2>
      </div>
    </div>
    {children}
  </div>
);

const PlayerPointsProgressionWidget = memo(({ competitionId }: PlayerPointsProgressionWidgetProps) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [playerData, setPlayerData] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchProgression = async (initial: boolean) => {
      try {
        if (initial) setLoading(true);
        const response = await fetch(`/api/competitions/${competitionId}/ranking-evolution`);
        if (!response.ok) throw new Error('Failed to fetch ranking evolution');
        const data = await response.json();
        if (cancelled) return;
        setPlayerData(transformRankingData(data.rankingEvolution || []));
        if (initial) setError(null);
      } catch (err) {
        console.error('Error fetching player progression:', err);
        if (initial && !cancelled) setError('Failed to load player progression');
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };

    fetchProgression(true);
    const interval = setInterval(() => fetchProgression(false), 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [competitionId]);

  // Max total points drives each player's bar width; the 90% cap leaves room for the score badge at right.
  const maxTotalPoints = Math.max(...playerData.map(p => p.totalPoints), 1);
  const availableBarWidth = 90;

  // Assign a stable color index per unique game-day date in chronological order.
  const uniqueDates = new Set<string>();
  playerData.forEach(player => {
    player.gameDays.forEach(gameDay => {
      if (gameDay.points > 0) uniqueDates.add(gameDay.date);
    });
  });
  const sortedDates = Array.from(uniqueDates).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const dateColorIndex = new Map<string, number>();
  sortedDates.forEach((date, index) => dateColorIndex.set(date, index));

  const getGameDayColor = (date: string) => {
    const index = dateColorIndex.get(date) ?? 0;
    return isDarkMode
      ? DARK_GAME_DAY_COLORS[index % DARK_GAME_DAY_COLORS.length]
      : GAME_DAY_COLORS[index % GAME_DAY_COLORS.length];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  if (loading) {
    return (
      <Frame>
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-gray-200 dark:bg-[rgb(50,50,50)] rounded-full"></div>
                <div className="h-6 bg-gray-200 dark:bg-[rgb(50,50,50)] rounded flex-1"></div>
                <div className="w-12 h-6 bg-gray-200 dark:bg-[rgb(50,50,50)] rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame>
        <div className="p-4 text-center py-8">
          <div className="text-red-500 text-4xl mb-3">⚠️</div>
          <p className="text-red-500 mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="text-primary-600 dark:text-accent-dark-500 text-sm hover:underline">
            Retry
          </button>
        </div>
      </Frame>
    );
  }

  const everyoneAtZero = playerData.length === 0 || playerData.every(p => p.totalPoints === 0);
  if (everyoneAtZero) {
    return (
      <Frame>
        <div className="p-4 text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400">Aucun point attribué pour l&apos;instant.</p>
        </div>
      </Frame>
    );
  }

  // When a date is selected, reorder rows by cumulative points up to that date.
  // Stable secondary sort by userName so ties are deterministic.
  const displayPlayers = selectedDate
    ? playerData
        .map(player => {
          const gameDay = player.gameDays.find(gd => gd.date === selectedDate);
          let dayCumulative = 0;
          if (gameDay) {
            dayCumulative = gameDay.cumulativePoints;
          } else {
            const previous = player.gameDays.filter(gd => gd.date < selectedDate);
            if (previous.length > 0) dayCumulative = previous[previous.length - 1].cumulativePoints;
          }
          return { ...player, dayCumulative };
        })
        .sort((a, b) => b.dayCumulative - a.dayCumulative || a.userName.localeCompare(b.userName))
    : playerData.map(p => ({ ...p, dayCumulative: p.totalPoints }));

  return (
    <div
      className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-8 w-full relative overflow-hidden"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('[data-slice]')) {
          setSelectedDate(null);
        }
      }}
    >
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <div className="flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            {HEADER_ICON}
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
            {WIDGET_TITLE}{selectedDate ? (
              <span
                className="ml-2 px-2 py-1 rounded text-gray-800 dark:text-gray-200 text-lg font-semibold"
                style={{
                  backgroundColor: getGameDayColor(selectedDate).bg,
                  borderColor: getGameDayColor(selectedDate).border,
                }}
              >
                {formatDate(selectedDate)}
              </span>
            ) : ''}
          </h2>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-2" ref={containerRef}>
          {displayPlayers.map((player, index) => {
            const barWidthPct = (player.totalPoints / maxTotalPoints) * availableBarWidth;
            const gameDaysWithPoints = player.gameDays.filter(gd => gd.points > 0);
            const isSingleSegment = gameDaysWithPoints.length === 1;

            return (
              <div
                key={player.userId}
                className={`flex items-center space-x-4 transition-all duration-200 border-b border-gray-300 pb-2 ${index === 0 ? 'border-t border-gray-300 pt-2' : 'pt-0.5'} ${index === displayPlayers.length - 1 ? 'border-b border-gray-300' : ''}`}
              >
                <div className="flex items-center space-x-3 w-36 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[rgb(40,40,40)] flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                    {selectedDate ? index + 1 : player.rank}
                  </div>
                  <img
                    src={player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.userName.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                    alt={player.userName}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-transparent"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                    {player.userName}
                  </span>
                </div>

                <div className="flex-1 relative">
                  <div
                    className="h-10 bg-gray-100 dark:bg-[rgb(40,40,40)] rounded-lg overflow-hidden flex shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                    style={{ width: `${barWidthPct}%` }}
                  >
                    {gameDaysWithPoints.map(gameDay => {
                      const width = isSingleSegment ? 100 : (gameDay.points / player.totalPoints) * 100;
                      const colorObj = getGameDayColor(gameDay.date);
                      return (
                        <div
                          key={gameDay.date}
                          className={`relative h-full cursor-pointer transition-all duration-200 overflow-hidden ${
                            selectedDate === gameDay.date ? 'ring-2 ring-lime-500 ring-opacity-70 shadow-lg transform scale-105' : ''
                          }`}
                          style={{
                            width: `${width}%`,
                            opacity: selectedDate !== null && selectedDate !== gameDay.date ? 0.2 : 1,
                            backgroundColor: colorObj.bg,
                            border: isDarkMode ? 'none' : `1px solid ${colorObj.border}`,
                            borderRight: isDarkMode ? 'none' : '1px solid rgba(255, 255, 255, 0.25)',
                          }}
                          data-slice
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(selectedDate === gameDay.date ? null : gameDay.date);
                          }}
                        >
                          <div className={`h-full flex items-center justify-center py-1 relative ${width < 15 ? 'px-0.5' : 'px-2'}`}>
                            {gameDay.points > 1 && (
                              <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: gameDay.points - 1 }, (_, i) => (
                                  <div
                                    key={i}
                                    className={`absolute w-px top-0 bottom-0 ${isDarkMode ? 'bg-white/10' : 'bg-white/30'}`}
                                    style={{ left: `${((i + 1) / gameDay.points) * 100}%` }}
                                  />
                                ))}
                              </div>
                            )}
                            <div className={`text-xs font-bold relative z-10 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                              {gameDay.points}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-2">
                    <div className="bg-gray-100 dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {player.dayCumulative}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-4 pt-3 pb-4">
        <div className="text-center text-xs text-gray-600 dark:text-gray-400">
          <p>Cliquez sur une journée pour afficher le classement intermédiaire</p>
        </div>
      </div>
    </div>
  );
});

PlayerPointsProgressionWidget.displayName = 'PlayerPointsProgressionWidget';

export default PlayerPointsProgressionWidget;
