import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback, memo } from "react";
import { useTranslation } from '../hooks/useTranslation';
import { GetStaticProps } from 'next';
import { 
  TrophyIcon, 
  ChartBarIcon, 
  PlayIcon,
  ArrowRightIcon,
  HomeIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import GameCard from '../components/GameCard';
import CompetitionCard from '../components/CompetitionCard';

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
  };
  awayTeam: {
    id: string;
    name: string;
    logo?: string | null;
  };
  date: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
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

interface UserRankings {
  pointsRank: number;
  averageRank: number;
  predictionsRank: number;
  winsRank: number;
  longestStreakRank: number;
  exactScoreStreakRank: number;
  totalUsers: number;
}

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

// Personal Stats Section
const PersonalStatsSection = memo(({ stats, lastGamesPerformance }: { stats: UserStats | null; lastGamesPerformance: LastGamePerformance[] }) => {
  if (!stats) return null;

  return (
    <div className="mb-8">
      {/* Performance des 10 Derniers Matchs */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
        <div className="flex space-x-2">
                     {Array.from({ length: 10 }).map((_, index) => {
                       const game = lastGamesPerformance[index];
                       return game ? (
                         <div
                           key={game.gameId}
                           className={`flex-1 h-18 rounded-xl flex flex-col items-center justify-center text-gray-700 font-bold text-sm shadow-modern p-2 bg-white border-2 ${
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
                             <div className="text-[10px] text-gray-600">
                               {new Date(game.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                             </div>
                           </div>
              </div>
            ) : (
              <div
                key={`empty-${index}`}
                className="flex-1 h-18 rounded-xl flex items-center justify-center text-gray-400 font-bold text-sm shadow-modern border-2 border-dashed border-gray-300 bg-white"
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
    <div className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <TrophyIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">{t('competitions.active')}</h2>
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
          <div className="p-3 bg-green-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <TrophyIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">{t('availableCompetitions.title')}</h2>
        </div>
      </div>

      {competitions && competitions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {competitions.slice(0, 3).map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              actionLabel="Rejoindre"
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
const BettingGamesSection = memo(({ games, t }: { games: BettingGame[]; t: (key: string) => string }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  return (
    <div className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <PlayIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">{t('bettingGames.title')}</h2>
        </div>
      </div>

      {games && games.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.slice(0, 6).map((game) => {
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
                    logo: game.homeTeam.logo || undefined
                  },
                  awayTeam: {
                    name: game.awayTeam.name,
                    logo: game.awayTeam.logo || undefined
                  },
                  homeScore: game.homeScore || undefined,
                  awayScore: game.awayScore || undefined,
                  bets: bets
                }} 
                currentUserId={currentUserId} 
                href={`/betting/${game.id}`}
                context="home"
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
const GamesOfDaySection = memo(({ games, t }: { games: BettingGame[]; t: (key: string) => string }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  
  return (
    <div className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-3 bg-orange-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">{t('gamesOfDay.title')}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  logo: game.homeTeam.logo || undefined
                },
                awayTeam: {
                  name: game.awayTeam.name,
                  logo: game.awayTeam.logo || undefined
                },
                homeScore: game.homeScore || undefined,
                awayScore: game.awayScore || undefined,
                bets: bets
              }} 
              currentUserId={currentUserId} 
              href={game.status === 'UPCOMING' || game.status === 'LIVE' ? `/betting/${game.id}` : '#'}
              context="home"
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

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [bettingGames, setBettingGames] = useState<BettingGame[] | null>(null);
  const [gamesOfDay, setGamesOfDay] = useState<BettingGame[] | null>(null);
  const [userRankings, setUserRankings] = useState<UserRankings | null>(null);
  const [lastGamesPerformance, setLastGamesPerformance] = useState<LastGamePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardRes, bettingRes, gamesOfDayRes, rankingsRes, performanceRes] = await Promise.all([
        fetch('/api/user/dashboard'),
        fetch('/api/user/dashboard-betting-games'),
        fetch('/api/user/games-of-day'),
        fetch('/api/stats/user-rankings'),
        fetch('/api/stats/user-performance', { cache: 'no-store' })
      ]);

      if (!dashboardRes.ok || !bettingRes.ok || !gamesOfDayRes.ok || !rankingsRes.ok || !performanceRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [dashboardData, bettingData, gamesOfDayData, rankingsData, performanceData] = await Promise.all([
        dashboardRes.json(),
        bettingRes.json(),
        gamesOfDayRes.json(),
        rankingsRes.json(),
        performanceRes.json()
      ]);

      console.log('Fetched betting games:', bettingData); // DEBUG LOG
      console.log('Fetched games of the day:', gamesOfDayData); // DEBUG LOG

      setDashboardData(dashboardData);
      setBettingGames(bettingData);
      setGamesOfDay(gamesOfDayData);
      setUserRankings(rankingsData);
      setLastGamesPerformance(performanceData.lastGamesPerformance || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    fetchDashboardData();
  }, [session, status, router, fetchDashboardData]);

  if (status === "loading" || loading) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="bg-gray-50 flex items-center justify-center py-32">
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
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-4 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <HomeIcon className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">{t('title')}</h1>
          </div>
        </div>

        <section className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center">
            <span className="p-2 bg-primary-600 rounded-full shadow-lg flex items-center justify-center mr-2">
              <ChartBarIcon className="h-6 w-6 text-white" />
            </span>
            Performance des 10 Derniers Matchs
          </h2>
          <PersonalStatsSection stats={dashboardData?.stats || null} lastGamesPerformance={lastGamesPerformance} />
        </section>

        {gamesOfDay && gamesOfDay.length > 0 && (
          <div className="mb-8">
            <GamesOfDaySection 
              games={gamesOfDay}
              t={t}
            />
          </div>
        )}

        <div className="mb-8">
          <BettingGamesSection 
            games={bettingGames || []}
            t={t}
          />
        </div>

        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <ActiveCompetitionsSection
                competitions={dashboardData?.activeCompetitions || []}
                t={t}
              />
            </div>
            <div className="w-full">
              <AvailableCompetitionsSection
                competitions={dashboardData?.availableCompetitions || []}
                t={t}
              />
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