import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { useTranslation } from '../hooks/useTranslation';
import { useEffect, useState } from 'react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ChartBarIcon,
  TrophyIcon,
  FireIcon,
  UserGroupIcon,
  StarIcon,
  CheckCircleIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import React from 'react';
import axios from 'axios';

interface UserStats {
  totalPredictions: number;
  totalPoints: number;
  accuracy: number;
  wins: number;
  longestStreak: number;
  exactScoreStreak: number;
  longestStreakStart?: string;
  longestStreakEnd?: string;
  exactStreakStart?: string;
  exactStreakEnd?: string;
  forgottenBets?: number;
  exactScores?: number;
}

interface LeaderboardUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  stats: UserStats;
  createdAt: string;
  averagePoints?: number;
}

interface LeaderboardData {
  topPlayersByPoints: LeaderboardUser[];
  topPlayersByAverage: LeaderboardUser[];
  totalUsers: number;
  competitions: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    winner: {
      id: string;
      name: string;
    } | null;
    winnerPoints: number;
    participantCount: number;
    gameCount: number;
    logo?: string;
    sportType: string;
  }>;
}

interface UserProfilePicture {
  [key: string]: string;
}

interface CurrentUserStats {
  totalPoints: number;
  totalPredictions: number;
  accuracy: number;
  longestStreak: number;
  exactScoreStreak: number;
  wins: number;
  ranking: number;
  averagePoints: number;
  exactScores: number;
  correctOutcomes: number; // 1-point scores (correct outcome but not exact score)
}




