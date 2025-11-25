import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { useTranslation } from '../../hooks/useTranslation';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { prisma } from '../../lib/prisma';
import { TrophyIcon, CalendarIcon, UsersIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import PlayersPerformanceWidget from '../../components/PlayersPerformanceWidget';
import RankingEvolutionWidget from '../../components/RankingEvolutionWidget';
import PlayerPointsProgressionWidget from '../../components/PlayerPointsProgressionWidget';

interface CompetitionUser {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  competitionId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    profilePictureUrl: string | null;
  };
}

interface Bet {
  id: string;
  points: number;
  userId: string;
  gameId: string;
}

interface Game {
  id: string;
  date: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
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
  bets: Array<{
    id: string;
    userId: string;
    score1: number | null;
    score2: number | null;
    user: {
      id: string;
      name: string;
      profilePictureUrl?: string | null;
    };
  }>;
}

interface CompetitionStats {
  userId: string;
  userName: string;
  profilePictureUrl?: string;
  totalPoints: number;
  totalPredictions: number;
  accuracy: number;
  exactScores: number;
  correctWinners: number;
  position: number;
  shooters?: number;
}

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

interface CompetitionDetailsProps {
  competition: {
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    status: string;
    winner?: {
      id: string;
      name: string;
    };
    lastPlace?: {
      id: string;
      name: string;
    };
    users: CompetitionUser[];
    _count: {
      games: number;
      users: number;
    };
    logo?: string;
  };
  competitionStats: CompetitionStats[];
  games: Game[];
  currentUserId: string;
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

export default function CompetitionDetails({ competition, competitionStats, games, currentUserId }: CompetitionDetailsProps) {
  const { t } = useTranslation('common');
  const [showAllGames, setShowAllGames] = useState(false);
  const [gamesWithBets, setGamesWithBets] = useState<Map<string, any[]>>(new Map());
  const [loadingBets, setLoadingBets] = useState<Set<string>>(new Set());
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [playersPerformance, setPlayersPerformance] = useState<PlayerPerformance[]>([]);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('position');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  

  // Toggle game expansion
  const toggleGameExpansion = (gameId: string) => {
    setExpandedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with appropriate default direction
      setSortColumn(column);
      // Position and Player default to ascending, all others default to descending
      const defaultDirection: 'asc' | 'desc' = (column === 'position' || column === 'player') ? 'asc' : 'desc';
      setSortDirection(defaultDirection);
    }
  };

