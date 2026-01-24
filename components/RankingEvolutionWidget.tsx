import { memo, useState, useEffect, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

interface RankingDataPoint {
  date: string;
  rankings: {
    userId: string;
    userName: string;
    profilePictureUrl: string | null;
    position: number;
    totalPoints: number;
  }[];
}

interface RankingEvolutionWidgetProps {
  competitionId: string;
  currentUserId?: string;
}

// Color palette for different players (distinct, curated — no near-duplicates)
// Based on a high-contrast categorical set
const PLAYER_COLORS = [
  '#1F77B4', // blue
  '#FF7F0E', // orange
  '#2CA02C', // green
  '#D62728', // red
  '#9467BD', // purple
  '#8C564B', // brown/tan
  '#BCBD22', // yellow-green
  '#7F7F7F', // gray
  '#17BECF', // teal/cyan
];

const RankingEvolutionWidget = memo(({ 
  competitionId, 
  currentUserId 
}: RankingEvolutionWidgetProps) => {
  const { t } = useTranslation('dashboard');
  const { theme } = useTheme();
  const [rankingData, setRankingData] = useState<RankingDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(400);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    const fetchRankingEvolution = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/competitions/${competitionId}/ranking-evolution`);
        if (!response.ok) {
          throw new Error('Failed to fetch ranking evolution');
        }
        const data = await response.json();
        setRankingData(data.rankingEvolution || []);
      } catch (err) {
        console.error('Error fetching ranking evolution:', err);
        setError('Failed to load ranking evolution');
      } finally {
        setLoading(false);
      }
    };

    fetchRankingEvolution();
  }, [competitionId]);

  // Update chart width when container resizes
  useEffect(() => {
    // Wait until data is loaded and container exists
    let rafId: number | null = null;
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const width = Math.floor(entries[0].contentRect.width);
      if (width > 0) {
        setChartWidth(width);
        setIsMobile(width < 640);
      }
    });

    const measureNow = () => {
      if (!containerRef.current) return false;
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        setChartWidth(width);
        setIsMobile(width < 640);
        return true;
      }
      return false;
    };

    const attachObserverWhenReady = () => {
      if (containerRef.current) {
        try {
          observer.observe(containerRef.current);
        } catch (_) {
          // no-op
        }
        // Do an immediate measurement as well
        measureNow();
        return true;
      }
      return false;
    };

    // Try immediate attach/measure
    let attached = attachObserverWhenReady();

    // If not attached, poll via rAF for a short period until container exists and has width
    if (!attached) {
      const tryAttach = () => {
        attached = attachObserverWhenReady();
        if (!attached) {
          rafId = window.requestAnimationFrame(tryAttach);
        }
      };
      rafId = window.requestAnimationFrame(tryAttach);
    }

    // As a safety net, also check periodically for late layout (e.g., after CSS/layout settles)
    if (!measureNow()) {
      checkInterval = setInterval(() => {
        const ok = measureNow();
        if (ok && checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }, 200);
    }

    const onResize = () => {
      measureNow();
    };
    window.addEventListener('resize', onResize);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [competitionId, loading, rankingData.length]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-3 mb-4 w-full">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow mr-3 flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Évolution du Classement</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-3 mb-4 w-full">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow mr-3 flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Évolution du Classement</h2>
        </div>
        <div className="text-center py-8">
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

  if (rankingData.length === 0) {
    return (
      <div className="bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-3 mb-4 w-full">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow mr-3 flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Évolution du Classement</h2>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">📈</div>
          <p className="text-gray-500 dark:text-gray-400">
            Aucune donnée de classement disponible
          </p>
        </div>
      </div>
    );
  }

  // Get all unique players from the first ranking data point
  const allPlayers = rankingData[0]?.rankings || [];
  const maxPosition = Math.max(...allPlayers.map(p => p.position));

  // Create color mapping for players
  const playerColorMap = new Map<string, string>();
  allPlayers.forEach((player, index) => {
    playerColorMap.set(player.userId, PLAYER_COLORS[index % PLAYER_COLORS.length]);
  });

  // Calculate chart dimensions - fit within widget container
  const chartHeight = 340;
  const padding = { top: 20, right: 56, bottom: 40, left: 40 };
  const plotWidth = chartWidth - (padding.left + padding.right);
  const plotHeight = chartHeight - (padding.top + padding.bottom);

  return (
    <div className="bg-white dark:bg-[rgb(38,38,38)] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 mb-8 w-full" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow mr-3 flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Évolution du Classement</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cliquez sur un joueur pour mettre en évidence sa progression</p>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="overflow-x-auto" ref={containerRef}>
        <div className="relative w-full" style={{ height: chartHeight }}>
          <svg 
            ref={svgRef}
            width={chartWidth} 
            height={chartHeight} 
            className="absolute inset-0"
            style={{
              textRendering: 'geometricPrecision',
              shapeRendering: 'geometricPrecision'
            }}
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isDarkMode ? "#1F2937" : "#FFFFFF"} />
                <stop offset="100%" stopColor={isDarkMode ? "#111827" : "#F9FAFB"} />
              </linearGradient>
            </defs>

            {/* Chart background gradient */}
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              fill="url(#chartGradient)"
            />

            {/* Horizontal grid lines */}
            {Array.from({ length: maxPosition + 1 }).map((_, i) => (
              <line
                key={`grid-${i}`}
                x1={padding.left}
                y1={padding.top + (i * plotHeight) / maxPosition}
                x2={chartWidth - padding.right}
                y2={padding.top + (i * plotHeight) / maxPosition}
                stroke={isDarkMode ? "#374151" : "#F5F5F5"}
                strokeWidth={1}
              />
            ))}


            {/* Y-axis labels (positions) - Left side */}
            {Array.from({ length: maxPosition + 1 }).map((_, i) => {
              // On mobile, show fewer ticks (every other one if more than 6 positions)
              if (isMobile && maxPosition > 6 && i % 2 !== 0 && i !== maxPosition) {
                return null;
              }
              
              return (
                <text
                  key={`y-label-left-${i}`}
                  x={padding.left - 12}
                  y={padding.top + (i * plotHeight) / maxPosition + 4}
                  textAnchor="end"
                  style={{ 
                    fontSize: '13px', 
                    fill: isDarkMode ? '#D1D5DB' : '#374151',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    textRendering: 'geometricPrecision',
                    shapeRendering: 'geometricPrecision'
                  }}
                >
                  {i + 1 === 1 ? '1er' : i + 1 === 10 ? '' : `${i + 1}e`}
                </text>
              );
            })}

            {/* Y-axis labels (positions) - Right side */}
            {Array.from({ length: maxPosition + 1 }).map((_, i) => {
              // On mobile, show fewer ticks (every other one if more than 6 positions)
              if (isMobile && maxPosition > 6 && i % 2 !== 0 && i !== maxPosition) {
                return null;
              }
              
              return (
                <text
                  key={`y-label-right-${i}`}
                  x={padding.left + plotWidth + 22}
                  y={padding.top + (i * plotHeight) / maxPosition + 4}
                  textAnchor="start"
                  style={{ 
                    fontSize: '13px', 
                    fill: isDarkMode ? '#D1D5DB' : '#374151',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    textRendering: 'geometricPrecision',
                    shapeRendering: 'geometricPrecision'
                  }}
                >
                  {i + 1 === 1 ? '1er' : i + 1 === 10 ? '' : `${i + 1}e`}
                </text>
              );
            })}

            {/* X-axis labels (dates) */}
            {rankingData.map((dataPoint, index) => {
              // On mobile, show fewer ticks (every other one if more than 8 data points)
              if (isMobile && rankingData.length > 8 && index % 2 !== 0 && index !== rankingData.length - 1) {
                return null;
              }
              
              // Fix: Use proper scaling for single data point
              const x = rankingData.length === 1 
                ? padding.left + (plotWidth / 2) // Center single point
                : padding.left + ((index * plotWidth) / Math.max(1, rankingData.length - 1));
              
              // Check if labels would overlap (rough estimation)
              const labelSpacing = plotWidth / Math.max(1, rankingData.length - 1);
              const shouldRotate = labelSpacing < 40 || isMobile; // Rotate if spacing is too small or on mobile
              
              // Format the date from the dataPoint
              const date = new Date(dataPoint.date);
              const day = String(date.getDate()).padStart(2, '0');
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const dateLabel = `${day}/${month}`;
              
              return (
                <g key={`x-label-${index}`}>
                  {/* Date label */}
                  <text
                    x={x}
                    y={chartHeight - padding.bottom + 16}
                    textAnchor={shouldRotate ? "end" : "middle"}
                    style={{ 
                      fontSize: '13px', 
                      fill: isDarkMode ? '#D1D5DB' : '#374151',
                      fontWeight: 600,
                      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                      textRendering: 'geometricPrecision',
                      shapeRendering: 'geometricPrecision',
                      transform: shouldRotate ? `rotate(-28 ${x} ${chartHeight - padding.bottom + 16})` : 'none',
                      transformOrigin: `${x}px ${chartHeight - padding.bottom + 16}px`
                    }}
                  >
                    {dateLabel}
                  </text>
                </g>
              );
            })}

            {/* Separators between dates */}
            {rankingData.map((dataPoint, index) => {
              // Don't show separator for the last data point
              if (index === rankingData.length - 1) return null;
              
              // Calculate midpoint between current and next date
              const currentX = rankingData.length === 1 
                ? padding.left + (plotWidth / 2)
                : padding.left + ((index * plotWidth) / Math.max(1, rankingData.length - 1));
              
              const nextX = rankingData.length === 1 
                ? padding.left + (plotWidth / 2)
                : padding.left + (((index + 1) * plotWidth) / Math.max(1, rankingData.length - 1));
              
              const separatorX = (currentX + nextX) / 2;
              
              // Check if labels would overlap (rough estimation)
              const labelSpacing = plotWidth / Math.max(1, rankingData.length - 1);
              const shouldRotate = labelSpacing < 40 || isMobile;
              
              return (
                <text
                  key={`separator-${index}`}
                  x={separatorX}
                  y={chartHeight - padding.bottom + 16}
                  textAnchor="middle"
                    style={{ 
                      fontSize: '13px', 
                      fill: isDarkMode ? '#4B5563' : '#E5E7EB',
                      fontWeight: 300,
                      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                      textRendering: 'geometricPrecision',
                      shapeRendering: 'geometricPrecision',
                      transform: shouldRotate ? `rotate(-28 ${separatorX} ${chartHeight - padding.bottom + 16})` : 'none',
                      transformOrigin: `${separatorX}px ${chartHeight - padding.bottom + 16}px`
                    }}
                >
                  |
                </text>
              );
            })}

            {/* Player lines */}
            {allPlayers.map(player => {
              const color = playerColorMap.get(player.userId) || '#6B7280';
              const isSelected = selectedUserId === player.userId;
              
              return (
                <polyline
                  key={player.userId}
                  points={rankingData.map((dataPoint, index) => {
                    const playerRanking = dataPoint.rankings.find(r => r.userId === player.userId);
                    const position = playerRanking?.position || maxPosition;
                    // Fix: Use proper scaling for single data point
                    const x = rankingData.length === 1 
                      ? padding.left + (plotWidth / 2) // Center single point
                      : padding.left + ((index * plotWidth) / Math.max(1, rankingData.length - 1));
                    const y = padding.top + ((position - 1) * plotHeight) / maxPosition;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={selectedUserId ? (isSelected ? 1 : 0.3) : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'opacity 0.3s ease-in-out, stroke-width 0.3s ease-in-out',
                    cursor: 'pointer',
                    filter: isSelected ? 'drop-shadow(0px 1px 1px rgba(0,0,0,0.1))' : 'none'
                  }}
                  onClick={() => setSelectedUserId(isSelected ? null : player.userId)}
                />
              );
            })}

            {/* Data points */}
            {allPlayers.map(player => {
              const color = playerColorMap.get(player.userId) || '#6B7280';
              const isSelected = selectedUserId === player.userId;
              
              return rankingData.map((dataPoint, index) => {
                const playerRanking = dataPoint.rankings.find(r => r.userId === player.userId);
                if (!playerRanking) return null;
                
                // Fix: Use proper scaling for single data point
                const x = rankingData.length === 1 
                  ? padding.left + (plotWidth / 2) // Center single point
                  : padding.left + ((index * plotWidth) / Math.max(1, rankingData.length - 1));
                const y = padding.top + ((playerRanking.position - 1) * plotHeight) / maxPosition;
                
                return (
                  <circle
                    key={`point-${player.userId}-${index}`}
                    cx={x}
                    cy={y}
                    r={isSelected ? 5 : 3}
                    fill={color}
                    stroke={isDarkMode ? "#1F2937" : "white"}
                    strokeWidth={isSelected ? 2 : 1}
                    opacity={selectedUserId ? (isSelected ? 1 : 0.3) : 1}
                    style={{
                      transition: 'opacity 0.3s ease-in-out, r 0.3s ease-in-out',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedUserId(isSelected ? null : player.userId)}
                  />
                );
              });
            })}

            {/* Profile pictures at last data point */}
            {allPlayers.map(player => {
              const color = playerColorMap.get(player.userId) || '#6B7280';
              const isSelected = selectedUserId === player.userId;
              const lastDataPoint = rankingData[rankingData.length - 1];
              const lastRanking = lastDataPoint?.rankings.find(r => r.userId === player.userId);
              
              if (!lastRanking) return null;
              
              // Calculate position for last data point
              const x = rankingData.length === 1 
                ? padding.left + (plotWidth / 2)
                : padding.left + plotWidth;
              const y = padding.top + ((lastRanking.position - 1) * plotHeight) / maxPosition;
              
              return (
                <g key={`profile-${player.userId}`}>
                  {/* Background circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 16 : 14}
                    fill={isDarkMode ? "#1F2937" : "white"}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={selectedUserId ? (isSelected ? 1 : 0.3) : 1}
                    style={{
                      transition: 'opacity 0.3s ease-in-out, r 0.3s ease-in-out',
                      filter: isSelected ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' : 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedUserId(isSelected ? null : player.userId)}
                  />
                  {/* Profile picture */}
                  <image
                    x={x - (isSelected ? 16 : 14)}
                    y={y - (isSelected ? 16 : 14)}
                    width={isSelected ? 32 : 28}
                    height={isSelected ? 32 : 28}
                    href={player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.userName}`}
                    clipPath={`url(#profile-clip-${player.userId})`}
                    style={{
                      transition: 'opacity 0.3s ease-in-out',
                      opacity: selectedUserId ? (isSelected ? 1 : 0.3) : 1,
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedUserId(isSelected ? null : player.userId)}
                  />
                  {/* Clip path for circular profile pictures */}
                  <defs>
                    <clipPath id={`profile-clip-${player.userId}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 16 : 14}
                      />
                    </clipPath>
                  </defs>
                </g>
              );
            })}

          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          {allPlayers.map((player, index) => {
            const color = playerColorMap.get(player.userId) || '#6B7280';
            const isSelected = selectedUserId === player.userId;
            
            return (
              <div 
                key={player.userId}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'bg-blue-100 dark:bg-accent-dark-900/40 ring-2 ring-blue-400 dark:ring-accent-dark-500 shadow-md transform scale-105' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm'
                }`}
                onClick={() => setSelectedUserId(isSelected ? null : player.userId)}
              >
                <div 
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    isSelected ? 'ring-2 ring-lime-400 dark:ring-accent-dark-500 shadow-sm' : ''
                  }`}
                  style={{ 
                    backgroundColor: color,
                    borderColor: isDarkMode ? '#1F2937' : 'white'
                  }}
                />
                <img
                  src={player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.userName.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={player.userName}
                  className={`w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover transition-all dark:bg-white dark:p-0.5 ${
                    isSelected ? 'ring-2 ring-lime-400 dark:ring-accent-dark-500 shadow-sm' : ''
                  }`}
                />
                <span className={`font-medium transition-all ${
                  isSelected 
                    ? 'text-blue-800 dark:text-accent-dark-400 font-bold' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {player.userName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

RankingEvolutionWidget.displayName = 'RankingEvolutionWidget';

export default RankingEvolutionWidget;
