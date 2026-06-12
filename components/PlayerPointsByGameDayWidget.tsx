import { memo, useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface PlayerPointsByGameDayWidgetProps {
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
  gameDays: GameDay[];           // points > 0 only — used by progression view
  daily: Map<string, number>;    // every date — used by candle view (0 included)
  rank: number;
}

const GAME_DAY_COLORS = [
  { bg: '#BFDBFE', border: '#60A5FA' },
  { bg: '#BBF7D0', border: '#4ADE80' },
  { bg: '#FEF08A', border: '#FACC15' },
  { bg: '#FECACA', border: '#F87171' },
  { bg: '#DDD6FE', border: '#A78BFA' },
  { bg: '#A5F3FC', border: '#22D3EE' },
  { bg: '#D9F99D', border: '#84CC16' },
  { bg: '#FED7AA', border: '#FB923C' },
  { bg: '#FBCFE8', border: '#F472B6' },
  { bg: '#C7D2FE', border: '#818CF8' },
  { bg: '#99F6E4', border: '#2DD4BF' },
  { bg: '#FECDD3', border: '#FB7185' },
  { bg: '#E9D5FF', border: '#C084FC' },
  { bg: '#BAE6FD', border: '#38BDF8' },
  { bg: '#BBF7D0', border: '#4ADE80' },
  { bg: '#FEF08A', border: '#FACC15' },
  { bg: '#FECACA', border: '#F87171' },
  { bg: '#DDD6FE', border: '#A78BFA' },
  { bg: '#A5F3FC', border: '#22D3EE' },
  { bg: '#D9F99D', border: '#84CC16' },
];

const DARK_GAME_DAY_COLORS = [
  { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4' },
  { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C' },
  { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E' },
  { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728' },
  { bg: 'rgba(148, 103, 189, 0.6)', border: '#9467BD' },
  { bg: 'rgba(140, 86, 75, 0.6)', border: '#8C564B' },
  { bg: 'rgba(188, 189, 34, 0.6)', border: '#BCBD22' },
  { bg: 'rgba(23, 190, 207, 0.6)', border: '#17BECF' },
  { bg: 'rgba(127, 127, 127, 0.6)', border: '#7F7F7F' },
  { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4' },
  { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C' },
  { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E' },
  { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728' },
  { bg: 'rgba(148, 103, 189, 0.6)', border: '#9467BD' },
];

const WIDGET_TITLE = 'Points par Journée';

const HEADER_ICON = (
  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

function transformRankingData(rankingData: any[]): {
  players: PlayerData[];
  dates: string[];
  maxDayPoints: number;
} {
  if (rankingData.length === 0) return { players: [], dates: [], maxDayPoints: 0 };

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

  const dates: string[] = rankingData.map((d: any) => d.date);
  const players: PlayerData[] = [];
  let maxDayPoints = 0;

  allPlayers.forEach((info, userId) => {
    const gameDays: GameDay[] = [];
    const daily = new Map<string, number>();
    let previous = 0;
    let total = 0;

    rankingData.forEach((dataPoint: any) => {
      const r = dataPoint.rankings.find((x: any) => x.userId === userId);
      if (!r) return;
      const dayPoints = r.totalPoints - previous;
      daily.set(dataPoint.date, dayPoints);
      if (dayPoints > maxDayPoints) maxDayPoints = dayPoints;
      if (dayPoints > 0) {
        gameDays.push({
          date: dataPoint.date,
          points: dayPoints,
          cumulativePoints: r.totalPoints,
        });
      }
      previous = r.totalPoints;
      total = r.totalPoints;
    });

    players.push({
      userId,
      userName: info.userName,
      profilePictureUrl: info.profilePictureUrl,
      totalPoints: total,
      gameDays,
      daily,
      rank: 0,
    });
  });

  players.sort((a, b) => b.totalPoints - a.totalPoints || a.userName.localeCompare(b.userName));
  players.forEach((p, i) => { p.rank = i + 1; });

  return { players, dates, maxDayPoints };
}

const PlayerPointsByGameDayWidget = memo(({ competitionId }: PlayerPointsByGameDayWidgetProps) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [maxDayPoints, setMaxDayPoints] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'progression' | 'candles'>('candles');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async (initial: boolean) => {
      try {
        if (initial) setLoading(true);
        const response = await fetch(`/api/competitions/${competitionId}/ranking-evolution`);
        if (!response.ok) throw new Error('Failed to fetch ranking evolution');
        const data = await response.json();
        if (cancelled) return;
        const t = transformRankingData(data.rankingEvolution || []);
        setPlayers(t.players);
        setDates(t.dates);
        setMaxDayPoints(Math.max(t.maxDayPoints, 1));
        if (initial) setError(null);
      } catch (err) {
        console.error('Error fetching points by game day:', err);
        if (initial && !cancelled) setError('Failed to load points by game day');
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };

    fetchData(true);
    const interval = setInterval(() => fetchData(false), 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [competitionId]);

  const dateColorIndex = new Map<string, number>();
  dates.forEach((d, i) => dateColorIndex.set(d, i));

  const getColor = (date: string) => {
    const idx = dateColorIndex.get(date) ?? 0;
    return isDarkMode
      ? DARK_GAME_DAY_COLORS[idx % DARK_GAME_DAY_COLORS.length]
      : GAME_DAY_COLORS[idx % GAME_DAY_COLORS.length];
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const Header = (
    <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            {HEADER_ICON}
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
            {WIDGET_TITLE}
            {view === 'progression' && selectedDate && (
              <span
                className="ml-2 px-2 py-1 rounded text-gray-800 dark:text-gray-200 text-lg font-semibold"
                style={{
                  backgroundColor: getColor(selectedDate).bg,
                  borderColor: getColor(selectedDate).border,
                }}
              >
                {formatDate(selectedDate)}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center bg-gray-200 dark:bg-[rgb(50,50,50)] rounded-lg p-1">
          <button
            onClick={() => { setView('candles'); setSelectedDate(null); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              view === 'candles'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Chandelles
          </button>
          <button
            onClick={() => { setView('progression'); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              view === 'progression'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Progression
          </button>
        </div>
      </div>
    </div>
  );

  const Footer = (
    <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-4 pt-3 pb-4">
      <div className="text-center text-xs text-gray-600 dark:text-gray-400">
        {view === 'progression' ? (
          <p>Cliquez sur une journée pour afficher le classement intermédiaire</p>
        ) : (
          <p>Points marqués par chaque joueur sur chaque journée.</p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-8 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        {Header}
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-8 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        {Header}
        <div className="p-4 text-center py-8">
          <div className="text-red-500 text-4xl mb-3">⚠️</div>
          <p className="text-red-500 mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="text-primary-600 dark:text-accent-dark-500 text-sm hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const everyoneAtZero = players.length === 0 || players.every(p => p.totalPoints === 0);
  if (everyoneAtZero) {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-8 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        {Header}
        <div className="p-4 text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400">Aucun point attribué pour l&apos;instant.</p>
        </div>
      </div>
    );
  }

  // ---------- Progression view body ----------
  const maxTotalPoints = Math.max(...players.map(p => p.totalPoints), 1);
  // Cap the leader's bar at ~9% per completed game day (rounded up to 90 % once we have 10+ days).
  // Without this cap, a single completed day stretches the leader's bar to fill the whole row,
  // making one or two colored segments look disproportionately huge.
  const MAX_BAR_WIDTH_PER_DATE = 9;
  const FULL_BAR_WIDTH = 90;
  const availableBarWidth = Math.min(FULL_BAR_WIDTH, Math.max(MAX_BAR_WIDTH_PER_DATE, dates.length * MAX_BAR_WIDTH_PER_DATE));

  const progressionPlayers = selectedDate
    ? players
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
    : players.map(p => ({ ...p, dayCumulative: p.totalPoints }));

  const ProgressionBody = (
    <div className="p-4">
      <div className="space-y-2" ref={containerRef}>
        {progressionPlayers.map((player, index) => {
          const barWidthPct = (player.totalPoints / maxTotalPoints) * availableBarWidth;
          const gameDaysWithPoints = player.gameDays.filter(gd => gd.points > 0);
          const isSingleSegment = gameDaysWithPoints.length === 1;

          return (
            <div
              key={player.userId}
              className={`flex items-center space-x-4 transition-all duration-200 border-b border-gray-300 pb-2 ${index === 0 ? 'border-t border-gray-300 pt-2' : 'pt-0.5'} ${index === progressionPlayers.length - 1 ? 'border-b border-gray-300' : ''}`}
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
                    const colorObj = getColor(gameDay.date);
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
  );

  // ---------- Candles view body ----------
  const trackHeight = 90;
  const minColumnWidth = 16;
  // Cap each candle's column so 1-2 completed days don't stretch into wide bars filling the whole row.
  const maxColumnWidth = 40;
  const candleTrackMaxWidth = dates.length * maxColumnWidth;

  const CandlesBody = (
    <div className="p-4 overflow-x-auto">
      <div className="space-y-1">
        {players.map((player, idx) => (
          <div
            key={player.userId}
            className={`flex items-end space-x-4 border-b border-gray-300 dark:border-gray-600 pb-2 ${idx === 0 ? 'border-t border-gray-300 dark:border-gray-600 pt-2' : 'pt-1'}`}
          >
            <div className="flex items-center space-x-3 w-32 flex-shrink-0 pb-1">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[rgb(40,40,40)] flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                {player.rank}
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

            <div
              className="flex-1 flex items-end"
              style={{ height: trackHeight, minWidth: dates.length * minColumnWidth, maxWidth: candleTrackMaxWidth }}
            >
              {dates.map(date => {
                const points = player.daily.get(date) || 0;
                // Cap candle height to 80% of the track — reserves room for the points label above
                const heightPct = (points / maxDayPoints) * 80;
                const color = getColor(date);
                const key = `${player.userId}|${date}`;
                const isHovered = hoveredKey === key;
                return (
                  <div
                    key={date}
                    className="flex-1 h-full relative flex justify-center"
                    style={{ minWidth: minColumnWidth, maxWidth: maxColumnWidth }}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    {points > 0 ? (
                      <>
                        <div
                          className="absolute bottom-0 rounded-t transition-all duration-200"
                          style={{
                            height: `${heightPct}%`,
                            left: '15%',
                            right: '15%',
                            backgroundColor: color.bg,
                            border: isDarkMode ? 'none' : `1px solid ${color.border}`,
                            boxShadow: isHovered ? '0 4px 8px rgba(0,0,0,0.25)' : undefined,
                            transform: isHovered ? 'translateY(-2px)' : undefined,
                            zIndex: isHovered ? 10 : 1,
                          }}
                        />
                        <div
                          className={`absolute text-[10px] font-bold leading-none pointer-events-none ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}
                          style={{ bottom: `calc(${heightPct}% + 2px)` }}
                        >
                          {points}
                        </div>
                      </>
                    ) : (
                      <div
                        className="absolute rounded-full transition-all duration-200"
                        style={{
                          width: '7px',
                          height: '7px',
                          bottom: '2px',
                          left: '50%',
                          transform: isHovered ? 'translate(-50%, -2px)' : 'translate(-50%, 0)',
                          backgroundColor: 'transparent',
                          border: `1.5px solid ${isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)'}`,
                          boxShadow: isHovered ? '0 0 6px rgba(0,0,0,0.35)' : undefined,
                          zIndex: isHovered ? 10 : 1,
                        }}
                      />
                    )}
                    {isHovered && (
                      <div
                        className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none"
                      >
                        {formatDate(date)} · {points} pt{points > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex-shrink-0 pb-1 transform translate-x-2 w-20 flex justify-end">
              <div className="bg-gray-100 dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 shadow-sm inline-block">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{player.totalPoints}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Date axis: stacked day on top, month below — same layout as Évolution du Classement */}
      <div className="flex items-start space-x-4 pt-2">
        <div className="w-32 flex-shrink-0" />
        <div className="flex-1 flex" style={{ minWidth: dates.length * minColumnWidth, maxWidth: candleTrackMaxWidth }}>
          {dates.map(date => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return (
              <div
                key={date}
                className="flex-1 text-center"
                style={{ minWidth: minColumnWidth, maxWidth: maxColumnWidth }}
              >
                <div className="text-[13px] font-semibold leading-tight text-gray-700 dark:text-gray-300">{day}</div>
                <div className="text-[11px] font-medium leading-tight text-gray-500 dark:text-gray-400">{month}</div>
              </div>
            );
          })}
        </div>
        <div className="w-20 flex-shrink-0" />
      </div>
    </div>
  );

  return (
    <div
      className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-8 w-full relative overflow-hidden"
      style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      onClick={(e) => {
        if (view === 'progression' && !(e.target as HTMLElement).closest('[data-slice]') && !(e.target as HTMLElement).closest('button')) {
          setSelectedDate(null);
        }
      }}
    >
      {Header}
      {view === 'progression' ? ProgressionBody : CandlesBody}
      {Footer}
    </div>
  );
});

PlayerPointsByGameDayWidget.displayName = 'PlayerPointsByGameDayWidget';

export default PlayerPointsByGameDayWidget;