  // Sort competition stats
  const sortedStats = [...competitionStats].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'position':
        aValue = a.position;
        bValue = b.position;
        break;
      case 'player':
        aValue = a.userName.toLowerCase();
        bValue = b.userName.toLowerCase();
        break;
      case 'points':
        aValue = a.totalPoints;
        bValue = b.totalPoints;
        break;
      case 'games':
        aValue = a.totalPredictions;
        bValue = b.totalPredictions;
        break;
      case 'average':
        aValue = a.totalPredictions > 0 ? a.totalPoints / a.totalPredictions : 0;
        bValue = b.totalPredictions > 0 ? b.totalPoints / b.totalPredictions : 0;
        break;
      case 'exactScores':
        aValue = a.exactScores || 0;
        bValue = b.exactScores || 0;
        break;
      case 'correctWinners':
        aValue = a.correctWinners || 0;
        bValue = b.correctWinners || 0;
        break;
      case 'shooters':
        aValue = a.shooters || 0;
        bValue = b.shooters || 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const fetchGameBets = async (gameId: string) => {
    if (gamesWithBets.has(gameId) || loadingBets.has(gameId)) {
      return; // Already loaded or loading
    }

    setLoadingBets(prev => new Set(prev).add(gameId));
    
    try {
      const response = await fetch(`/api/games/${gameId}/bets`);
      if (response.ok) {
        const bets = await response.json();
        setGamesWithBets(prev => new Map(prev).set(gameId, bets));
      }
    } catch (error) {
      console.error('Error fetching game bets:', error);
    } finally {
      setLoadingBets(prev => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
    }
  };

  const fetchPlayersPerformance = async () => {
    if (loadingPerformance) return;
    
    setLoadingPerformance(true);
    try {
      const response = await fetch(`/api/competitions/${competition.id}/players-performance`);
      if (response.ok) {
        const data = await response.json();
        setPlayersPerformance(data.playersPerformance || []);
      }
    } catch (error) {
      console.error('Error fetching players performance:', error);
    } finally {
      setLoadingPerformance(false);
    }
  };


  // Fetch players performance on component mount
  useEffect(() => {
    fetchPlayersPerformance();
  }, [competition.id]);



  const getPositionColor = (position: number) => {
    switch (position) {
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2: return 'bg-gray-100 text-gray-800 border-gray-200';
      case 3: return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) return '🏆';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    if (position === competitionStats.length) return '🍕'; // Pizza (dinner host)
    return `#${position}`;
  };

  const getUserAvatar = (userName: string, profilePictureUrl?: string) => {
    if (profilePictureUrl) {
      return profilePictureUrl;
    }
    // Fallback to generated avatar if no profile picture
    const userId = userName.toLowerCase();
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  };

  // Translate competition status to French
  const translateCompetitionStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'UPCOMING': t('upcoming'),
      'upcoming': t('upcoming'),
      'ACTIVE': t('active'),
      'active': t('active'),
      'COMPLETED': t('completed'),
      'completed': t('completed'),
      'CANCELLED': t('cancelled'),
      'cancelled': t('cancelled'),
    };
    return statusMap[status] || status;
  };

  // Mapping from competition names to translation keys
  const descriptionKeyMap: Record<string, string> = {
    "UEFA Champions League 24/25": "uefaChampionsLeague",
    "World Cup 2026": "worldCup2026",
    // Add more competitions as needed
  };
  const descriptionKey = descriptionKeyMap[competition.name] || null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f8fa' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            {competition.logo ? (
              <img 
                src={competition.logo} 
                alt={`${competition.name} logo`}
                className="h-12 w-12 object-contain"
              />
            ) : (
              <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center">
                <TrophyIcon className="h-8 w-8 text-white" />
              </div>
            )}
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">
              {competition.name}
            </h1>
          </div>
          <p className="text-gray-600">
            {descriptionKey ? t(`competitionDescriptions.${descriptionKey}`) : competition.description}
          </p>
        </div>

        {/* Competition Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {/* Period */}
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <CalendarIcon className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <div className="text-[10px] sm:text-xs md:text-xs lg:text-sm text-gray-900 text-center flex-1 min-w-0">
                <div className="space-y-0.5 md:space-y-1">
                  <p className="font-bold text-[10px] sm:text-xs md:text-xs lg:text-sm whitespace-nowrap leading-tight">{formatDate(competition.startDate)}</p>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-[10px] lg:text-xs">{t('competition.to')}</p>
                  <p className="font-bold text-[10px] sm:text-xs md:text-xs lg:text-sm whitespace-nowrap leading-tight">{formatDate(competition.endDate)}</p>
                </div>
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900">{t('competition.period')}</h3>
          </div>

          {/* Participants */}
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <UsersIcon className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <span className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{competition._count.users}</span>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900">{t('competition.participants')}</h3>
          </div>

          {/* Games */}
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <span className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900">{competition._count.games}</span>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900">{t('competition.matches')}</h3>
          </div>

          {/* Status */}
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <span className="text-white text-base md:text-lg font-bold">
                  {competition.status === 'ACTIVE' || competition.status === 'active' ? '▶' : 
                   competition.status === 'UPCOMING' || competition.status === 'upcoming' ? '⏳' :
                   competition.status === 'COMPLETED' || competition.status === 'completed' ? '✓' :
                   competition.status === 'CANCELLED' || competition.status === 'cancelled' ? '✗' : '?'}
                </span>
              </div>
              <span className="text-sm md:text-base lg:text-lg font-bold text-gray-900 truncate">{translateCompetitionStatus(competition.status)}</span>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900">{t('competition.status')}</h3>
          </div>
        </div>

        {/* Competition Progress Bar */}
        <div className="bg-white rounded-xl shadow-2xl border border-gray-300 p-6 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
                <ChartBarIcon className="h-5 w-5 text-white" />
              </div>
              <span className="md:hidden">Progression</span>
              <span className="hidden md:inline">Progression de la compétition</span>
            </h3>
            <div className="text-sm md:text-base text-gray-600 font-bold">
              {games.filter(g => g.status === 'FINISHED').length} / {competition._count.games} matchs joués
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-8 relative">
            <div 
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-8 rounded-full transition-all duration-500 ease-out flex items-center justify-center relative"
              style={{ 
                width: `${competition._count.games > 0 ? (games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100 : 0}%` 
              }}
            >
              <span className="text-white font-bold text-sm drop-shadow-sm">
                {competition._count.games > 0 ? Math.round((games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span className="font-bold">0%</span>
            <span className="font-bold">100%</span>
          </div>
        </div>

        {/* Winner & Last Place - Only for completed competitions */}
        {(competition.status === 'COMPLETED' || competition.status === 'completed') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Winner */}
            <div className={`bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-6 ${!competition.winner ? 'opacity-60' : ''}`}>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-500 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                    🏆
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yellow-800">{t('competition.champion')}</h3>
                  <p className="text-lg md:text-xl lg:text-2xl font-bold text-yellow-900">{competition.winner ? competition.winner.name : '—'}</p>
                  <p className="text-sm text-yellow-700">{competition.winner ? t('competition.competitionWinner') : t('competition.noWinnerSet')}</p>
                </div>
              </div>
            </div>
            {/* Last Place */}
            <div className={`bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-6 ${!competition.lastPlace ? 'opacity-60' : ''}`}>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-red-500 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                    🍽️
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-800">{t('competition.dinnerHost')}</h3>
                  <p className="text-lg md:text-xl lg:text-2xl font-bold text-red-900">{competition.lastPlace ? competition.lastPlace.name : '—'}</p>
                  <p className="text-sm text-red-700">{competition.lastPlace ? t('competition.owesEveryoneDinner') : t('competition.noWinnerSet')}</p>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Current Ranking Section - Always visible for better UX */}
        <div className="bg-white rounded-xl shadow-2xl border border-gray-300 overflow-hidden mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center">
              <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
                <TrophyIcon className="h-6 w-6 text-white" />
              </div>
              {(competition.status === 'COMPLETED' || (competition.status === 'COMPLETED' || competition.status === 'completed')) ? t('competition.finalRanking') : 'Classement en cours'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {competitionStats && competitionStats.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="w-8 md:w-16 px-1 md:px-4 py-1.5 md:py-2.5 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('position')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.position')}
                          </span>
                          {sortColumn === 'position' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.position').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'position' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-16 md:w-48 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('player')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.player')}
                          </span>
                          {sortColumn === 'player' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.player').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'player' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-8 md:w-24 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('points')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.points')}
                          </span>
                          {sortColumn === 'points' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.points').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'points' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-8 md:w-20 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('games')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.games')}
                          </span>
                          {sortColumn === 'games' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.games').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'games' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-8 md:w-24 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('average')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.average')}
                          </span>
                          {sortColumn === 'average' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.average').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'average' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-8 md:w-24 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('exactScores')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.exactScores')}
                          </span>
                          {sortColumn === 'exactScores' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.exactScores').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'exactScores' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-8 md:w-28 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('correctWinners')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.correctWinners')}
                          </span>
                          {sortColumn === 'correctWinners' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.correctWinners').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'correctWinners' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-8 md:w-20 px-1 md:px-4 py-2 md:py-3 text-center md:cursor-pointer md:hover:bg-gray-100 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('shooters')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t('competition.shooters')}
                          </span>
                          {sortColumn === 'shooters' && (
                            <span className="text-gray-700 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          {t('competition.shooters').split(' ').map((word, idx) => (
                            <span key={idx} className="text-[7px] font-bold text-gray-500 uppercase tracking-wider leading-none">
                              {word}
                            </span>
                          ))}
                          {sortColumn === 'shooters' && (
                            <span className="hidden md:inline text-gray-700 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedStats.slice(0, 10).map((player, index) => {
                    // Determine row highlighting based on original position
                    const isFirst = player.position === 1;
                    const isSecond = player.position === 2;
                    const isThird = player.position === 3;
                    const isLast = player.position === competitionStats.length;
                    const isCurrentUser = player.userId === currentUserId;
                    
                    let rowBgClass = '';
                    let rowBorderClass = '';
                    
                    if (isCurrentUser) {
                      rowBgClass = 'bg-blue-50';
                      rowBorderClass = '';
                    } else if (isFirst) {
                      rowBgClass = 'bg-yellow-50/70';
                      rowBorderClass = '';
                    } else if (isSecond) {
                      rowBgClass = 'bg-gray-50/75';
                      rowBorderClass = '';
                    } else if (isThird) {
                      rowBgClass = 'bg-orange-50/70';
                      rowBorderClass = '';
                    } else if (isLast) {
                      rowBgClass = 'bg-red-50/70';
                      rowBorderClass = '';
                    }
                    
                    return (
                    <tr key={player.userId} className={`hover:bg-gray-50 ${rowBgClass} ${rowBorderClass}`}>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200">
                        <div className={`inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full border-2 font-bold text-[10px] md:text-sm ${getPositionColor(player.position)}`}>
                          {getPositionIcon(player.position)}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap border-r border-gray-200">
                        {/* Mobile: Name below profile pic */}
                        <div className="flex md:hidden flex-col items-center min-w-0">
                          <img 
                            src={getUserAvatar(player.userName, player.profilePictureUrl)} 
                            alt={player.userName}
                            className="w-8 h-8 rounded-full mb-1 object-cover border-2 border-gray-200 flex-shrink-0"
                          />
                          <div className="min-w-0 w-full text-center">
                            <div className="text-[10px] font-medium text-gray-900 truncate">{player.userName}</div>
                            {(competition.status === 'COMPLETED' || competition.status === 'completed') && player.position === 1 && <div className="text-[9px] text-yellow-600 font-medium">{t('competition.champion')}</div>}
                            {(competition.status === 'COMPLETED' || competition.status === 'completed') && player.position === competitionStats.length && <div className="text-[9px] text-red-600 font-medium">{t('competition.dinnerHost')}</div>}
                          </div>
                        </div>
                        {/* Desktop: Name next to profile pic */}
                        <div className="hidden md:flex items-center min-w-0">
                          <img 
                            src={getUserAvatar(player.userName, player.profilePictureUrl)} 
                            alt={player.userName}
                            className="w-10 h-10 rounded-full mr-3 object-cover border-2 border-gray-200 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">{player.userName}</div>
                            {(competition.status === 'COMPLETED' || competition.status === 'completed') && player.position === 1 && <div className="text-xs text-yellow-600 font-medium">{t('competition.champion')}</div>}
                            {(competition.status === 'COMPLETED' || competition.status === 'completed') && player.position === competitionStats.length && <div className="text-xs text-red-600 font-medium">{t('competition.dinnerHost')}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200">
                        <div className="text-sm md:text-lg font-bold text-gray-900">{player.totalPoints}</div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200">
                        <div className="text-[10px] md:text-sm text-gray-900">{player.totalPredictions}</div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200">
                        <div className="text-[10px] md:text-sm text-gray-900">
                          {player.totalPredictions > 0 ? (player.totalPoints / player.totalPredictions).toFixed(2) : '0.00'}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200">
                        <div className="text-[10px] md:text-sm text-gray-900">{player.exactScores || 0}</div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200">
                        <div className="text-[10px] md:text-sm text-gray-900">{player.correctWinners || 0}</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-center">
                        <div className="text-[10px] md:text-sm text-gray-900">{player.shooters || 0}</div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>{t('competition.noParticipantsYet')}</p>
              </div>
            )}
          </div>
          {competitionStats.length > 10 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
              <span className="text-sm text-gray-600">
                {t('competition.showingTop')} 10 {t('competition.of')} {competitionStats.length} {t('competition.participants')}
              </span>
              <button 
                onClick={() => {/* TODO: Implement full ranking modal or page */}}
                className="ml-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {t('competition.viewFullRanking')}
              </button>
            </div>
          )}
        </div>

        {/* Players Performance Widget - Only show if there are finished games - Hidden on mobile */}
        {playersPerformance.length > 0 && (
          <div className="hidden md:block">
            <PlayersPerformanceWidget
              playersPerformance={playersPerformance}
              competitionName={competition.name}
              totalGames={playersPerformance[0]?.lastGamesPerformance.length || 0}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* Ranking Evolution Widget - Only show if there are finished games - Hidden on mobile */}
        {playersPerformance.length > 0 && (
          <div className="hidden md:block">
            <RankingEvolutionWidget
              competitionId={competition.id}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* Player Points Progression Widget - Only show if there are finished games - Hidden on mobile */}
        {playersPerformance.length > 0 && (
          <div className="hidden md:block">
            <PlayerPointsProgressionWidget
              competitionId={competition.id}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {/* Games Section */}
        <div className="bg-white rounded-2xl border border-gray-300 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', overflow: 'hidden' }}>
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center">
                <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
                  <ChartBarIcon className="h-6 w-6 text-white" />
                </div>
                <span className="md:hidden">
                  {showAllGames ? 'Tous les Matchs' : 'Matchs à Parier'}
                </span>
                <span className="hidden md:inline">
                  {showAllGames ? t('competition.allCompetitionGames') : t('competition.gamesAvailableForBetting')}
                </span>
              </h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  {showAllGames ? games.length : games.filter(g => g.status === 'UPCOMING' || g.status === 'LIVE').length} {t('competition.games')}
                </div>
                <button
                  onClick={() => setShowAllGames(!showAllGames)}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors duration-200"
                >
                  {showAllGames ? t('competition.showBettingGames') : t('competition.showAllGames')}
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {(() => {
              const filteredGames = showAllGames ? games : games.filter(g => g.status === 'UPCOMING' || g.status === 'LIVE');
              // Sort finished games first (most recent first), then upcoming/live games chronologically
              const sortedGames = [...filteredGames].sort((a, b) => {
                if (showAllGames) {
                  // For all games: finished games first (most recent first), then upcoming/live (chronological)
                  const aIsFinished = a.status === 'FINISHED';
                  const bIsFinished = b.status === 'FINISHED';
                  
                  if (aIsFinished && !bIsFinished) return -1;
                  if (!aIsFinished && bIsFinished) return 1;
                  if (aIsFinished && bIsFinished) {
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                  }
                  // For upcoming/live games: chronological order (earliest first)
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
                } else {
                  // For betting games: chronological order (earliest first)
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
                }
              });
              return sortedGames && sortedGames.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                  {sortedGames.map((game) => {
                    // Only UPCOMING games are clickable for betting
                    const isOpen = game.status === 'UPCOMING';
                    const userHasBet = game.bets.some(bet => bet.userId === currentUserId);
                    
                    // Determine border color based on user bet (same as home page)
                    const getBorderColor = () => {
                      if (userHasBet) {
                        return 'border-blue-400 border-2'; // Blue border for games with bets
                      }
                      return 'border-neutral-200';
                    };
                    
                    const getBackgroundColor = () => {
                      if (userHasBet) {
                        return 'bg-blue-50'; // Light blue background for games with bets
                      }
                      return 'bg-neutral-50'; // Default neutral background
                    };
                    
                    const cardContent = (
                      <div className={`${getBackgroundColor()} border rounded-xl md:rounded-2xl shadow flex flex-col items-stretch transition ${
                        isOpen ? 'hover:shadow-lg hover:border-primary-400 cursor-pointer' : 
                        game.status === 'FINISHED' ? 'hover:shadow-lg hover:border-primary-400 cursor-pointer' : 'cursor-default'
                      } p-3 md:p-4 lg:p-5 gap-2 md:gap-3 ${getBorderColor()}`}
                        onClick={() => {
                          if (isOpen) {
                            // Navigate to betting page for upcoming games only
                            window.location.href = `/betting/${game.id}`;
                          } else if (game.status === 'FINISHED') {
                            // Toggle expansion for finished games
                            toggleGameExpansion(game.id);
                            // Fetch bets if not already loaded
                            if (!gamesWithBets.has(game.id)) {
                              fetchGameBets(game.id);
                            }
                          }
                          // LIVE games are not clickable (no action)
                        }}
                        >
                          {/* Date & Status */}
                          <div className="flex items-center w-full justify-between pb-2 md:pb-3 border-b border-neutral-200">
                            <div className="flex flex-col md:flex-row md:items-center md:space-x-1 md:space-x-2">
                              {(() => {
                                const date = new Date(game.date);
                                const day = String(date.getDate()).padStart(2, '0');
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = String(date.getFullYear()).slice(-2);
                                const hour = String(date.getHours()).padStart(2, '0');
                                const minute = String(date.getMinutes()).padStart(2, '0');
                                return (
                                  <>
                                    <span className="text-[9px] md:text-[10px] lg:text-xs text-neutral-500">
                                      {`${day}/${month}/${year}`}
                                    </span>
                                    <span className="text-[9px] md:text-[10px] lg:text-xs text-neutral-500 md:ml-1">
                                      {`${hour}:${minute}`}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-1">
                              {userHasBet && (
                                <div className="flex items-center">
                                  <div className="flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-blue-100 rounded-full">
                                    <span className="text-blue-600 text-[10px] md:text-xs font-bold">✓</span>
                                  </div>
                                </div>
                              )}
                              <span className={`inline-block px-2.5 md:px-2 py-1 md:py-1 text-[10px] md:text-[10px] lg:text-xs rounded-full whitespace-nowrap ${
                                game.status === 'FINISHED' ? 'bg-green-100 text-green-800' :
                                game.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
                                game.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {game.status === 'UPCOMING' && t('upcoming')}
                                {game.status === 'FINISHED' && t('finished')}
                                {game.status === 'LIVE' && t('live')}
                                {game.status === 'CANCELLED' && t('cancelled')}
                                {!['UPCOMING', 'FINISHED', 'LIVE', 'CANCELLED'].includes(game.status) && game.status}
                              </span>
                              {game.status === 'FINISHED' && (
                                <span className="hidden md:inline text-[9px] md:text-[10px] lg:text-xs text-primary-600 font-medium ml-1 md:ml-2">
                                  {loadingBets.has(game.id) ? 'Chargement...' : 'Voir les paris'}
                                </span>
                              )}
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
                                  <span className="text-gray-900 font-medium text-[10px] text-center leading-tight line-clamp-2">{game.homeTeam.shortName || game.homeTeam.name}</span>
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
                              <span className="text-sm md:text-base lg:text-lg font-bold text-gray-900">
                                {game.status === 'FINISHED' && typeof game.homeScore === 'number' && typeof game.awayScore === 'number'
                                  ? `${game.homeScore} - ${game.awayScore}`
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
                                  <span className="text-gray-900 font-medium text-[10px] text-center leading-tight line-clamp-2">{game.awayTeam.shortName || game.awayTeam.name}</span>
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
                                      <span className="text-[10px] md:text-xs font-mono text-gray-900 bg-gray-100 rounded px-1.5 md:px-2 py-0.5 ml-auto">{bet.score1} - {bet.score2}</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Mobile: "Voir les paris" at bottom for finished games */}
                          {game.status === 'FINISHED' && !expandedGames.has(game.id) && (
                            <div className="md:hidden pt-2 border-t border-neutral-200">
                              <span className="text-[10px] text-primary-600 font-medium">
                                {loadingBets.has(game.id) ? 'Chargement...' : 'Voir les paris'}
                              </span>
                            </div>
                          )}
                          
                          {/* Expanded Bets Section for Finished Games */}
                          {game.status === 'FINISHED' && expandedGames.has(game.id) && (
                            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-neutral-200">
                              <div className="flex items-center justify-between mb-2 md:mb-3">
                                <h4 className="hidden md:block text-xs md:text-sm font-semibold text-gray-900">
                                  Paris détaillés - {game.homeTeam.name} vs {game.awayTeam.name}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleGameExpansion(game.id);
                                  }}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              
                              {loadingBets.has(game.id) ? (
                                <div className="flex items-center justify-center py-3 md:py-4">
                                  <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-primary-600"></div>
                                  <span className="ml-2 text-xs md:text-sm text-gray-600">Chargement des paris...</span>
                                </div>
                              ) : (
                                <div>
                                  {gamesWithBets.get(game.id)?.length && gamesWithBets.get(game.id)!.length > 0 ? (
                                    <div className="space-y-1.5 md:space-y-2">
                                      {gamesWithBets.get(game.id)?.map((bet) => (
                                        <div key={bet.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg">
                                          <div className="flex items-center space-x-1.5 md:space-x-2">
                                            {bet.user.profilePictureUrl ? (
                                              <img 
                                                src={bet.user.profilePictureUrl} 
                                                alt={bet.user.name}
                                                className="w-5 h-5 md:w-6 md:h-6 rounded-full"
                                              />
                                            ) : (
                                              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] md:text-xs font-medium text-gray-600">
                                                {bet.user.name.charAt(0)}
                                              </div>
                                            )}
                                            <div>
                                              <p className="text-xs md:text-sm font-medium text-gray-900">{bet.user.name}</p>
                                              <p className="text-[10px] md:text-xs text-gray-500">
                                                {bet.score1} - {bet.score2}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className={`text-xs md:text-sm font-bold ${
                                              bet.points === 3 ? 'text-yellow-600' :
                                              bet.points === 1 ? 'text-green-600' :
                                              'text-red-600'
                                            }`}>
                                              {bet.points} pt{bet.points > 1 ? 's' : ''}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-3 md:py-4 text-xs md:text-sm text-gray-500">
                                      Aucun pari trouvé pour ce match
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                    );
                    return isOpen ? (
                      <Link href={`/betting/${game.id}`} key={game.id} className="block">
                        {cardContent}
                      </Link>
                    ) : (
                      <div key={game.id}>{cardContent}</div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">{t('competition.noActiveGamesFound')}</div>
              );
            })()}
          </div>
        </div>

        {/* Competition Summary */}
        <div className="bg-white rounded-xl shadow-2xl border border-gray-300 p-6" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <ChartBarIcon className="h-6 w-6 text-primary-600 mr-2" />
            {t('competition.competitionSummary')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-blue-600">
                {competitionStats.reduce((sum, player) => sum + player.totalPoints, 0)}
              </div>
              <div className="text-sm text-gray-600">{t('competition.totalPoints')}</div>
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-green-600">
                {competitionStats.reduce((sum, player) => sum + player.exactScores, 0)}
              </div>
              <div className="text-sm text-gray-600">{t('competition.totalExactScores')}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  const { id } = context.params!;

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  try {
    const startTime = Date.now();
    console.log(`[PERF] Starting competition data fetch for ${id}`);
    
    // OPTIMIZED: Single query to fetch all competition data with joins
    const competition = await prisma.competition.findUnique({
      where: { id: id as string },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        status: true,
        logo: true,
        winner: {
          select: { id: true, name: true }
        },
        lastPlace: {
          select: { id: true, name: true }
        },
        users: {
          select: {
            shooters: true,
            user: {
              select: { id: true, name: true, profilePictureUrl: true }
            }
          }
        },
        _count: {
          select: { games: true, users: true }
        }
      }
    });

    if (!competition) {
      return {
        notFound: true,
      };
    }

    // OPTIMIZED: Fetch games without bets first (for performance)
    const games = await prisma.game.findMany({
      where: { competitionId: competition.id },
      select: {
        id: true,
        date: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: {
          select: { id: true, name: true, logo: true, shortName: true }
        },
        awayTeam: {
          select: { id: true, name: true, logo: true, shortName: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    // OPTIMIZED: Only load bets for games that need them (upcoming/live games for betting)
    const gamesNeedingBets = games.filter(game => 
      game.status === 'UPCOMING' || game.status === 'LIVE'
    );

    let gamesWithBets: any[] = [];
    if (gamesNeedingBets.length > 0) {
      gamesWithBets = await prisma.game.findMany({
        where: { 
          competitionId: competition.id,
          id: { in: gamesNeedingBets.map(g => g.id) }
        },
        select: {
          id: true,
          bets: {
            select: {
              id: true,
              userId: true,
              score1: true,
              score2: true,
              user: {
                select: { id: true, name: true, profilePictureUrl: true }
              }
            }
          }
        }
      });
    }

    // Merge bets back into games
    const gamesMap = new Map(gamesWithBets.map(g => [g.id, g.bets]));
    games.forEach(game => {
      (game as any).bets = gamesMap.get(game.id) || [];
    });

    // OPTIMIZED: Single query to get all user bets for this competition
    // Only count bets from finished games for the leaderboard
    const allUserBets = await prisma.bet.findMany({
      where: {
        game: {
          competitionId: competition.id,
          status: 'FINISHED' // Only count bets from finished games
        }
      },
      select: {
        userId: true,
        points: true
      }
    });

    // OPTIMIZED: Process stats in memory instead of N+1 queries
    const userBetMap = new Map<string, { 
      totalPoints: number; 
      totalPredictions: number; 
      exactScores: number; 
      correctWinners: number; 
    }>();
    
    // Group bets by user
    allUserBets.forEach(bet => {
      const existing = userBetMap.get(bet.userId);
      if (existing) {
        existing.totalPoints += bet.points;
        existing.totalPredictions += 1;
        if (bet.points === 3) {
          existing.exactScores += 1;
        }
        if (bet.points === 1) {
          existing.correctWinners += 1;
        }
      } else {
        userBetMap.set(bet.userId, {
          totalPoints: bet.points,
          totalPredictions: 1,
          exactScores: bet.points === 3 ? 1 : 0,
          correctWinners: bet.points === 1 ? 1 : 0
        });
      }
    });

    // Build competition stats from the map
    const competitionStats = competition.users.map(competitionUser => {
      const user = competitionUser.user;
      const userStats = userBetMap.get(user.id) || { 
        totalPoints: 0, 
        totalPredictions: 0, 
        exactScores: 0, 
        correctWinners: 0 
      };
      
      return {
        userId: user.id,
        userName: user.name,
        profilePictureUrl: user.profilePictureUrl,
        totalPoints: userStats.totalPoints,
        totalPredictions: userStats.totalPredictions,
        exactScores: userStats.exactScores,
        correctWinners: userStats.correctWinners,
        shooters: competitionUser.shooters || 0,
        position: 0 // Will be set after sorting
      };
    });

    // Sort by points and assign positions
    competitionStats.sort((a, b) => b.totalPoints - a.totalPoints);
    competitionStats.forEach((player, index) => {
      player.position = index + 1;
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    const totalBetsLoaded = games.reduce((sum, game) => sum + (game as any).bets.length, 0);
    console.log(`[PERF] Competition data fetch completed in ${duration}ms for ${id}`);
    console.log(`[PERF] Participants: ${competitionStats.length}, Games: ${games.length}, Games needing bets: ${gamesNeedingBets.length}, Bets loaded: ${totalBetsLoaded}, Total user bets: ${allUserBets.length}`);

    return {
      props: {
        ...(await serverSideTranslations('fr', ['common'])),
        competition: JSON.parse(JSON.stringify(competition)),
        competitionStats: JSON.parse(JSON.stringify(competitionStats)),
        games: JSON.parse(JSON.stringify(games)),
        currentUserId: session.user.id,
      },
    };
  } catch (error) {
    console.error('Error fetching competition details:', error);
    return {
      notFound: true,
    };
  }
}; 
