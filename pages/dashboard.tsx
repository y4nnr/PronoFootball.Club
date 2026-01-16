import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, memo, useRef } from "react";
import { useTranslation } from '../hooks/useTranslation';
import { useLiveScores } from '../hooks/useLiveScores';
import { GetStaticProps } from 'next';
import { 
  TrophyIcon, 
  ChartBarIcon, 
  PlayIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import GameCard from '../components/GameCard';
import CompetitionCard from '../components/CompetitionCard';
import CountdownTimer from '../components/CountdownTimer';
import News from '../components/News';

type UserStats = {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  averagePoints: number;
  totalPoints: number;
  rank: number;
  totalUsers: number;
  competitionsWon: number;
};

interface Competition {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  logo?: string;
  userRanking?: number;
}

interface News {
  id: string;
  title: string;
  content: string;
  date: string;
  type: string;
}

interface UserBet {
  id: string;
  userId: string;
  score1: number;
  score2: number;
  points?: number | null;
  user: {
    id: string;
    name: string;
    profilePictureUrl?: string;
  };
}

interface BettingGame {
  id: string;
  homeTeam: {
    id: string;
    name: string;
    logo?: string | null;
    shortName?: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    logo?: string | null;
    shortName?: string | null;
  };
  date: string;
  status: string;
  externalStatus?: string | null; // V2: External API status (HT, 1H, 2H, etc.)
  homeScore?: number | null;
  awayScore?: number | null;
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
  elapsedMinute?: number | null; // V2: Chronometer minute
  userBet?: {
    id: string;
    score1: number;
    score2: number;
    points?: number | null;
  } | null;
  competition: {
    id: string;
    name: string;
    logo?: string | null;
  };
  allUserBets: UserBet[];
  betCount?: number;
}

interface DashboardData {
  stats: UserStats;
  activeCompetitions: Competition[];
  availableCompetitions: Competition[];
  news: News[];
}

// Removed unused UserRankings interface

interface LastGamePerformance {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  actualScore: string;
  predictedScore: string;
  points: number | null; // null means no bet
  result: 'exact' | 'correct' | 'wrong' | 'no_bet';
}


// Helper function to remove season from competition name
const removeSeasonFromName = (name: string): string => {
  // Remove patterns like "2025-26", "2025/26", "2025-2026", "2025/2026", "2025", etc.
  return name.replace(/\s*\d{4}(?:[-/]\d{2,4})?\s*$/, '').trim();
};

// Abbreviate competition names for mobile display
const abbreviateCompetitionName = (competitionName: string): string => {
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
};

// Personal Stats Section
const PersonalStatsSection = memo(({ stats, lastGamesPerformance }: { stats: UserStats | null; lastGamesPerformance: LastGamePerformance[] }) => {
  if (!stats) return null;

  return (
    <div className="mb-0">
      {/* Performance des 9 Derniers Matchs */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 border border-primary-300/60 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
                     {Array.from({ length: 9 }).map((_, index) => {
                       const game = lastGamesPerformance[index];
                       return game ? (
                         <div
                          key={game.gameId}
                          className={`h-18 rounded-xl flex flex-col items-center justify-center text-gray-700 font-bold text-sm shadow-modern p-2 bg-white border-2 ${
                            game.result === 'no_bet' ? 'border-blue-300' :
                            game.points === 3 ? 'border-yellow-400' :
                            game.points === 1 ? 'border-green-400' :
                            'border-red-400'
                          }`}
                          title={game.result === 'no_bet' ? 
                            `${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore} (No bet placed)` :
                            `${game.homeTeam} vs ${game.awayTeam} - ${game.actualScore} (predicted: ${game.predictedScore}) - ${game.points} points`
                          }
                        >
                {/* Competition logo and name */}
                <div className="mb-1 flex items-center justify-center space-x-1.5">
                  {game.competitionLogo && (
                    <img 
                      src={game.competitionLogo} 
                      alt={game.competition}
                      className="w-5 h-5 object-contain"
                    />
                  )}
                  <span className="text-[11px] font-bold text-gray-700 truncate max-w-[70px]">
                    {abbreviateCompetitionName(removeSeasonFromName(game.competition))}
                  </span>
                </div>
                {/* Separator line */}
                <div className="w-full border-t border-gray-300 mb-1"></div>
                {/* Team logos and codes */}
                <div className="flex items-center space-x-2 mb-1">
                  <div className="flex flex-col items-center">
                    {game.homeTeamLogo && (
                      <img 
                        src={game.homeTeamLogo} 
                        alt={game.homeTeam}
                        className="w-5 h-5 object-contain mb-0.5"
                      />
                    )}
                    <span className="text-[10px] font-medium">{game.homeTeam.substring(0, 3).toUpperCase()}</span>
                  </div>
                  <span className="text-xs font-medium">vs</span>
                  <div className="flex flex-col items-center">
                    {game.awayTeamLogo && (
                      <img 
                        src={game.awayTeamLogo} 
                        alt={game.awayTeam}
                        className="w-5 h-5 object-contain mb-0.5"
                      />
                    )}
                    <span className="text-[10px] font-medium">{game.awayTeam.substring(0, 3).toUpperCase()}</span>
                  </div>
                </div>
                           {/* Points and Date */}
                           <div className="flex flex-col items-center">
                             <div className="text-base font-bold">
                               {game.result === 'no_bet' ? 'shooter!' : game.points}
                             </div>
                             <div className="text-[11px] font-bold text-gray-700">
                               {new Date(game.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                             </div>
                           </div>
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className="h-18 rounded-xl flex items-center justify-center text-gray-400 font-bold text-sm shadow-modern border-2 border-dashed border-gray-300 bg-white"
                title="No data"
              >
                ?
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

PersonalStatsSection.displayName = 'PersonalStatsSection';

// Active Competitions Section
const ActiveCompetitionsSection = memo(({ competitions, t }: { competitions: Competition[]; t: (key: string) => string }) => {
  const activeCompetitions = competitions.filter(comp => 
    comp.status === 'ACTIVE' || 
    comp.status === 'active' || 
    comp.status === 'UPCOMING' || 
    comp.status === 'upcoming'
  );

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-5" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <TrophyIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-neutral-900">{t('competitions.active')}</h2>
        </div>
      </div>
      {activeCompetitions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {activeCompetitions.slice(0, 4).map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              actionLabel={t('competitions.view') || 'View'}
              actionIcon={<ArrowRightIcon className="h-5 w-5" />}
              userRanking={competition.userRanking}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <TrophyIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">{t('competitions.noActive')}</p>
        </div>
      )}
    </div>
  );
});

ActiveCompetitionsSection.displayName = 'ActiveCompetitionsSection';

// Available Competitions Section
const AvailableCompetitionsSection = memo(({ competitions, t }: { competitions: Competition[]; t: (key: string) => string }) => {
  return (
    <div className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <TrophyIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-neutral-900">{t('availableCompetitions.title')}</h2>
        </div>
      </div>

      {competitions && competitions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {competitions.slice(0, 3).map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              actionLabel="Voir"
              actionIcon={<TrophyIcon className="h-4 w-4" />}
            />
          ))}
          {competitions.length > 3 && (
            <div className="text-center pt-4">
              <button
                onClick={() => window.location.href = '/competitions'}
                className="text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                Voir toutes les compétitions disponibles ({competitions.length})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <TrophyIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">{t('availableCompetitions.noAvailable')}</p>
        </div>
      )}
    </div>
  );
});

AvailableCompetitionsSection.displayName = 'AvailableCompetitionsSection';

// Betting Games Section
const BettingGamesSection = memo(({ games, t, highlightedGames }: { games: BettingGame[]; t: (key: string) => string; highlightedGames: Map<string, 'score' | 'status' | 'both'> }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  
  console.log('🎯 BettingGamesSection - Received games:', games?.length || 0, 'games');
  console.log('🎯 BettingGamesSection - Games data:', games);
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-5 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <PlayIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-neutral-900">{t('bettingGames.title')}</h2>
        </div>
      </div>

      {games && games.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
          {games.map((game) => {
            const bets = game.allUserBets.map((bet: UserBet) => {
              if (currentUserId && bet.userId === currentUserId && game.userBet) {
                return {
                  ...bet,
                  score1: game.userBet.score1,
                  score2: game.userBet.score2,
                };
              }
              return bet;
            });
            return (
              <GameCard 
                key={game.id} 
                game={{ 
                  status: game.status,
                  date: game.date,
                  homeTeam: {
                    name: game.homeTeam.name,
                    logo: game.homeTeam.logo || undefined,
                    shortName: game.homeTeam.shortName || undefined
                  },
                  awayTeam: {
                    name: game.awayTeam.name,
                    logo: game.awayTeam.logo || undefined,
                    shortName: game.awayTeam.shortName || undefined
                  },
                  homeScore: game.homeScore || undefined,
                  awayScore: game.awayScore || undefined,
                  liveHomeScore: game.liveHomeScore || undefined,
                  liveAwayScore: game.liveAwayScore || undefined,
                  externalStatus: game.externalStatus || undefined, // V2: External API status
                  elapsedMinute: game.elapsedMinute !== null && game.elapsedMinute !== undefined ? game.elapsedMinute : undefined, // V2: Chronometer
                  sportType: game.competition?.sportType || undefined,
                  competition: game.competition ? {
                    name: game.competition.name,
                    logo: game.competition.logo || undefined
                  } : undefined,
                  bets: bets
                }} 
                currentUserId={currentUserId} 
                href={`/betting/${game.id}`}
                context="home"
                isHighlighted={highlightedGames.has(game.id)}
                highlightType={highlightedGames.get(game.id) || 'score'}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <PlayIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">{t('bettingGames.placedBets')}</p>
        </div>
      )}
    </div>
  );
});

BettingGamesSection.displayName = 'BettingGamesSection';

// Games of the Day Section
const GamesOfDaySection = memo(({ games, t, highlightedGames }: { games: BettingGame[]; t: (key: string) => string; highlightedGames: Map<string, 'score' | 'status' | 'both'> }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-6 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-neutral-900">{t('gamesOfDay.title')}</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        {games.map((game) => {
          const bets = game.allUserBets.map((bet: UserBet) => {
            if (currentUserId && bet.userId === currentUserId && game.userBet) {
              return {
                ...bet,
                score1: game.userBet.score1,
                score2: game.userBet.score2,
              };
            }
            return bet;
          });
          return (
            <GameCard 
              key={game.id} 
              game={{ 
                status: game.status,
                date: game.date,
                homeTeam: {
                  name: game.homeTeam.name,
                  logo: game.homeTeam.logo || undefined,
                  shortName: game.homeTeam.shortName || undefined
                },
                awayTeam: {
                  name: game.awayTeam.name,
                  logo: game.awayTeam.logo || undefined,
                  shortName: game.awayTeam.shortName || undefined
                },
                homeScore: game.homeScore !== null ? game.homeScore : undefined,
                awayScore: game.awayScore !== null ? game.awayScore : undefined,
                liveHomeScore: game.liveHomeScore !== null ? game.liveHomeScore : undefined,
                liveAwayScore: game.liveAwayScore !== null ? game.liveAwayScore : undefined,
                externalStatus: game.externalStatus || undefined, // V2: External API status
                elapsedMinute: game.elapsedMinute !== null && game.elapsedMinute !== undefined ? game.elapsedMinute : undefined, // V2: Chronometer
                sportType: game.competition?.sportType || undefined,
                competition: game.competition ? {
                  name: game.competition.name,
                  logo: game.competition.logo || undefined
                } : undefined,
                bets: bets
              }} 
              currentUserId={currentUserId} 
              href={game.status === 'UPCOMING' || game.status === 'LIVE' ? `/betting/${game.id}` : '#'}
              context="home"
              isHighlighted={highlightedGames.has(game.id)}
              highlightType={highlightedGames.get(game.id) || 'score'}
            />
          );
        })}
      </div>
    </div>
  );
});

GamesOfDaySection.displayName = 'GamesOfDaySection';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation('dashboard');
  
  // Live scores hook for SSE updates and animations
  const { highlightedGames, hasChanges, lastUpdate, signalCount, lastSignalId, registerRefreshFunction, connectionStatus } = useLiveScores();
  

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [bettingGames, setBettingGames] = useState<BettingGame[] | null>(null);
  const [gamesOfDay, setGamesOfDay] = useState<BettingGame[] | null>(null);
  // Removed unused userRankings state
  const [lastGamesPerformance, setLastGamesPerformance] = useState<LastGamePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null); // Track last session ID to prevent unnecessary refreshes

  // Function to refresh just the game data (for live updates)
  const refreshGameData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      console.log('🔄 Refreshing game data for live updates...');
      
      const [bettingRes, gamesOfDayRes] = await Promise.all([
        fetch('/api/user/dashboard-betting-games', { cache: 'no-store' }),
        fetch('/api/user/games-of-day', { cache: 'no-store' })
      ]);

      if (bettingRes.ok) {
        const bettingData = await bettingRes.json();
        
        // Handle betting games data properly
        let gamesToSet = [];
        if (Array.isArray(bettingData)) {
          // Old format - direct array
          gamesToSet = bettingData;
        } else if (bettingData && Array.isArray(bettingData.games)) {
          // New format - object with games property
          gamesToSet = bettingData.games;
        } else {
          console.warn('⚠️ Unexpected betting data format in refresh:', bettingData);
          gamesToSet = [];
        }
        
        if (gamesToSet.length > 0) {
          // Stable sort to prevent cards from jumping around
          const sortedBettingData = [...gamesToSet].sort((a, b) => {
            // First sort by date, then by ID for stability
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return a.id.localeCompare(b.id);
          });
          setBettingGames(sortedBettingData);
        } else {
          setBettingGames([]);
        }
        console.log('✅ Betting games refreshed');
      }

      if (gamesOfDayRes.ok) {
        const gamesOfDayData = await gamesOfDayRes.json();
        if (Array.isArray(gamesOfDayData)) {
          // Stable sort to prevent cards from jumping around
          const sortedGamesOfDayData = [...gamesOfDayData].sort((a, b) => {
            // First sort by date, then by ID for stability
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return a.id.localeCompare(b.id);
          });
          setGamesOfDay(sortedGamesOfDayData);
        } else {
          setGamesOfDay([]);
        }
        console.log('✅ Games of day refreshed');
      }
    } catch (error) {
      console.error('❌ Error refreshing game data:', error);
    }
  }, [session?.user?.id]);

  const fetchDashboardData = useCallback(async () => {
    try {
      console.log('📊 fetchDashboardData called - Full dashboard refresh starting');
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching dashboard data...');
      console.log('🔄 Session:', session?.user?.email);

      console.log('🔄 Making API calls...');
      const [dashboardRes, bettingRes, gamesOfDayRes, performanceRes] = await Promise.all([
        fetch('/api/user/dashboard', { cache: 'no-store' }),
        fetch('/api/user/dashboard-betting-games', { cache: 'no-store' }),
        fetch('/api/user/games-of-day', { cache: 'no-store' }),
        fetch('/api/stats/user-performance', { cache: 'no-store' })
      ]);
      console.log('🔄 API calls completed');

      // Check each API response individually for better error reporting
      if (!dashboardRes.ok) {
        console.error('Dashboard API failed:', dashboardRes.status, dashboardRes.statusText);
        throw new Error(`Dashboard API failed: ${dashboardRes.status}`);
      }
      if (!bettingRes.ok) {
        console.error('Betting games API failed:', bettingRes.status, bettingRes.statusText);
        throw new Error(`Betting games API failed: ${bettingRes.status}`);
      }
      if (!gamesOfDayRes.ok) {
        console.error('Games of day API failed:', gamesOfDayRes.status, gamesOfDayRes.statusText);
        throw new Error(`Games of day API failed: ${gamesOfDayRes.status}`);
      }
      if (!performanceRes.ok) {
        console.error('Performance API failed:', performanceRes.status, performanceRes.statusText);
        throw new Error(`Performance API failed: ${performanceRes.status}`);
      }

      const [dashboardData, bettingData, gamesOfDayData, performanceData] = await Promise.all([
        dashboardRes.json(),
        bettingRes.json(),
        gamesOfDayRes.json(),
        performanceRes.json()
      ]);

      console.log('🎯 FRONTEND LOG - Fetched betting games:', bettingData); // DEBUG LOG
      console.log('🎯 FRONTEND LOG - Games count:', bettingData.games?.length || bettingData.length); // DEBUG LOG
      console.log('🎯 FRONTEND LOG - Fetched games of the day:', gamesOfDayData); // DEBUG LOG

      setDashboardData(dashboardData);
      
      // Handle betting games data properly
      let gamesToSet = [];
      if (Array.isArray(bettingData)) {
        // Old format - direct array
        gamesToSet = bettingData;
      } else if (bettingData && Array.isArray(bettingData.games)) {
        // New format - object with games property
        gamesToSet = bettingData.games;
      } else {
        console.warn('⚠️ Unexpected betting data format:', bettingData);
        gamesToSet = [];
      }
      
      console.log('🎯 FRONTEND LOG - Setting betting games:', gamesToSet.length, 'games');
      
      // Stable sort to prevent cards from jumping around (same as SSE refresh)
      if (gamesToSet.length > 0) {
        const sortedBettingData = [...gamesToSet].sort((a, b) => {
          // First sort by date, then by ID for stability
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return a.id.localeCompare(b.id);
        });
        setBettingGames(sortedBettingData);
      } else {
        setBettingGames([]);
      }
      
      // Stable sort for games of day as well
      if (Array.isArray(gamesOfDayData) && gamesOfDayData.length > 0) {
        const sortedGamesOfDayData = [...gamesOfDayData].sort((a, b) => {
          // First sort by date, then by ID for stability
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return a.id.localeCompare(b.id);
        });
        setGamesOfDay(sortedGamesOfDayData);
      } else {
        setGamesOfDay(Array.isArray(gamesOfDayData) ? gamesOfDayData : []);
      }
      setLastGamesPerformance(performanceData.lastGamesPerformance || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") {
      console.log('⏳ Dashboard: Session status is loading, skipping fetch');
      return;
    }
    if (!session) {
      console.log('🚫 Dashboard: No session, redirecting to login');
      router.push("/login");
      return;
    }
    
    // Only fetch on mount or when session ID actually changes (not on every render)
    const sessionId = session?.user?.id;
    const lastSessionId = lastSessionIdRef.current;
    
    // Only fetch if:
    // 1. We haven't fetched yet (lastSessionId is null), OR
    // 2. The session ID actually changed (and both are defined)
    const shouldFetch = lastSessionId === null || (sessionId && lastSessionId !== sessionId);
    
    if (shouldFetch && sessionId) {
      console.log('🔄 Dashboard: Triggering fetchDashboardData', {
        reason: lastSessionId === null ? 'Initial mount' : `Session changed (${lastSessionId} → ${sessionId})`,
        sessionId,
        status,
        routerPath: router.pathname,
      });
      lastSessionIdRef.current = sessionId;
      fetchDashboardData();
    } else {
      console.log('⏭️ Dashboard: Skipping fetch - same session ID', { 
        sessionId,
        lastSessionId,
        status,
        routerPath: router.pathname,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, status, fetchDashboardData]); // router is stable, session object changes too often

  // Register the refresh function with the live scores hook
  useEffect(() => {
    registerRefreshFunction(refreshGameData);
  }, [registerRefreshFunction, refreshGameData]);

  // No periodic refresh - only refresh when countdown ends or page loads

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-32" style={{ backgroundColor: '#f7f8fa' }}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32" style={{ backgroundColor: '#f7f8fa' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f7f8fa' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10">








        {/* First row: Countdown Timer + Active Competitions + News */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left column: Countdown Timer + Active Competitions */}
            <div className="w-full flex flex-col gap-6">
              {/* Countdown Timer */}
              {(() => {
                // Smart countdown logic: prioritize today's games, fallback to future games
                let upcomingGames = [];
                
                if (gamesOfDay && gamesOfDay.length > 0) {
                  // Check if there are upcoming games today
                  const upcomingToday = gamesOfDay.filter(game => 
                    game.status === 'UPCOMING' && 
                    new Date(game.date).getTime() > new Date().getTime()
                  );
                  
                  if (upcomingToday.length > 0) {
                    // Use today's upcoming games
                    upcomingGames = upcomingToday;
                  } else {
                    // Today's games are started/finished, use future games
                    upcomingGames = bettingGames || [];
                  }
                } else {
                  // No games today, use future games
                  upcomingGames = bettingGames || [];
                }

                // Filter and sort upcoming games (ensure upcomingGames is an array)
                upcomingGames = (Array.isArray(upcomingGames) ? upcomingGames : [])
                  .filter(game => game.status === 'UPCOMING' || game.status === 'LIVE')
                  .filter(game => new Date(game.date).getTime() > new Date().getTime())
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                const nextGame = upcomingGames[0];

                if (!nextGame) {
                  return null;
                }

                const handleCountdownComplete = () => {
                  console.log('⏰ Countdown completed - Triggering full dashboard refresh');
                  fetchDashboardData();
                };

                return (
                  <CountdownTimer 
                    key={nextGame.id}
                    nextGameDate={nextGame.date}
                    onCountdownComplete={handleCountdownComplete}
                    upcomingGames={upcomingGames.slice(0, 10)}
                  />
                );
              })()}
              {/* Active Competitions */}
              <ActiveCompetitionsSection
                competitions={dashboardData?.activeCompetitions || []}
                t={t}
              />
            </div>
            {/* Right column: News */}
            <div className="w-full">
              <News />
            </div>
          </div>
        </div>
        {false && bettingGames && bettingGames.length > 0 && (() => {
          // moved above into the first-row grid
          return null;
        })()}

        <section className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-[1.15rem] flex items-center">
            <span className="p-3 bg-primary-600 rounded-full shadow-lg flex items-center justify-center mr-3">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </span>
            Performance des derniers matchs
          </h2>
          <PersonalStatsSection stats={dashboardData?.stats || null} lastGamesPerformance={lastGamesPerformance} />
        </section>

        {gamesOfDay && gamesOfDay.length > 0 && (
          <div className="mb-8">
            <GamesOfDaySection 
              games={gamesOfDay}
              t={t}
              highlightedGames={highlightedGames}
            />
          </div>
        )}

        <div className="mb-8">
          <BettingGamesSection 
            games={bettingGames || []}
            t={t}
            highlightedGames={highlightedGames}
          />
        </div>

        {/* SSE Connection Status Footer - Subtle, at bottom */}
        <div className="mt-12 mb-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            {/* Connection Status - Left side only */}
            <div className="flex items-center space-x-1.5">
              {connectionStatus === 'connected' && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span>En ligne</span>
                </>
              )}
              {connectionStatus === 'connecting' && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                  <span>Connexion...</span>
                </>
              )}
              {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <span>Hors ligne</span>
                </>
              )}
            </div>
            
            {/* All other info - Right side */}
            <div className="flex items-center space-x-4">
              {/* Live Updates - Only show when active */}
              {(hasChanges || signalCount > 0) && (
                <div className="flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span>
                    {hasChanges ? 'Mise à jour' : `Signal ${signalCount}`}
                  </span>
                  {lastSignalId && (
                    <span className="font-mono text-xs text-gray-400 ml-1">
                      ({lastSignalId})
                    </span>
                  )}
                </div>
              )}
              
              {/* Timestamp - Shows when last update occurred */}
              {lastUpdate && (
                <span className="text-gray-400 font-mono text-xs">
                  {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
  };
}; 