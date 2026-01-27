import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { useTranslation } from '../../hooks/useTranslation';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { prisma } from '../../lib/prisma';
import { TrophyIcon, CalendarIcon, UsersIcon, ChartBarIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import PlayersPerformanceWidget from '../../components/PlayersPerformanceWidget';
import RankingEvolutionWidget from '../../components/RankingEvolutionWidget';
import PlayerPointsProgressionWidget from '../../components/PlayerPointsProgressionWidget';
import GameCard from '../../components/GameCard';

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
  liveHomeScore?: number | null;
  liveAwayScore?: number | null;
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
    sportType?: string;
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
  isUserMember: boolean;
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

export default function CompetitionDetails({ competition, competitionStats, games, currentUserId, isUserMember }: CompetitionDetailsProps) {
  const { t } = useTranslation('common');
  const [showAllGames, setShowAllGames] = useState(false);
  const [gamesWithBets, setGamesWithBets] = useState<Map<string, any[]>>(new Map());

  // Helper function to render rugby scoring examples with table-like styling
  const renderRugbyExamples = (examplesText: string) => {
    // Split by bullet points
    const examples = examplesText.split('\n•').filter(line => line.trim());
    // Detect language from the text
    const isFrench = examplesText.includes('Exemples');
    const examplesLabel = isFrench ? 'Exemples :' : 'Examples:';
    // Remove the "Exemples :" or "Examples:" header and filter out empty examples
    const cleanExamples = examples
      .map(ex => ex.replace(/^(Exemples|Examples)\s*:\s*/i, '').trim())
      .filter(ex => ex.length > 0 && !ex.match(/^(Exemples|Examples)\s*:?\s*$/i));
    
    return (
      <div className="mt-3">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">{examplesLabel}</div>
        <div className="space-y-3">
          {cleanExamples.map((example, index) => {
          // Split into lines
          const lines = example.split('\n').filter(l => l.trim());
          const mainLine = lines[0] || '';
          // Skip if mainLine is empty or just a header
          if (!mainLine || mainLine.match(/^(Exemples|Examples)\s*:?\s*$/i)) {
            return null;
          }
          const winnerLine = lines.find(l => l.includes('Vainqueur:') || l.includes('Winner:')) || '';
          const diffLine = lines.find(l => l.includes('Différence:') || l.includes('Difference:')) || '';
          
          return (
            <div key={index} className="bg-white dark:bg-[rgb(40,40,40)] border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-sm">
              <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-2">{mainLine}</div>
              {winnerLine && (
                <div className="text-xs text-gray-700 dark:text-gray-200 mb-1 ml-2">
                  <span className="font-medium dark:text-gray-300">{winnerLine.split(':')[0]}:</span>
                  <span className={
                    winnerLine.includes('PAS OK') || winnerLine.includes('NOT OK') 
                      ? 'text-red-600 dark:text-red-300 ml-1' 
                      : winnerLine.includes('OK') 
                        ? 'text-green-600 dark:text-green-300 ml-1' 
                        : 'text-gray-700 dark:text-gray-200 ml-1'
                  }>
                    {winnerLine.split(':')[1]?.trim()}
                  </span>
                </div>
              )}
              {diffLine && (() => {
                // Split at the arrow to separate calculation from points
                const parts = diffLine.split('→');
                const calculation = parts[0]?.trim() || '';
                const points = parts[1]?.trim() || '';
                
                // Extract total value and determine color
                const totalMatch = calculation.match(/Total\s*=\s*(\d+)/i);
                const totalValue = totalMatch ? parseInt(totalMatch[1], 10) : null;
                
                // Color: green if Total ≤ 5 (regardless of winner), red if Total > 5
                const totalColor = (totalValue !== null && totalValue <= 5) ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300';
                
                // Split calculation to highlight Total part
                const totalRegex = /(Total\s*=\s*\d+)/i;
                const calculationParts = calculation.split(totalRegex);
                
                return (
                  <div className="text-xs text-gray-600 dark:text-gray-300 ml-2">
                    <div>
                      {calculationParts.map((part, idx) => {
                        if (totalRegex.test(part)) {
                          return (
                            <span key={idx} className={totalColor}>
                              {part}
                            </span>
                          );
                        }
                        return <span key={idx} className="dark:text-gray-300">{part}</span>;
                      })}
                    </div>
                    {points && (
                      <div className="mt-1">
                        <span className="font-bold text-gray-800 dark:text-gray-100">→ {points}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
        </div>
      </div>
    );
  };
  const [loadingBets, setLoadingBets] = useState<Set<string>>(new Set());
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [playersPerformance, setPlayersPerformance] = useState<PlayerPerformance[]>([]);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('position');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [userIsMember, setUserIsMember] = useState(isUserMember);
  const [joiningCompetition, setJoiningCompetition] = useState(false);

  // Placeholder team name used when the actual qualified team is not yet known.
  // Games involving this placeholder should be hidden from user-facing lists
  // ("Matchs Disponibles pour Parier" and "Tous les Matchs de la Compétition"),
  // but they are still part of the competition schedule for progression bars.
  const PLACEHOLDER_TEAM_NAME = 'xxxx';

  // Abbreviate team names for mobile display - 3 letters only
  const abbreviateTeamName = (team: { shortName?: string | null; name: string }): string => {
    // Use shortName from database if available, take first 3 letters
    if (team.shortName) {
      return team.shortName.substring(0, 3).toUpperCase();
    }
    
    // Fallback: use first 3 letters of team name
    return team.name.substring(0, 3).toUpperCase();
  };

  // Helper function to determine bet highlight for LIVE and FINISHED games
  const getBetHighlight = (bet: { score1: number | null; score2: number | null }, game: Game) => {
    if (bet.score1 === null || bet.score2 === null) return null;
    
    let actualHomeScore: number | null | undefined;
    let actualAwayScore: number | null | undefined;
    
    if (game.status === 'LIVE') {
      actualHomeScore = game.liveHomeScore;
      actualAwayScore = game.liveAwayScore;
    } else if (game.status === 'FINISHED') {
      actualHomeScore = game.homeScore;
      actualAwayScore = game.awayScore;
    } else {
      return null;
    }
    
    if (actualHomeScore === null || actualHomeScore === undefined || 
        actualAwayScore === null || actualAwayScore === undefined) {
      return null;
    }
    
    // Check for exact score match (gold)
    if (bet.score1 === actualHomeScore && bet.score2 === actualAwayScore) {
      return 'gold';
    }
    
    // Check for correct result (green)
    const betResult = bet.score1 > bet.score2 ? 'home' : bet.score1 < bet.score2 ? 'away' : 'draw';
    const actualResult = actualHomeScore > actualAwayScore ? 'home' : actualHomeScore < actualAwayScore ? 'away' : 'draw';
    
    if (betResult === actualResult) {
      return 'green';
    }
    
    // No match - red
    return 'red';
  };

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
    const isLast = position === competitionStats.length;
    switch (position) {
      case 1: return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-500/50';
      case 2: return 'bg-slate-200 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 border-slate-400 dark:border-slate-600/50'; // Silver/metallic gray for 2nd place
      case 3: return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-500/50';
      default: 
        if (isLast) {
          return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-500/50'; // Pizza (last place)
        }
        return 'bg-blue-100 dark:bg-[rgb(40,40,40)] text-blue-800 dark:text-gray-200 border-blue-200 dark:border-gray-600';
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

  // Helper function to abbreviate header names for mobile
  const getMobileHeaderAbbr = (key: string) => {
    const abbreviations: { [key: string]: string } = {
      'position': 'Pos',
      'player': 'Joueurs',
      'points': 'Pts',
      'games': 'M',
      'average': 'Moy',
      'exactScores': 'SE',
      'correctWinners': 'RC',
      'shooters': 'S'
    };
    return abbreviations[key] || key;
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

  // Handle joining competition
  const handleJoinCompetition = async () => {
    if (joiningCompetition || userIsMember) return;

    setJoiningCompetition(true);
    try {
      const response = await fetch(`/api/competitions/${competition.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setUserIsMember(true);
        // Reload the page to update all data
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la tentative de rejoindre la compétition');
      }
    } catch (error) {
      console.error('Error joining competition:', error);
      alert('Erreur lors de la tentative de rejoindre la compétition');
    } finally {
      setJoiningCompetition(false);
    }
  };

  // Show join button if user is not a member and competition is UPCOMING or ACTIVE
  const showJoinButton = !userIsMember && 
    (competition.status === 'UPCOMING' || 
     competition.status === 'upcoming' || 
     competition.status === 'ACTIVE' || 
     competition.status === 'active');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              {competition.logo ? (
                <img 
                  src={competition.logo} 
                  alt={`${competition.name} logo`}
                  className="h-12 w-12 object-contain dark:bg-white dark:p-0.5 dark:rounded flex-shrink-0"
                />
              ) : (
                <div className="h-12 w-12 bg-primary-600 dark:bg-accent-dark-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrophyIcon className="h-8 w-8 text-white" />
                </div>
              )}
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {competition.name}
              </h1>
            </div>
            {/* Desktop: Button top right */}
            {showJoinButton && (
              <button
                onClick={handleJoinCompetition}
                disabled={joiningCompetition}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 disabled:bg-primary-400 dark:disabled:bg-accent-dark-700 disabled:cursor-not-allowed transition-colors font-medium text-base flex-shrink-0"
              >
                {joiningCompetition ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Rejoindre...</span>
                  </>
                ) : (
                  <>
                    <UsersIcon className="h-5 w-5" />
                    <span>Rejoindre la compétition</span>
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            {descriptionKey ? t(`competitionDescriptions.${descriptionKey}`) : competition.description}
          </p>
          {/* Mobile: Button below description */}
          {showJoinButton && (
            <button
              onClick={handleJoinCompetition}
              disabled={joiningCompetition}
              className="md:hidden px-3 py-3 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 disabled:bg-primary-400 dark:disabled:bg-accent-dark-700 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5 text-sm w-full justify-center min-h-[44px]"
            >
              {joiningCompetition ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span>Rejoindre...</span>
                </>
              ) : (
                <>
                  <UsersIcon className="h-4 w-4" />
                  <span>Rejoindre la compétition</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Competition Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {/* Period */}
          <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <CalendarIcon className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <div className="text-[10px] sm:text-xs md:text-xs lg:text-sm text-gray-900 dark:text-gray-100 text-center flex-1 min-w-0">
                <div className="space-y-0.5 md:space-y-1">
                  <p className="font-bold text-[10px] sm:text-xs md:text-xs lg:text-sm whitespace-nowrap leading-tight">{formatDate(competition.startDate)}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-[9px] sm:text-[10px] md:text-[10px] lg:text-xs">{t('competition.to')}</p>
                  <p className="font-bold text-[10px] sm:text-xs md:text-xs lg:text-sm whitespace-nowrap leading-tight">{formatDate(competition.endDate)}</p>
                </div>
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">{t('competition.period')}</h3>
          </div>

          {/* Participants */}
          <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <UsersIcon className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <span className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{competition._count.users}</span>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">{t('competition.participants')}</h3>
          </div>

          {/* Games */}
          <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 md:h-8 md:w-8 text-white" />
              </div>
              <span className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{competition._count.games}</span>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">{t('competition.matches')}</h3>
          </div>

          {/* Status */}
          <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 p-4 md:p-5 flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="flex items-center space-x-2 md:space-x-3 mb-2">
              <div className="p-2 md:p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg flex items-center justify-center h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <span className="text-white text-base md:text-lg font-bold">
                  {competition.status === 'ACTIVE' || competition.status === 'active' ? '▶' : 
                   competition.status === 'UPCOMING' || competition.status === 'upcoming' ? '⏳' :
                   competition.status === 'COMPLETED' || competition.status === 'completed' ? '✓' :
                   competition.status === 'CANCELLED' || competition.status === 'cancelled' ? '✗' : '?'}
                </span>
              </div>
              <span className="text-sm md:text-base lg:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{translateCompetitionStatus(competition.status)}</span>
            </div>
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">{t('competition.status')}</h3>
          </div>
        </div>

        {/* Competition Progress Bar */}
        <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 p-6 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
                <ChartBarIcon className="h-5 w-5 text-white" />
              </div>
              <span className="md:hidden">Progression</span>
              <span className="hidden md:inline">Progression de la compétition</span>
            </h3>
            <div className="text-sm md:text-base text-gray-600 dark:text-gray-300 font-bold">
              {games.filter(g => g.status === 'FINISHED').length} / {competition._count.games} matchs joués
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[rgb(40,40,40)] rounded-full h-8 relative">
            <div 
              className="absolute top-0 left-0 bottom-0 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 dark:[background:none] border-2 border-transparent dark:border-white transition-all duration-500 ease-out flex items-center justify-center"
              style={{ 
                width: `${competition._count.games > 0 ? (games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100 : 0}%`,
                height: '100%',
                minWidth: competition._count.games > 0 && (games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100 === 0 ? '0%' : 'auto'
              }}
            >
              {competition._count.games > 0 && (games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100 > 0 && (
                <span className="text-xs font-bold text-white dark:text-gray-200">
                  {Math.round((games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100)}%
                </span>
              )}
            </div>
            {/* Show percentage text outside the bar when it's 0% or too small to fit text */}
            {competition._count.games > 0 && (games.filter(g => g.status === 'FINISHED').length / competition._count.games) * 100 === 0 && (
              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-neutral-800 dark:text-white">
                0%
              </span>
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span className="font-bold">0%</span>
            <span className="font-bold">100%</span>
          </div>
        </div>

        {/* Winner & Last Place - Only for completed competitions */}
        {(competition.status === 'COMPLETED' || competition.status === 'completed') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Winner */}
            <div className={`bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6 ${!competition.winner ? 'opacity-60' : ''}`}>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-yellow-500 dark:bg-yellow-600 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                    🏆
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300">{t('competition.champion')}</h3>
                  <p className="text-lg md:text-xl lg:text-2xl font-bold text-yellow-900 dark:text-yellow-200">{competition.winner ? competition.winner.name : '—'}</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">{competition.winner ? t('competition.competitionWinner') : t('competition.noWinnerSet')}</p>
                </div>
              </div>
            </div>
            {/* Last Place */}
            <div className={`bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border border-red-200 dark:border-red-700 rounded-xl p-6 ${!competition.lastPlace ? 'opacity-60' : ''}`}>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                    🍽️
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-800 dark:text-red-300">{t('competition.dinnerHost')}</h3>
                  <p className="text-lg md:text-xl lg:text-2xl font-bold text-red-900 dark:text-red-200">{competition.lastPlace ? competition.lastPlace.name : '—'}</p>
                  <p className="text-sm text-red-700 dark:text-red-400">{competition.lastPlace ? t('competition.owesEveryoneDinner') : t('competition.noWinnerSet')}</p>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Current Ranking Section - Always visible for better UX */}
        <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          {/* Header Section */}
          <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
                  <TrophyIcon className="h-6 w-6 text-white" />
                </div>
              {(competition.status === 'COMPLETED' || (competition.status === 'COMPLETED' || competition.status === 'completed')) ? t('competition.finalRanking') : 'Classement en cours'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {competitionStats && competitionStats.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
                <thead className="bg-gray-100 dark:bg-[rgb(58,58,58)] border-b-2 border-gray-300 dark:border-gray-600">
                  <tr>
                    <th 
                      className="w-10 md:w-16 px-1 md:px-4 py-1.5 md:py-2.5 text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('position')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.position')}
                          </span>
                          {sortColumn === 'position' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('position')}
                          </span>
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-24 md:w-48 px-1 md:px-4 py-2 md:py-3 text-left md:text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('player')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.player')}
                          </span>
                          {sortColumn === 'player' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('player')}
                          </span>
                          {sortColumn === 'player' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-10 md:w-24 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('points')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.points')}
                          </span>
                          {sortColumn === 'points' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('points')}
                          </span>
                          {sortColumn === 'points' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-10 md:w-20 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('games')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.games')}
                          </span>
                          {sortColumn === 'games' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('games')}
                          </span>
                          {sortColumn === 'games' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-10 md:w-24 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('average')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.average')}
                          </span>
                          {sortColumn === 'average' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('average')}
                          </span>
                          {sortColumn === 'average' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-10 md:w-24 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('exactScores')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.exactScores')}
                          </span>
                          {sortColumn === 'exactScores' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('exactScores')}
                          </span>
                          {sortColumn === 'exactScores' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-10 md:w-28 px-1 md:px-4 py-2 md:py-3 text-center border-r border-gray-300 dark:border-gray-600 md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('correctWinners')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.correctWinners')}
                          </span>
                          {sortColumn === 'correctWinners' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('correctWinners')}
                          </span>
                          {sortColumn === 'correctWinners' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <th 
                      className="w-10 md:w-20 px-1 md:px-4 py-2 md:py-3 text-center md:cursor-pointer md:hover:bg-gray-100 dark:md:hover:bg-gray-700 transition-colors select-none"
                      onClick={() => window.innerWidth >= 768 && handleSort('shooters')}
                    >
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-0 md:space-x-1 h-full">
                        <div className="hidden md:flex items-center justify-center space-x-0.5">
                          <span className="text-[9px] md:text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {t('competition.shooters')}
                          </span>
                          {sortColumn === 'shooters' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[9px] md:text-[10px] lg:text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col md:hidden items-center justify-center space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider leading-none">
                            {getMobileHeaderAbbr('shooters')}
                          </span>
                          {sortColumn === 'shooters' && (
                            <span className="text-gray-700 dark:text-gray-200 text-[7px] mt-0.5">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[rgb(20,20,20)] divide-y divide-gray-200 dark:divide-gray-600">
                  {sortedStats.slice(0, 10).map((player, index) => {
                    // Determine row highlighting based on original position
                    const isFirst = player.position === 1;
                    const isSecond = player.position === 2;
                    const isThird = player.position === 3;
                    const isLast = player.position === competitionStats.length;
                    const isCurrentUser = player.userId === currentUserId;
                    
                    let rowBgClass = '';
                    let borderClass = '';
                    
                    // Determine background colors for special positions
                    if (isFirst) {
                      rowBgClass = isCurrentUser 
                        ? 'bg-blue-50 dark:!bg-gray-800/95 md:dark:ring-1 md:dark:ring-accent-dark-500/45' 
                        : 'bg-amber-50/50 dark:bg-[rgb(20,20,20)]';
                    } else if (isSecond) {
                      rowBgClass = isCurrentUser 
                        ? 'bg-blue-50 dark:!bg-gray-800/95 md:dark:ring-1 md:dark:ring-accent-dark-500/45' 
                        : 'bg-slate-50/50 dark:bg-[rgb(20,20,20)]';
                    } else if (isThird) {
                      rowBgClass = isCurrentUser 
                        ? 'bg-blue-50 dark:!bg-gray-800/95 md:dark:ring-1 md:dark:ring-accent-dark-500/45' 
                        : 'bg-orange-50/50 dark:bg-[rgb(20,20,20)]';
                    } else if (isLast) {
                      rowBgClass = isCurrentUser 
                        ? 'bg-blue-50 dark:!bg-gray-800/95 md:dark:ring-1 md:dark:ring-accent-dark-500/45' 
                        : 'bg-red-50/50 dark:bg-[rgb(20,20,20)]';
                    } else if (isCurrentUser) {
                      rowBgClass = 'bg-blue-50 dark:!bg-gray-800/95 md:dark:ring-1 md:dark:ring-accent-dark-500/45';
                    }
                    
                    // Add accent color border only for current user
                    if (isCurrentUser) {
                      borderClass = '!border-l-4 !border-l-primary-500 dark:!border-l-accent-dark-500';
                    }
                    
                    return (
                    <tr key={player.userId} className={rowBgClass}>
                      <td className={`px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-600 ${borderClass}`}>
                        <div className={`inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full border-2 font-bold text-[10px] md:text-sm ${getPositionColor(player.position)}`}>
                          {getPositionIcon(player.position)}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap border-r border-gray-200 dark:border-gray-600">
                        {/* Mobile & Desktop: Name next to profile pic */}
                        <div className="flex items-center min-w-0">
                          <img 
                            src={getUserAvatar(player.userName, player.profilePictureUrl)} 
                            alt={player.userName}
                            className="w-7 h-7 md:w-10 md:h-10 rounded-full mr-1.5 md:mr-3 object-cover border-2 border-gray-200 dark:border-gray-600 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] md:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{player.userName}</div>
                            {(competition.status === 'COMPLETED' || competition.status === 'completed') && player.position === 1 && <div className="text-[9px] md:text-xs text-yellow-600 dark:text-yellow-400 font-medium">{t('competition.champion')}</div>}
                            {(competition.status === 'COMPLETED' || competition.status === 'completed') && player.position === competitionStats.length && <div className="text-[9px] md:text-xs text-red-600 dark:text-red-400 font-medium">{t('competition.dinnerHost')}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-600">
                        <div className="text-sm md:text-lg font-bold text-gray-900 dark:text-gray-100">{player.totalPoints}</div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-600">
                        <div className="text-[10px] md:text-sm text-gray-900 dark:text-gray-100">{player.totalPredictions}</div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-600">
                        <div className="text-[10px] md:text-sm text-gray-900 dark:text-gray-100">
                          {player.totalPredictions > 0 ? (player.totalPoints / player.totalPredictions).toFixed(2) : '0.00'}
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-600">
                        <div className="text-[10px] md:text-sm text-gray-900 dark:text-gray-100">{player.exactScores || 0}</div>
                      </td>
                      <td className="px-2 md:px-4 py-1 md:py-3 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-600">
                        <div className="text-[10px] md:text-sm text-gray-900 dark:text-gray-100">{player.correctWinners || 0}</div>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-center">
                        <div className="text-[10px] md:text-sm text-gray-900 dark:text-gray-100">{player.shooters || 0}</div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>{t('competition.noParticipantsYet')}</p>
              </div>
            )}
          </div>
          {/* Footer with header abbreviations explanation - Mobile only */}
          <div className="md:hidden bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-4 py-3">
            <div className="text-[10px] text-gray-700 dark:text-gray-300">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">Pos</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Position</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">Pts</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Points</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">M</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Matchs</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">Moy</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Moyenne</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">SE</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Scores Exactes</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">RC</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Résultat Correct</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 dark:text-gray-200">S</span>
                  <span className="text-gray-600 dark:text-gray-400">=</span>
                  <span className="text-gray-600 dark:text-gray-400">Shots</span>
                </div>
              </div>
            </div>
          </div>
          {/* Footer with click to sort explanation - Desktop only */}
          <div className="hidden md:block bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-6 py-3">
            <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
              <span className="italic">Cliquez sur les en-têtes de colonnes pour réorganiser le classement</span>
            </div>
          </div>
          {competitionStats.length > 10 && (
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-6 py-3 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t('competition.showingTop')} 10 {t('competition.of')} {competitionStats.length} {t('competition.participants')}
              </span>
              <button 
                onClick={() => {/* TODO: Implement full ranking modal or page */}}
                className="ml-2 text-sm text-primary-600 dark:text-accent-dark-400 hover:text-primary-700 dark:hover:text-accent-dark-400 font-medium"
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
        <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-2xl border border-gray-300 dark:border-gray-600 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', overflow: 'hidden' }}>
          {/* Header Section */}
          <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
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
                <div className="hidden md:block text-sm text-gray-500 dark:text-gray-400">
                  {showAllGames ? games.length : games.filter(g => g.status === 'UPCOMING' || g.status === 'LIVE').length} {t('competition.games')}
                </div>
                <button
                  onClick={() => setShowAllGames(!showAllGames)}
                  className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-white hover:text-primary-700 dark:hover:text-accent-dark-200 bg-primary-50 dark:bg-[rgb(40,40,40)] hover:bg-primary-100 dark:hover:bg-gray-600 border border-primary-200 dark:border-gray-600 rounded-lg transition-colors duration-200"
                >
                  {showAllGames ? t('competition.showBettingGames') : t('competition.showAllGames')}
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {(() => {
              if (!games || !Array.isArray(games)) {
                return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('competition.noActiveGamesFound')}</div>;
              }
              const filteredGames = showAllGames ? games : games.filter(g => g.status === 'UPCOMING' || g.status === 'LIVE');
              // Hide placeholder games (with TBD team names) from both views
              const displayableGames = filteredGames.filter(g => 
                g.homeTeam?.name !== PLACEHOLDER_TEAM_NAME &&
                g.awayTeam?.name !== PLACEHOLDER_TEAM_NAME
              );
              // Sort finished games first (most recent first), then upcoming/live games chronologically
              const sortedGames = [...displayableGames].sort((a, b) => {
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                  {sortedGames.map((game) => {
                    try {
                    // Prepare game data for GameCard component
                    // Ensure date is a string (ISO format) and structure matches GameCard interface
                    const gameCardData = {
                      status: game.status,
                      externalStatus: (game as any).externalStatus || null,
                      date: typeof game.date === 'string' ? game.date : (game.date ? new Date(game.date).toISOString() : new Date().toISOString()),
                      homeTeam: {
                        name: game.homeTeam?.name || '',
                        logo: game.homeTeam?.logo || null,
                        shortName: game.homeTeam?.shortName || null,
                      },
                      awayTeam: {
                        name: game.awayTeam?.name || '',
                        logo: game.awayTeam?.logo || null,
                        shortName: game.awayTeam?.shortName || null,
                      },
                      homeScore: game.homeScore ?? undefined,
                      awayScore: game.awayScore ?? undefined,
                      liveHomeScore: (game as any).liveHomeScore ?? undefined,
                      liveAwayScore: (game as any).liveAwayScore ?? undefined,
                      elapsedMinute: (game as any).elapsedMinute ?? null,
                      sportType: competition.sportType ? String(competition.sportType) : null,
                      competition: {
                        name: competition.name,
                        logo: competition.logo || null,
                      },
                      bets: ((game as any).bets || []).map((bet: any) => ({
                        id: bet.id,
                        userId: bet.userId,
                        score1: bet.score1,
                        score2: bet.score2,
                        points: bet.points,
                        user: {
                          name: bet.user?.name || '',
                          profilePictureUrl: bet.user?.profilePictureUrl || undefined,
                        },
                      })),
                    };
                    
                    // Only UPCOMING games are clickable for betting
                    const isOpen = game.status === 'UPCOMING';
                    const isFinished = game.status === 'FINISHED';
                    const isExpanded = expandedGames.has(game.id);
                    
                    return (
                      <div key={game.id} className="w-full">
                        {isFinished ? (
                          <div
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleGameExpansion(game.id);
                              // Fetch bets if not already loaded
                              if (!gamesWithBets.has(game.id)) {
                                fetchGameBets(game.id);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <div className="hover:opacity-90 transition-opacity">
                              <GameCard
                                game={gameCardData}
                                currentUserId={currentUserId}
                                href={undefined}
                                context="competition"
                              />
                            </div>
                          </div>
                        ) : (
                          <GameCard
                            game={gameCardData}
                            currentUserId={currentUserId}
                            href={isOpen ? `/betting/${game.id}` : undefined}
                            context="competition"
                          />
                        )}
                        
                        {/* Expanded Bets Section for Finished Games */}
                        {isFinished && isExpanded && (
                          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-[rgb(58,58,58)] rounded-b-xl md:rounded-b-2xl border-x border-b border-gray-300 dark:border-gray-600 px-4 md:px-6 pb-4 md:pb-6">
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                              <h4 className="text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Paris détaillés - {game.homeTeam?.name || ''} vs {game.awayTeam?.name || ''}
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGameExpansion(game.id);
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            
                            {loadingBets.has(game.id) ? (
                              <div className="flex items-center justify-center py-3 md:py-4">
                                <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
                                <span className="ml-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">Chargement des paris...</span>
                              </div>
                            ) : (
                              <div>
                                {gamesWithBets.get(game.id)?.length && gamesWithBets.get(game.id)!.length > 0 ? (
                                  <div className="space-y-1.5 md:space-y-2">
                                    {gamesWithBets.get(game.id)?.map((bet: any) => (
                                      <div key={bet.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 dark:bg-[rgb(40,40,40)] rounded-lg">
                                        <div className="flex items-center space-x-1.5 md:space-x-2">
                                          {bet.user?.profilePictureUrl ? (
                                            <img 
                                              src={bet.user.profilePictureUrl} 
                                              alt={bet.user?.name || ''}
                                              className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-[10px] md:text-xs font-medium text-gray-600 dark:text-gray-300">
                                              {bet.user?.name?.charAt(0) || '?'}
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">{bet.user?.name || 'Unknown'}</p>
                                            <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                                              {bet.score1} - {bet.score2}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className={`text-xs md:text-sm font-bold ${
                                            bet.points === 3 ? 'text-yellow-600 dark:text-yellow-400' :
                                            bet.points === 1 ? 'text-green-600 dark:text-green-400' :
                                            'text-red-600 dark:text-red-400'
                                          }`}>
                                            {bet.points} pt{bet.points > 1 ? 's' : ''}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-3 md:py-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                                    Aucun pari trouvé pour ce match
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                    } catch (error) {
                      console.error('Error rendering game card:', error, game);
                      return <div key={game.id} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">Error loading game</div>;
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('competition.noActiveGamesFound')}</div>
              );
            })()}
          </div>
        </div>

        {/* Rules Widget */}
        <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 p-6" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <BookOpenIcon className="h-5 w-5 text-white" />
            </div>
            {t('competition.rules.title')}
          </h2>
          
          {competition.sportType === 'RUGBY' ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-500 p-4 rounded">
                <h3 className="font-bold text-green-800 dark:text-green-300 mb-2">{t('competition.rules.rugby.threePoints')}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{t('competition.rules.rugby.threePointsDesc')}</p>
                {renderRugbyExamples(t('competition.rules.rugby.threePointsExamples'))}
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-500 p-4 rounded">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">{t('competition.rules.rugby.onePoint')}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{t('competition.rules.rugby.onePointDesc')}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-500 p-4 rounded">
                <h3 className="font-bold text-red-800 dark:text-red-300 mb-2">{t('competition.rules.rugby.zeroPoints')}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{t('competition.rules.rugby.zeroPointsDesc')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-500 p-4 rounded">
                <h3 className="font-bold text-green-800 dark:text-green-300 mb-2">{t('competition.rules.football.threePoints')}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{t('competition.rules.football.threePointsDesc')}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-500 p-4 rounded">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">{t('competition.rules.football.onePoint')}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{t('competition.rules.football.onePointDesc')}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-500 p-4 rounded">
                <h3 className="font-bold text-red-800 dark:text-red-300 mb-2">{t('competition.rules.football.zeroPoints')}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{t('competition.rules.football.zeroPointsDesc')}</p>
              </div>
            </div>
          )}
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
        sportType: true,
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
        liveHomeScore: true,
        liveAwayScore: true,
        elapsedMinute: true,
        externalStatus: true,
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
              points: true,
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

    // Check if user is a member of this competition
    const isUserMember = competition.users.some(
      (compUser) => compUser.user.id === session.user.id
    );

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
        isUserMember,
      },
    };
  } catch (error) {
    console.error('Error fetching competition details:', error);
    return {
      notFound: true,
    };
  }
}; 
