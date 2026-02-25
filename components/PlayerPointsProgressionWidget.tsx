import { memo, useState, useEffect, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface PlayerPointsProgressionWidgetProps {
  competitionId: string;
  currentUserId?: string;
}

interface GameDay {
  date: string;
  points: number;
  cumulativePoints: number;
  dayNumber: number;
}

interface PlayerData {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  totalPoints: number;
  gameDays: GameDay[];
  rank: number;
}

// Color palette for game days - more vibrant colors
const GAME_DAY_COLORS = [
  { bg: '#BFDBFE', border: '#60A5FA' }, // blue-200 with blue-400 border
  { bg: '#BBF7D0', border: '#4ADE80' }, // green-200 with green-400 border
  { bg: '#FEF08A', border: '#FACC15' }, // yellow-200 with yellow-400 border
  { bg: '#FECACA', border: '#F87171' }, // red-200 with red-400 border
  { bg: '#DDD6FE', border: '#A78BFA' }, // violet-200 with violet-400 border
  { bg: '#A5F3FC', border: '#22D3EE' }, // cyan-200 with cyan-400 border
  { bg: '#D9F99D', border: '#84CC16' }, // lime-200 with lime-400 border
  { bg: '#FED7AA', border: '#FB923C' }, // orange-200 with orange-400 border
  { bg: '#FBCFE8', border: '#F472B6' }, // pink-200 with pink-400 border
  { bg: '#C7D2FE', border: '#818CF8' }, // indigo-200 with indigo-400 border
  { bg: '#99F6E4', border: '#2DD4BF' }, // teal-200 with teal-400 border
  { bg: '#FECDD3', border: '#FB7185' }, // rose-200 with rose-400 border
  { bg: '#E9D5FF', border: '#C084FC' }, // purple-200 with purple-400 border
  { bg: '#BAE6FD', border: '#38BDF8' }, // sky-200 with sky-400 border
  { bg: '#BBF7D0', border: '#4ADE80' }, // green-200 with green-400 border
  { bg: '#FEF08A', border: '#FACC15' }, // yellow-200 with yellow-400 border
  { bg: '#FECACA', border: '#F87171' }, // red-200 with red-400 border
  { bg: '#DDD6FE', border: '#A78BFA' }, // violet-200 with violet-400 border
  { bg: '#A5F3FC', border: '#22D3EE' }, // cyan-200 with cyan-400 border
  { bg: '#D9F99D', border: '#84CC16' }, // lime-200 with lime-400 border
];

const PlayerPointsProgressionWidget = memo(({ 
  competitionId, 
  currentUserId 
}: PlayerPointsProgressionWidgetProps) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [playerData, setPlayerData] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ playerId: string; date: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPlayerProgression = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/competitions/${competitionId}/ranking-evolution`);
        if (!response.ok) {
          throw new Error('Failed to fetch ranking evolution');
        }
        const data = await response.json();
        
        // Transform the data into the format we need
        const transformedData = transformRankingData(data.rankingEvolution || []);
        setPlayerData(transformedData);
      } catch (err) {
        console.error('Error fetching player progression:', err);
        setError('Failed to load player progression');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerProgression();
  }, [competitionId]);

  // Auto-refresh every 30 seconds to get new game data
  useEffect(() => {
    const interval = setInterval(() => {
      const fetchPlayerProgression = async () => {
        try {
          const response = await fetch(`/api/competitions/${competitionId}/ranking-evolution`);
          if (response.ok) {
            const data = await response.json();
            const transformedData = transformRankingData(data.rankingEvolution || []);
            setPlayerData(transformedData);
          }
        } catch (err) {
          console.error('Error auto-refreshing player progression:', err);
        }
      };
      fetchPlayerProgression();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [competitionId]);

  // Transform ranking evolution data into player progression format
  const transformRankingData = (rankingData: any[]): PlayerData[] => {
    if (rankingData.length === 0) return [];

    // Get all unique players
    const allPlayers = new Map<string, { userName: string; profilePictureUrl: string | null }>();
    rankingData.forEach(dataPoint => {
      dataPoint.rankings.forEach((ranking: any) => {
        if (!allPlayers.has(ranking.userId)) {
          allPlayers.set(ranking.userId, {
            userName: ranking.userName,
            profilePictureUrl: ranking.profilePictureUrl
          });
        }
      });
    });

    // Calculate progression for each player
    const playerProgressions: PlayerData[] = [];
    
    allPlayers.forEach((playerInfo, userId) => {
      const gameDays: GameDay[] = [];
      let previousPoints = 0;
      
      rankingData.forEach((dataPoint, index) => {
        const playerRanking = dataPoint.rankings.find((r: any) => r.userId === userId);
        
        if (playerRanking) {
          // Player has ranking for this date
          const dayPoints = playerRanking.totalPoints - previousPoints;
          if (dayPoints > 0) { // Only add if player actually scored points
            gameDays.push({
              date: dataPoint.date,
              points: dayPoints,
              cumulativePoints: playerRanking.totalPoints,
              dayNumber: index + 1
            });
          }
          previousPoints = playerRanking.totalPoints;
        }
        // Don't add anything for dates where player didn't bet (no 0-point entries)
      });

      if (gameDays.length > 0) {
        const lastDay = gameDays[gameDays.length - 1];
        playerProgressions.push({
          userId,
          userName: playerInfo.userName,
          profilePictureUrl: playerInfo.profilePictureUrl,
          totalPoints: lastDay.cumulativePoints,
          gameDays,
          rank: 0 // Will be set after sorting
        });
      }
    });

    // Sort by total points and assign ranks
    playerProgressions.sort((a, b) => b.totalPoints - a.totalPoints);
    playerProgressions.forEach((player, index) => {
      player.rank = index + 1;
    });

    return playerProgressions;
  };

  // Calculate the maximum total points across all players for bar scaling
  const maxTotalPoints = Math.max(...playerData.map(p => p.totalPoints), 1);
  
  // Calculate max points scored in a single day across all players for segment scaling
  const maxPointsPerDay = Math.max(
    ...playerData.flatMap(p => p.gameDays.map(gd => gd.points)),
    1
  );

  // Calculate a more balanced scaling factor for segments
  // Use the 90th percentile to avoid extreme outliers making segments too small
  const allPoints = playerData.flatMap(p => p.gameDays.map(gd => gd.points)).sort((a, b) => b - a);
  const percentile90Index = Math.floor(allPoints.length * 0.1); // Top 10% (90th percentile)
  const balancedMaxPoints = allPoints[percentile90Index] || maxPointsPerDay;

  // Calculate available width for bars (leave space for score badges)
  const availableBarWidth = 85; // Percentage of container width available for bars
  const badgeSpace = 15; // Percentage reserved for badges

  // Ensure minimum segment width for readability (prevents segments from becoming too small)
  const minSegmentWidth = 2; // Minimum 2% width for any segment
  const effectiveMaxPoints = Math.max(balancedMaxPoints, maxPointsPerDay * 0.1); // Ensure segments don't get too small

  // Get all unique dates where any player has points
  const allGameDays = new Map<string, { date: string; maxPoints: number; colorIndex: number }>();
  const uniqueDates = new Set<string>();
  
  // Collect all unique dates
  playerData.forEach(player => {
    player.gameDays.forEach(gameDay => {
      if (gameDay.points > 0) {
        uniqueDates.add(gameDay.date);
      }
    });
  });

  // Sort dates chronologically and assign color indices
  const sortedDates = Array.from(uniqueDates).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  // Create the allGameDays map with proper color indices
  sortedDates.forEach((date, index) => {
    let maxPoints = 0;
    playerData.forEach(player => {
      const gameDay = player.gameDays.find(gd => gd.date === date);
      if (gameDay && gameDay.points > maxPoints) {
        maxPoints = gameDay.points;
      }
    });
    
    allGameDays.set(date, {
      date,
      maxPoints,
      colorIndex: index
    });
  });

  // Calculate ranking for a specific date
  const getRankingForDate = (date: string) => {
    const dayRankings = playerData
      .map(player => {
        const gameDay = player.gameDays.find(gd => gd.date === date);
        return {
          userId: player.userId,
          userName: player.userName,
          profilePictureUrl: player.profilePictureUrl,
          points: gameDay ? gameDay.points : 0,
          cumulativePoints: gameDay ? gameDay.cumulativePoints : 0
        };
      })
      .sort((a, b) => b.points - a.points); // Sort by points scored that day

    return dayRankings;
  };

  // Dark mode color mapping - same colors as Évolution du Classement but with opacity
  const getDarkModeColor = (lightColor: { bg: string; border: string }, colorIndex: number) => {
    // Use the same color palette as Évolution du Classement but with opacity to tone it down
    const brightColors = [
      { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4' }, // blue with opacity
      { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C' }, // green with opacity
      { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E' }, // orange with opacity
      { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728' }, // red with opacity
      { bg: 'rgba(148, 103, 189, 0.6)', border: '#9467BD' }, // purple with opacity
      { bg: 'rgba(140, 86, 75, 0.6)', border: '#8C564B' }, // brown/tan with opacity
      { bg: 'rgba(188, 189, 34, 0.6)', border: '#BCBD22' }, // yellow-green with opacity
      { bg: 'rgba(23, 190, 207, 0.6)', border: '#17BECF' }, // teal/cyan with opacity
      { bg: 'rgba(127, 127, 127, 0.6)', border: '#7F7F7F' }, // gray with opacity
      { bg: 'rgba(31, 119, 180, 0.6)', border: '#1F77B4' }, // blue (repeat)
      { bg: 'rgba(44, 160, 44, 0.6)', border: '#2CA02C' }, // green (repeat)
      { bg: 'rgba(255, 127, 14, 0.6)', border: '#FF7F0E' }, // orange (repeat)
      { bg: 'rgba(214, 39, 40, 0.6)', border: '#D62728' }, // red (repeat)
      { bg: 'rgba(148, 103, 189, 0.6)', border: '#9467BD' }, // purple (repeat)
    ];
    return brightColors[colorIndex % brightColors.length];
  };

  // Get color for a game day by date
  const getGameDayColor = (date: string) => {
    const gameDay = allGameDays.get(date);
    const colorIndex = gameDay ? gameDay.colorIndex % GAME_DAY_COLORS.length : 0;
    const lightColor = GAME_DAY_COLORS[colorIndex];
    
    if (isDarkMode) {
      return getDarkModeColor(lightColor, colorIndex);
    }
    return lightColor;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  // Get day ranking for a specific day
  const getDayRanking = (playerId: string, dayIndex: number) => {
    const player = playerData.find(p => p.userId === playerId);
    if (!player || !player.gameDays[dayIndex]) return [];

    const targetDate = player.gameDays[dayIndex].date;
    const dayRankings = playerData
      .map(p => {
        const dayData = p.gameDays.find(gd => gd.date === targetDate);
        return dayData ? { ...p, dayPoints: dayData.points, dayCumulative: dayData.cumulativePoints } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?.dayCumulative || 0) - (a?.dayCumulative || 0));

    return dayRankings;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-4 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
          <div className="flex items-center">
            <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Progression des Points par Journée</h2>
          </div>
        </div>
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
      <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-4 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
          <div className="flex items-center">
            <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Progression des Points par Journée</h2>
          </div>
        </div>
        <div className="p-4 text-center py-8">
          <div className="text-red-500 text-4xl mb-3">⚠️</div>
          <p className="text-red-500 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-primary-600 dark:text-accent-dark-500 text-sm hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (playerData.length === 0) {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-4 w-full overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
          <div className="flex items-center">
            <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Progression des Points par Journée</h2>
          </div>
        </div>
        <div className="p-4 text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📊</div>
          <p className="text-gray-500 dark:text-gray-400">Aucun point attribué pour l'instant.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-white dark:bg-[rgb(58,58,58)] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl mb-8 w-full relative overflow-hidden"
      onClick={(e) => {
        // Reset if clicking anywhere except on slices
        const target = e.target as HTMLElement;
        const isSlice = target.closest('[data-slice]');
        const isHeaderDate = target.closest('[data-header-date]');
        
        if (!isSlice && !isHeaderDate) {
          setSelectedDay(null);
        }
      }}
    >
      {/* Header Section */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <div className="flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
            Progression des Points par Journée{selectedDay ? (
              <span 
                className="ml-2 px-2 py-1 rounded text-gray-800 dark:text-gray-200 text-lg font-semibold"
                style={{ 
                  backgroundColor: getGameDayColor(selectedDay.date).bg,
                  borderColor: getGameDayColor(selectedDay.date).border
                }}
              >
                {formatDate(selectedDay.date)}
              </span>
            ) : ''}
          </h2>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
          {/* Player Bars */}
          <div className="space-y-2" ref={containerRef}>
        {(selectedDay ? 
          // Reorder players by their cumulative points up to the selected day
          playerData
            .map(player => {
              const gameDay = player.gameDays.find(gd => gd.date === selectedDay.date);
              // Calculate cumulative points up to the selected day
              let dayCumulative = 0;
              if (gameDay) {
                dayCumulative = gameDay.cumulativePoints;
              } else {
                // Player didn't bet on this day, find their last cumulative points before this date
                const previousGameDays = player.gameDays.filter(gd => gd.date < selectedDay.date);
                if (previousGameDays.length > 0) {
                  const lastGameDay = previousGameDays[previousGameDays.length - 1];
                  dayCumulative = lastGameDay.cumulativePoints;
                }
              }
              return {
                ...player,
                dayPoints: gameDay ? gameDay.points : 0,
                dayCumulative: dayCumulative
              };
            })
            .sort((a, b) => b.dayCumulative - a.dayCumulative) // Sort by cumulative points up to that day
          : 
          // Use original ranking (by total points)
          playerData
        ).map((player, index) => (
          <div
            key={player.userId}
            className={`flex items-center space-x-4 transition-all duration-200 border-b border-gray-300 pb-2 ${index === 0 ? 'border-t border-gray-300 pt-2' : 'pt-0.5'} ${index === playerData.length - 1 ? 'border-b border-gray-300' : ''}`}
          >
            {/* Player Info */}
            <div className="flex items-center space-x-3 w-36 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[rgb(40,40,40)] flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                {selectedDay ? index + 1 : player.rank}
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

            {/* Progress Bar with Integrated Score */}
            <div className="flex-1 relative">
              <div 
                className="h-10 bg-gray-100 dark:bg-[rgb(40,40,40)] rounded-lg overflow-hidden flex shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                style={{ width: `${(player.totalPoints / maxTotalPoints) * availableBarWidth}%` }}
              >
                {(() => {
                  // Filter to only game days with points
                  const gameDaysWithPoints = player.gameDays.filter(gameDay => gameDay.points > 0);
                  
                  // If player has only one segment, it should fill 100% of the bar
                  const isSingleSegment = gameDaysWithPoints.length === 1;
                  
                  return gameDaysWithPoints.map((gameDay) => {
                    // Additional safety check
                    if (gameDay.points <= 0) return null;
                    
                    // Calculate segment width as proportion of player's total points
                    // This ensures segments always fill 100% of the bar (no gray background showing)
                    const width = isSingleSegment 
                      ? 100 
                      : (gameDay.points / player.totalPoints) * 100;
                    
                    const colorObj = getGameDayColor(gameDay.date);
                    
                    return (
                      <div
                        key={gameDay.date}
                        className={`relative h-full cursor-pointer transition-all duration-200 ${
                          selectedDay && selectedDay.date === gameDay.date
                            ? 'ring-2 ring-lime-500 ring-opacity-70 shadow-lg transform scale-105'
                            : ''
                        }`}
                        style={{ 
                          width: `${width}%`,
                          opacity: selectedDay !== null && selectedDay.date !== gameDay.date ? 0.2 : 1,
                          backgroundColor: colorObj.bg,
                          border: isDarkMode ? 'none' : `1px solid ${colorObj.border}`,
                          borderRight: isDarkMode ? 'none' : '1px solid rgba(255, 255, 255, 0.25)'
                        }}
                        data-slice
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent click from bubbling up to container
                          // Toggle: if clicking the same date, unselect; otherwise select
                          if (selectedDay && selectedDay.date === gameDay.date) {
                            setSelectedDay(null);
                          } else {
                            setSelectedDay({ playerId: player.userId, date: gameDay.date });
                          }
                        }}
                      >
                        <div className="h-full flex items-center justify-center px-2 py-1 relative">
                          {/* Vertical lines to represent points - purely visual, no layout impact */}
                          {gameDay.points > 1 && (
                            <div className="absolute inset-0 pointer-events-none">
                              {Array.from({ length: gameDay.points - 1 }, (_, i) => (
                                <div
                                  key={i}
                                  className={`absolute w-px top-0 bottom-0 ${isDarkMode ? 'bg-white/10' : 'bg-white/30'}`}
                                  style={{
                                    left: `${((i + 1) / gameDay.points) * 100}%`
                                  }}
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
                  });
                })()}
              </div>
              
              {/* Score Badge - Integrated at the end of the bar */}
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-2">
                <div className="bg-gray-100 dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 shadow-sm">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {selectedDay ? 
                      (() => {
                        const selectedGameDay = player.gameDays.find(gd => gd.date === selectedDay.date);
                        // Calculate cumulative points up to the selected day
                        let dayCumulative = 0;
                        if (selectedGameDay) {
                          dayCumulative = selectedGameDay.cumulativePoints;
                        } else {
                          // Player didn't bet on this day, find their last cumulative points before this date
                          const previousGameDays = player.gameDays.filter(gd => gd.date < selectedDay.date);
                          if (previousGameDays.length > 0) {
                            const lastGameDay = previousGameDays[previousGameDays.length - 1];
                            dayCumulative = lastGameDay.cumulativePoints;
                          }
                        }
                        return dayCumulative;
                      })() 
                      : player.totalPoints
                    }
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* Footer Section */}
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