export default function Stats({ currentUser }: { currentUser: LeaderboardUser }) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalStatsLoading, setPersonalStatsLoading] = useState(false);
  const [userProfilePictures, setUserProfilePictures] = useState<UserProfilePicture>({});
  const [currentUserStats, setCurrentUserStats] = useState<CurrentUserStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<LeaderboardUser | null>(null);
  const [breakdown, setBreakdown] = useState<{ competition: string; total_points: number }[] | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [selectedSportPersonal, setSelectedSportPersonal] = useState<'ALL' | 'FOOTBALL' | 'RUGBY'>('ALL');
  const [selectedSportGlobal, setSelectedSportGlobal] = useState<'ALL' | 'FOOTBALL' | 'RUGBY'>('ALL');


  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      const url = `/api/stats/leaderboard${selectedSportGlobal && selectedSportGlobal !== 'ALL' ? `?sportType=${selectedSportGlobal}` : ''}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLeaderboardData(data);
        console.log('Leaderboard data:', data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
    fetchUserProfilePictures();
  }, []);

  // Fetch leaderboard data when global sport filter changes
  useEffect(() => {
    if (selectedSportGlobal) {
      fetchLeaderboardData();
    }
  }, [selectedSportGlobal]);

  // Track if leaderboard data has been loaded initially
  const [leaderboardDataInitialized, setLeaderboardDataInitialized] = useState(false);

  // Fetch personal stats after leaderboard data is loaded initially or when personal sport filter changes
  useEffect(() => {
    if (leaderboardData && !leaderboardDataInitialized) {
      console.log('📊 Leaderboard data available initially, fetching current user stats...');
      setLeaderboardDataInitialized(true);
      fetchCurrentUserStats();
    }
  }, [leaderboardData, leaderboardDataInitialized]);

  // Fetch personal stats when personal sport filter changes (but not when global filter changes)
  useEffect(() => {
    if (leaderboardDataInitialized) {
      console.log('🔄 Personal sport filter changed to:', selectedSportPersonal);
      fetchCurrentUserStats();
    }
  }, [selectedSportPersonal]);

  const fetchCurrentUserStats = async () => {
    try {
      setPersonalStatsLoading(true);
      console.log('🔍 Fetching current user stats...', 'sport:', selectedSportPersonal);
      const url = selectedSportPersonal === 'ALL' 
        ? '/api/stats/current-user' 
        : `/api/stats/current-user?sportType=${selectedSportPersonal}`;
      const response = await fetch(url);
      console.log('📊 Current user API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Individual user stats:', data);
        
        // Use ranking from API (already calculated with sport filter if applicable)
        // Calculate average points if not provided
        const averagePoints = data.averagePoints ?? (data.totalPredictions > 0 ? data.totalPoints / data.totalPredictions : 0);
        
        const statsData = {
          ...data,
          averagePoints
        };
        
        console.log('📈 Setting current user stats:', statsData);
        setCurrentUserStats(statsData);
      } else {
        console.error('❌ Current user API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching current user stats:', error);
    } finally {
      setPersonalStatsLoading(false);
    }
  };

  const fetchUserProfilePictures = async () => {
    try {
      const response = await fetch('/api/users/profile-pictures');
      if (response.ok) {
        const data = await response.json();
        setUserProfilePictures(data);
      }
    } catch (error) {
      console.error('Error fetching user profile pictures:', error);
    }
  };



  // Function to get user profile picture or generate avatar
  const getUserAvatar = (name: string) => {
    // Try to get real profile picture first
    const profilePicture = userProfilePictures[name];
    if (profilePicture) {
      return profilePicture;
    }
    
    // Fallback to generated avatar
    const userId = name.toLowerCase();
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  };

  // Create streak leaderboards from existing data
  const getStreakLeaderboards = () => {
    if (!leaderboardData) return { pointsStreaks: [], exactScoreStreaks: [] };
    
    const pointsStreaks = [...leaderboardData.topPlayersByPoints]
      .sort((a, b) => b.stats.longestStreak - a.stats.longestStreak)
      .slice(0, 25)
      .map(user => ({
        name: user.name,
        streak: user.stats.longestStreak,
        avatar: user.avatar,
        startDate: user.stats.longestStreakStart,
        endDate: user.stats.longestStreakEnd
      }));

    const exactScoreStreaks = [...leaderboardData.topPlayersByPoints]
      .sort((a, b) => b.stats.exactScoreStreak - a.stats.exactScoreStreak)
      .slice(0, 25)
      .map(user => ({
        name: user.name,
        streak: user.stats.exactScoreStreak,
        avatar: user.avatar,
        startDate: user.stats.exactStreakStart,
        endDate: user.stats.exactStreakEnd
      }));

    return { pointsStreaks, exactScoreStreaks };
  };

  // Get competitions won leaderboard
  const getCompetitionsWonLeaderboard = () => {
    if (!leaderboardData) return [];
    
    return [...leaderboardData.topPlayersByPoints]
      .map(user => {
        // Count wins only from filtered competitions
        const wonCompetitions = leaderboardData.competitions
          .filter(comp => comp.winner?.id === user.id && (comp.status === 'COMPLETED' || comp.status === 'completed'));
        const winsCount = wonCompetitions.length;
        
        return {
          ...user,
          filteredWins: winsCount,
          wonCompetitionsList: wonCompetitions.map(comp => comp.name)
        };
      })
      .filter(user => user.filteredWins > 0)
      .sort((a, b) => b.filteredWins - a.filteredWins)
      .slice(0, 10)
      .map(user => ({
        name: user.name,
        competitions: user.filteredWins,
        avatar: user.avatar,
        wonCompetitions: user.wonCompetitionsList.join(', ') || 'Unknown competitions'
      }));
  };

  const { pointsStreaks, exactScoreStreaks } = getStreakLeaderboards();
  const competitionsWonLeaderboard = getCompetitionsWonLeaderboard();

  function truncateTo3Decimals(num: number | string) {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return (Math.trunc(n * 1000) / 1000).toFixed(3);
  }

  const handleUserClick = async (user: LeaderboardUser) => {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      setExpandedUser(null);
      setBreakdown(null);
      return;
    }
    
    setExpandedUserId(user.id);
    setExpandedUser(user);
    setBreakdownLoading(true);
    
    try {
      const res = await axios.get(`/api/user-points-breakdown?userId=${user.id}`);
      setBreakdown(res.data);
    } catch (e) {
      console.error('Error fetching breakdown:', e);
      setBreakdown([]);
    } finally {
      setBreakdownLoading(false);
    }
  };

  return (
    <div className="bg-[#f3f4f6] dark:bg-[rgb(20,20,20)] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10">


        {/* Remarque Banner - much more visible */}
        {!loading && leaderboardData && (
          <div className="bg-accent-100 dark:bg-[rgb(38,38,38)] border border-accent-400 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-4 mb-8 shadow">
            <p className="text-base">
              <strong>{t('note')}:</strong> {t('stats.streakNotice')}
            </p>
          </div>
        )}

        {/* Statistiques Personnelles */}
        <section className="bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-700 p-6 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <span className="p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-white" />
              </span>
              <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-gray-100">{t('stats.personalStats')}</h2>
            </div>
            {/* Sport Filter - Dropdown for mobile, buttons for desktop */}
            <div className="md:hidden">
              <select
                value={selectedSportPersonal}
                onChange={(e) => setSelectedSportPersonal(e.target.value as 'ALL' | 'FOOTBALL' | 'RUGBY')}
                className="px-3 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-blue-500 focus:border-primary-600 dark:focus:border-blue-500"
              >
                <option value="ALL">{t('stats.allSports') || 'Tous'}</option>
                <option value="FOOTBALL">{t('stats.football') || 'Football'}</option>
                <option value="RUGBY">{t('stats.rugby') || 'Rugby'}</option>
              </select>
            </div>
            {/* Sport Filter Tabs - Desktop only */}
            <div className="hidden md:flex items-center space-x-2 bg-gray-100 dark:bg-[rgb(38,38,38)] rounded-lg p-1">
              <button
                onClick={() => setSelectedSportPersonal('ALL')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSportPersonal === 'ALL'
                    ? 'bg-primary-600 dark:bg-accent-dark-600 text-white shadow-md font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('stats.allSports') || 'Tous'}
              </button>
              <button
                onClick={() => setSelectedSportPersonal('FOOTBALL')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSportPersonal === 'FOOTBALL'
                    ? 'bg-primary-600 dark:bg-accent-dark-600 text-white shadow-md font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('stats.football') || 'Football'}
              </button>
              <button
                onClick={() => setSelectedSportPersonal('RUGBY')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSportPersonal === 'RUGBY'
                    ? 'bg-primary-600 dark:bg-accent-dark-600 text-white shadow-md font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('stats.rugby') || 'Rugby'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* All-time Ranking with Total Points */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
              {personalStatsLoading || !currentUserStats ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center mb-2">
                    <span className='p-3 bg-accent-500 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center'>
                      <TrophyIcon className="h-6 w-6 text-white" />
                    </span>
                    <span className="text-xl md:text-2xl lg:text-3xl text-gray-800 dark:text-gray-100">#{currentUserStats.ranking} <span className="text-lg md:text-xl lg:text-2xl">({currentUserStats.totalPoints} points)</span></span>
                  </div>
                  <div className="text-base text-gray-800 dark:text-gray-200">{t('stats.allTimeRanking')}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('stats.outOfUsers', { count: leaderboardData?.totalUsers || 0 })}</div>
                </>
              )}
            </div>
            {/* Average Points per Game */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
              {personalStatsLoading || !currentUserStats ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center mb-2">
                    <span className='p-3 bg-accent-500 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center'>
                      <ChartBarIcon className="h-6 w-6 text-white" />
                    </span>
                    <span className="text-xl md:text-2xl lg:text-3xl text-gray-800 dark:text-gray-100">{Number(currentUserStats.averagePoints).toFixed(3)}</span>
                  </div>
                  <div className="text-base text-gray-800 dark:text-gray-200">{t('stats.avgPointsGame')}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('stats.basedOnGames', { count: currentUserStats.totalPredictions })}</div>
                </>
              )}
            </div>
            {/* Competitions Won */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
              {personalStatsLoading || !currentUserStats ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center mb-2">
                    <span className='p-3 bg-accent-500 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center'>
                      <TrophyIcon className="h-6 w-6 text-white" />
                    </span>
                    <span className="text-xl md:text-2xl lg:text-3xl text-gray-800 dark:text-gray-100">{currentUserStats.wins}</span>
                  </div>
                  <div className="text-base text-gray-800 dark:text-gray-200">{t('stats.competitionsWon')}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('stats.totalVictories')}</div>
                </>
              )}
            </div>
          </div>

        </section>

        {/* Statistiques Globales */}
        <section className="bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-2xl p-6 mb-8 border border-gray-200 dark:border-gray-700" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <span className="p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
                <UserGroupIcon className="h-6 w-6 text-white" />
              </span>
              <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-gray-100">Statistiques Globales</h2>
            </div>
            {/* Sport Filter - Dropdown for mobile, buttons for desktop */}
            <div className="md:hidden">
              <select
                value={selectedSportGlobal}
                onChange={(e) => setSelectedSportGlobal(e.target.value as 'ALL' | 'FOOTBALL' | 'RUGBY')}
                className="px-3 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-blue-500 focus:border-primary-600 dark:focus:border-blue-500"
              >
                <option value="ALL">{t('stats.allSports') || 'Tous'}</option>
                <option value="FOOTBALL">{t('stats.football') || 'Football'}</option>
                <option value="RUGBY">{t('stats.rugby') || 'Rugby'}</option>
              </select>
            </div>
            {/* Sport Filter Tabs - Desktop only */}
            <div className="hidden md:flex items-center space-x-2 bg-gray-100 dark:bg-[rgb(38,38,38)] rounded-lg p-1">
              <button
                onClick={() => setSelectedSportGlobal('ALL')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSportGlobal === 'ALL'
                    ? 'bg-primary-600 dark:bg-accent-dark-600 text-white shadow-md font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('stats.allSports') || 'Tous'}
              </button>
              <button
                onClick={() => setSelectedSportGlobal('FOOTBALL')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSportGlobal === 'FOOTBALL'
                    ? 'bg-primary-600 dark:bg-accent-dark-600 text-white shadow-md font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('stats.football') || 'Football'}
              </button>
              <button
                onClick={() => setSelectedSportGlobal('RUGBY')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSportGlobal === 'RUGBY'
                    ? 'bg-primary-600 dark:bg-accent-dark-600 text-white shadow-md font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {t('stats.rugby') || 'Rugby'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Meilleurs Marqueurs */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                {t('stats.topPlayersAllTime')}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Données depuis UEFA Euro 2016
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  leaderboardData.topPlayersByPoints.slice(0, 10).map((player, index) => (
                    <React.Fragment key={player.id}>
                      <div
                        className={"flex items-center justify-between p-3 rounded-xl border border-primary-300/60 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" + 
                          (expandedUserId === player.id ? " ring-2 ring-primary-400 dark:ring-accent-dark-500 bg-blue-100 dark:bg-[rgb(40,40,40)]" : "") +
                          (player.id === currentUser.id ? " bg-blue-50 dark:!bg-gray-800 ring-2 ring-blue-300 dark:ring-accent-dark-500 border-blue-300 dark:border-accent-dark-500" : " bg-white dark:bg-[rgb(38,38,38)]")}
                        onClick={() => handleUserClick(player)}
                        title="Voir le détail par compétition"
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500 dark:text-yellow-400' : index === 1 ? 'text-gray-400 dark:text-gray-500' : index === 2 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-gray-600 dark:bg-white dark:p-0.5"
                          />
                          <div>
                            <span className="font-medium text-neutral-900 dark:text-gray-100">{player.name}</span>
                            <p className="text-xs text-neutral-500 dark:text-gray-400">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900 dark:text-gray-100">{player.stats.totalPoints} <span className="hidden md:inline">{t('stats.points').toLowerCase()}</span></span>
                      </div>
                      
                      {/* Inline Breakdown - Only for this specific player */}
                      {expandedUserId === player.id && (
                        <div className="mt-2 p-3 bg-neutral-50 dark:bg-[rgb(40,40,40)] border border-neutral-200/50 dark:border-gray-600 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-600 dark:text-gray-300">
                              {t('pointsBreakdownByCompetition') || 'Points breakdown by competition'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedUserId(null);
                              }}
                              className="text-neutral-400 dark:text-gray-500 hover:text-neutral-600 dark:hover:text-gray-300 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {breakdownLoading ? (
                            <div className="text-center py-1">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-400 mx-auto"></div>
                            </div>
                          ) : breakdown && breakdown.length > 0 ? (
                            <div className="space-y-1">
                              {breakdown.map((item, breakdownIndex) => (
                                <div key={breakdownIndex} className="flex items-center justify-between text-xs">
                                  <span className="text-neutral-600 dark:text-gray-300 truncate pr-2">{item.competition}</span>
                                  <span className="font-semibold text-neutral-900 dark:text-gray-100">{item.total_points} pts</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-1 text-neutral-500 dark:text-gray-400 text-xs">Aucune donnée</div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <div className="text-center py-4 text-neutral-500 dark:text-gray-400">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Meilleure Moyenne */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                {t('stats.bestAverage')}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Données depuis UEFA Euro 2016
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByAverage ? (
                  leaderboardData.topPlayersByAverage.slice(0, 10).map((player, index) => (
                    <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-primary-300/60 dark:border-gray-600 ${
                      player.id === currentUser.id ? "bg-blue-50 dark:!bg-gray-800 ring-2 ring-blue-300 dark:ring-accent-dark-500 border-blue-300 dark:border-accent-dark-500" : "bg-white dark:bg-[rgb(38,38,38)]"
                    }`}>
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500 dark:text-yellow-400' : index === 1 ? 'text-gray-400 dark:text-gray-500' : index === 2 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{index + 1}.</span>
                        <img 
                          src={getUserAvatar(player.name)} 
                          alt={player.name}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-gray-600 dark:bg-white dark:p-0.5"
                        />
                        <div>
                          <span className="font-medium text-neutral-900 dark:text-gray-100">{player.name}</span>
                          <p className="text-xs text-neutral-500 dark:text-gray-400">{player.stats.totalPredictions} {t('stats.games')}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-neutral-900 dark:text-gray-100">{truncateTo3Decimals(player.averagePoints ?? 0)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-neutral-500 dark:text-gray-400">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Total 1-N-2 Corrects */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                Total 1-N-2 Corrects
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Données depuis Champions League 25/26
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  [...leaderboardData.topPlayersByPoints]
                    .sort((a, b) => (b.stats.correctOutcomes || 0) - (a.stats.correctOutcomes || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                      <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 dark:border-gray-600 ${
                        player.id === currentUser.id ? "bg-blue-50 dark:!bg-gray-800 ring-2 ring-blue-300 dark:ring-accent-dark-500 border-blue-300 dark:border-accent-dark-500" : "bg-white dark:bg-[rgb(38,38,38)]"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500 dark:text-yellow-400' : index === 1 ? 'text-gray-400 dark:text-gray-500' : index === 2 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-gray-600 dark:bg-white dark:p-0.5"
                          />
                          <div>
                            <span className="font-medium text-neutral-900 dark:text-gray-100">{player.name}</span>
                            <p className="text-xs text-neutral-500 dark:text-gray-400">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900 dark:text-gray-100">{player.stats.correctOutcomes || 0}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-neutral-500 dark:text-gray-400">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Most Exact Scores */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                {t('stats.mostExactScores')}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Données depuis Champions League 25/26
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  [...leaderboardData.topPlayersByPoints]
                    .sort((a, b) => (b.stats.exactScores || 0) - (a.stats.exactScores || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                      <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 dark:border-gray-600 ${
                        player.id === currentUser.id ? "bg-blue-50 dark:!bg-gray-800 ring-2 ring-blue-300 dark:ring-accent-dark-500 border-blue-300 dark:border-accent-dark-500" : "bg-white dark:bg-[rgb(38,38,38)]"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500 dark:text-yellow-400' : index === 1 ? 'text-gray-400 dark:text-gray-500' : index === 2 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-gray-600 dark:bg-white dark:p-0.5"
                          />
                          <div>
                            <span className="font-medium text-neutral-900 dark:text-gray-100">{player.name}</span>
                            <p className="text-xs text-neutral-500 dark:text-gray-400">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900 dark:text-gray-100">{player.stats.exactScores || 0}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-neutral-500 dark:text-gray-400">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* No-Show (Shooters) */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                No-Show (Shooters)
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Données depuis Champions League 25/26
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  [...leaderboardData.topPlayersByPoints]
                    .sort((a, b) => (b.stats.forgottenBets || 0) - (a.stats.forgottenBets || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                      <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 dark:border-gray-600 ${
                        player.id === currentUser.id ? "bg-blue-50 dark:!bg-gray-800 ring-2 ring-blue-300 dark:ring-accent-dark-500 border-blue-300 dark:border-accent-dark-500" : "bg-white dark:bg-[rgb(38,38,38)]"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-red-500 dark:text-red-400' : index === 1 ? 'text-orange-500 dark:text-orange-400' : index === 2 ? 'text-yellow-500 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200 dark:border-gray-600 dark:bg-white dark:p-0.5"
                          />
                          <div>
                            <span className="font-medium text-neutral-900 dark:text-gray-100">{player.name}</span>
                            <p className="text-xs text-neutral-500 dark:text-gray-400">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900 dark:text-gray-100">{player.stats.forgottenBets || 0}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-neutral-500 dark:text-gray-400">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Most Competitions Won */}
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-800 dark:to-gray-700 border border-primary-300/60 dark:border-gray-600 rounded-xl p-6 shadow-xl flex flex-col justify-between lg:col-span-3">
              <h3 className="text-gray-900 dark:text-gray-100 mb-4 flex items-center text-lg">
                {t('stats.mostCompetitionsWon')}
              </h3>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                </div>
              ) : competitionsWonLeaderboard.length > 0 ? (
                <div className="space-y-4">
                  {/* Group players by win count */}
                  {(() => {
                    const groupedByWins = competitionsWonLeaderboard.reduce((acc, player) => {
                      if (!acc[player.competitions]) {
                        acc[player.competitions] = [];
                      }
                      acc[player.competitions].push(player);
                      return acc;
                    }, {} as Record<number, typeof competitionsWonLeaderboard>);
                    // Sort by win count (descending)
                    const sortedWinCounts = Object.keys(groupedByWins)
                      .map(Number)
                      .sort((a, b) => b - a);
                    return sortedWinCounts.map((winCount, groupIndex) => (
                      <div key={winCount} className={`pl-4 py-3 rounded-xl mb-2 flex flex-col border-l-8 ${
                        groupIndex === 0 ? 'border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                        groupIndex === 1 ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-[rgb(38,38,38)]' :
                        groupIndex === 2 ? 'border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                        'border-blue-400 dark:border-accent-dark-500 bg-blue-50 dark:bg-accent-dark-900/20'
                      }`}>
                        <div className="flex items-center mb-3">
                          <span className={`text-lg font-medium mr-2 ${groupIndex === 0 ? 'text-yellow-500 dark:text-yellow-400' : groupIndex === 1 ? 'text-gray-400 dark:text-gray-500' : groupIndex === 2 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{winCount}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupedByWins[winCount].map((player) => (
                            <div key={player.name} className="flex items-start space-x-3 bg-white dark:bg-[rgb(38,38,38)] rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 min-w-0 flex-1">
                              <img 
                                src={getUserAvatar(player.name)} 
                                alt={player.name}
                                className="w-10 h-10 rounded-full border-2 border-yellow-400 dark:border-yellow-500 flex-shrink-0 dark:bg-white dark:p-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-2">{player.name}</div>
                                <div className="space-y-1">
                                  {player.wonCompetitions.split(', ').map((competition, index) => (
                                    <div key={index} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[rgb(40,40,40)] px-2 py-1 rounded border dark:border-gray-600">
                                      {competition.trim()}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-neutral-500">{t('stats.noCompetitionWinners')}</div>
              )}
            </div>
          </div>
        </section>


        {/* Palmarès Section */}
        <section className="bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-700 p-6 mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          <div className="flex items-center mb-6">
            <div className="p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
              <TrophyIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-gray-100">Historique des Compétitions</h2>
          </div>
          <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-md border border-neutral-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-700 dark:to-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('stats.competition')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('stats.period')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('stats.winner')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('stats.points')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('stats.avgPointsGame')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-gray-300 uppercase tracking-wider">
                      {t('stats.participants')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[rgb(38,38,38)] divide-y divide-neutral-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
                        <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2">{t('loading')}...</p>
                      </td>
                    </tr>
                  ) : leaderboardData?.competitions && leaderboardData.competitions.length > 0 ? (
                    leaderboardData.competitions
                      .filter(competition => competition.status === 'COMPLETED' || competition.status === 'completed')
                      .map((competition) => {
                        return (
                          <tr 
                            key={competition.id} 
                            className="hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors cursor-pointer"
                            onClick={() => router.push(`/competitions/${competition.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {competition.logo ? (
                                    <img 
                                      src={competition.logo} 
                                      alt={`${competition.name} logo`}
                                      className="h-10 w-10 object-contain dark:bg-white dark:p-0.5 dark:rounded"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center">
                                      <span className="text-white font-bold text-sm">
                                        {competition.name.substring(0, 2).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <Link 
                                    href={`/competitions/${competition.id}`}
                                    className="text-sm font-medium text-blue-600 dark:text-accent-dark-400 hover:text-blue-800 dark:hover:text-accent-dark-400 hover:underline transition-colors cursor-pointer"
                                  >
                                    {competition.name}
                                  </Link>
                                  <div className="text-sm text-neutral-500 dark:text-gray-400">
                                    {competition.name.includes('Euro') ? t('stats.europeanChampionship') : 
                                     competition.name.includes('World Cup') ? t('stats.fifaWorldCup') : 
                                     competition.name.includes('Champions League') ? t('stats.uefaChampionsLeague') :
                                     t('stats.footballCompetition')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-neutral-900 dark:text-gray-100">
                                {new Date(competition.startDate).toLocaleDateString('fr-FR', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })} - {new Date(competition.endDate).toLocaleDateString('fr-FR', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </div>
                              <div className="text-sm text-neutral-500 dark:text-gray-400">
                                {Math.ceil((new Date(competition.endDate).getTime() - new Date(competition.startDate).getTime()) / (1000 * 60 * 60 * 24))} {t('stats.days')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {competition.winner ? (
                                <div className="flex items-center">
                                  <img 
                                    src={getUserAvatar(competition.winner.name)} 
                                    alt={competition.winner.name}
                                    className="w-8 h-8 rounded-full mr-3 border-2 border-yellow-400 dark:border-yellow-500 dark:bg-white dark:p-0.5"
                                  />
                                  <div>
                                    <div className="text-sm font-medium text-neutral-900 dark:text-gray-100 flex items-center">
                                      {competition.winner.name}
                                    </div>
                                    <div className="text-sm text-neutral-500 dark:text-gray-400">{t('stats.champion')}</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-500 dark:text-gray-400">{t('stats.noWinnerSet')}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {competition.winner ? (
                                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                  {competition.winnerPoints}
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-500 dark:text-gray-400">-</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {competition.winner && competition.gameCount > 0 ? (
                                <div className="text-sm font-medium text-neutral-900 dark:text-gray-100">
                                  {(competition.winnerPoints / competition.gameCount).toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-500 dark:text-gray-400">-</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-neutral-900 dark:text-gray-100">{competition.participantCount}</div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-neutral-500 dark:text-gray-400">
                        {t('stats.noCompetitionHistory')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Competition Summary Stats */}
            {!loading && leaderboardData && (
              <div className="px-6 py-4 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-700 dark:to-gray-600 border-t border-primary-300/60 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-primary-600 dark:text-accent-dark-600">
                      {leaderboardData.competitions?.filter(comp => comp.status === 'COMPLETED' || comp.status === 'completed').length || 0}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-gray-400">{t('stats.completedCompetitions')}</div>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                      {leaderboardData.topPlayersByPoints.reduce((sum, player) => sum + player.stats.totalPoints, 0)}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-gray-400">{t('stats.totalPointsScored')}</div>
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold text-primary-600 dark:text-accent-dark-600">
                      {leaderboardData.topPlayersByPoints.reduce((sum, player) => sum + player.stats.totalPredictions, 0)}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-gray-400">{t('stats.totalPredictions')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: {
      ...(await serverSideTranslations('fr', ['common'])),
      currentUser: session.user,
    },
  };
}; 