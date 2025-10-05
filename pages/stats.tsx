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
  const [userProfilePictures, setUserProfilePictures] = useState<UserProfilePicture>({});
  const [currentUserStats, setCurrentUserStats] = useState<CurrentUserStats | null>(null);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<LeaderboardUser | null>(null);
  const [breakdown, setBreakdown] = useState<{ competition: string; total_points: number }[] | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);


  useEffect(() => {
    fetchLeaderboardData();
    fetchUserProfilePictures();
  }, []);

  // Fetch personal stats after leaderboard data is loaded
  useEffect(() => {
    console.log('🔄 useEffect triggered for leaderboardData:', !!leaderboardData);
    if (leaderboardData) {
      console.log('📊 Leaderboard data available, fetching current user stats...');
      fetchCurrentUserStats();
    }
  }, [leaderboardData]);

  const fetchLeaderboardData = async () => {
    try {
      const response = await fetch('/api/stats/leaderboard');
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

  const fetchCurrentUserStats = async () => {
    try {
      console.log('🔍 Fetching current user stats...');
      const response = await fetch('/api/stats/current-user');
      console.log('📊 Current user API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Individual user stats:', data);
        
        // Calculate ranking from leaderboard data if available
        let ranking = 1;
        if (leaderboardData && leaderboardData.topPlayersByPoints) {
          const userIndex = leaderboardData.topPlayersByPoints.findIndex((user: LeaderboardUser) => user.id === currentUser.id);
          ranking = userIndex >= 0 ? userIndex + 1 : 1;
        }
        
        // Calculate average points
        const averagePoints = data.totalPredictions > 0 ? data.totalPoints / data.totalPredictions : 0;
        
        const statsData = {
          ...data,
          ranking,
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
      .sort((a, b) => b.stats.wins - a.stats.wins)
      .filter(user => user.stats.wins > 0)
      .slice(0, 10)
      .map(user => {
        // Get the actual competitions this user won
        const wonCompetitions = leaderboardData.competitions
          .filter(comp => comp.winner?.id === user.id)
          .map(comp => comp.name);
        
        return {
          name: user.name,
          competitions: user.stats.wins,
          avatar: user.avatar,
          wonCompetitions: wonCompetitions.join(', ') || 'Unknown competitions'
        };
      });
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
    <div className="bg-[#f3f4f6] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-4 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <ChartBarIcon className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              {t('stats.title')}
            </h1>
          </div>
        </div>


        {/* Remarque Banner - much more visible */}
        {!loading && leaderboardData && (
          <div className="bg-accent-100 border border-accent-400 text-gray-800 rounded-lg p-4 mb-8 shadow">
            <p className="text-base">
              <strong>{t('note')}:</strong> {t('stats.streakNotice')}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-primary-100 border border-primary-400 rounded-lg p-6 text-center mb-8 shadow">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-700 text-white text-sm font-medium mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {t('stats.loadingRealData')}
            </div>
            <p className="text-primary-900">
              {t('stats.fetchingStatistics')}
            </p>
          </div>
        )}

        {/* Statistiques Personnelles */}
        <section className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6 mb-8">
          <div className="flex items-center mb-6">
            <span className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-white" />
            </span>
            <h2 className="text-xl font-bold text-neutral-900">{t('stats.personalStats')}</h2>
          </div>
          {currentUserStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {/* All-time Ranking with Total Points */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
                <div className="flex items-center mb-2">
                  <span className='p-3 bg-accent-500 rounded-full shadow-lg mr-2 flex items-center justify-center'>
                    <TrophyIcon className="h-6 w-6 text-white" />
                  </span>
                  <span className="text-3xl text-gray-800">#{currentUserStats.ranking} <span className="text-2xl">({currentUserStats.totalPoints} points)</span></span>
                </div>
                <div className="text-base text-gray-800">{t('stats.allTimeRanking')}</div>
                <div className="text-xs text-gray-500">{t('stats.outOfUsers', { count: leaderboardData?.totalUsers || 0 })}</div>
              </div>
              {/* Average Points per Game */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
                <div className="flex items-center mb-2">
                  <span className='p-3 bg-accent-500 rounded-full shadow-lg mr-2 flex items-center justify-center'>
                    <ChartBarIcon className="h-6 w-6 text-white" />
                  </span>
                  <span className="text-3xl text-gray-800">{Number(currentUserStats.averagePoints).toFixed(3)}</span>
                </div>
                <div className="text-base text-gray-800">{t('stats.avgPointsGame')}</div>
                <div className="text-xs text-gray-500">{t('stats.basedOnGames', { count: currentUserStats.totalPredictions })}</div>
              </div>
              {/* Competitions Won */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 hover:shadow-lg transition-all">
                <div className="flex items-center mb-2">
                  <span className='p-3 bg-accent-500 rounded-full shadow-lg mr-2 flex items-center justify-center'>
                    <TrophyIcon className="h-6 w-6 text-white" />
                  </span>
                  <span className="text-3xl text-gray-800">{currentUserStats.wins}</span>
                </div>
                <div className="text-base text-gray-800">{t('stats.competitionsWon')}</div>
                <div className="text-xs text-gray-500">{t('stats.totalVictories')}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">
                {loading ? t('stats.fetchingStatistics') : 'Chargement des statistiques personnelles...'}
              </div>
              <div className="text-sm text-gray-400">
                Debug: currentUserStats = {currentUserStats ? 'loaded' : 'null'}, leaderboardData = {leaderboardData ? 'loaded' : 'null'}
              </div>
            </div>
          )}

        </section>

        {/* Statistiques Globales */}
        <section className="bg-white rounded-2xl shadow-2xl p-6 mb-8 border border-gray-200">
          <div className="flex items-center mb-6">
            <span className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
              <UserGroupIcon className="h-6 w-6 text-white" />
            </span>
            <h2 className="text-xl font-bold text-neutral-900">Statistiques Globales</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Meilleurs Marqueurs */}
            <div className="bg-[#f9fafb] border border-gray-300 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 mb-4 flex items-center">
                {t('stats.topPlayersAllTime')}
              </h3>
              <div className="text-xs text-gray-500 mb-4">
                Données depuis UEFA Euro 2016
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  leaderboardData.topPlayersByPoints.slice(0, 10).map((player, index) => (
                    <React.Fragment key={player.id}>
                      <div
                        className={"flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 cursor-pointer hover:bg-primary-50" + 
                          (expandedUserId === player.id ? " ring-2 ring-primary-400 bg-blue-100" : "") +
                          (player.id === currentUser.id ? " bg-blue-50 ring-2 ring-blue-300 border-blue-300" : " bg-neutral-50")}
                        onClick={() => handleUserClick(player)}
                        title="Voir le détail par compétition"
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-500' : 'text-gray-700'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                          />
                          <div>
                            <span className="font-medium text-neutral-900">{player.name}</span>
                            <p className="text-xs text-neutral-500">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900">{player.stats.totalPoints} {t('stats.points').toLowerCase()}</span>
                      </div>
                      
                      {/* Inline Breakdown - Only for this specific player */}
                      {expandedUserId === player.id && (
                        <div className="mt-2 p-3 bg-neutral-50 border border-neutral-200/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-600">
                              {t('pointsBreakdownByCompetition') || 'Points breakdown by competition'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedUserId(null);
                              }}
                              className="text-neutral-400 hover:text-neutral-600 transition-colors"
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
                                  <span className="text-neutral-600 truncate pr-2">{item.competition}</span>
                                  <span className="font-semibold text-neutral-900">{item.total_points} pts</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-1 text-neutral-500 text-xs">Aucune donnée</div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <div className="text-center py-4 text-neutral-500">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Meilleure Moyenne */}
            <div className="bg-[#f9fafb] border border-gray-300 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 mb-4 flex items-center">
                {t('stats.bestAverage')}
              </h3>
              <div className="text-xs text-gray-500 mb-4">
                Données depuis UEFA Euro 2016
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByAverage ? (
                  leaderboardData.topPlayersByAverage.slice(0, 10).map((player, index) => (
                    <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 ${
                      player.id === currentUser.id ? "bg-blue-50 ring-2 ring-blue-300 border-blue-300" : "bg-neutral-50"
                    }`}>
                      <div className="flex items-center space-x-3">
                        <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-500' : 'text-gray-700'}`}>{index + 1}.</span>
                        <img 
                          src={getUserAvatar(player.name)} 
                          alt={player.name}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                        />
                        <div>
                          <span className="font-medium text-neutral-900">{player.name}</span>
                          <p className="text-xs text-neutral-500">{player.stats.totalPredictions} {t('stats.games')}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-neutral-900">{truncateTo3Decimals(player.averagePoints ?? 0)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-neutral-500">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Total 1-N-2 Corrects */}
            <div className="bg-[#f9fafb] border border-gray-300 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 mb-4 flex items-center">
                Total 1-N-2 Corrects
              </h3>
              <div className="text-xs text-gray-500 mb-4">
                Données depuis Champions League 25/26
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  [...leaderboardData.topPlayersByPoints]
                    .sort((a, b) => (b.stats.correctOutcomes || 0) - (a.stats.correctOutcomes || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                      <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 ${
                        player.id === currentUser.id ? "bg-blue-50 ring-2 ring-blue-300 border-blue-300" : "bg-neutral-50"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-500' : 'text-gray-700'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                          />
                          <div>
                            <span className="font-medium text-neutral-900">{player.name}</span>
                            <p className="text-xs text-neutral-500">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900">{player.stats.correctOutcomes || 0}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-neutral-500">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Most Exact Scores */}
            <div className="bg-[#f9fafb] border border-gray-300 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 mb-4 flex items-center">
                {t('stats.mostExactScores')}
              </h3>
              <div className="text-xs text-gray-500 mb-4">
                Données depuis Champions League 25/26
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  [...leaderboardData.topPlayersByPoints]
                    .sort((a, b) => (b.stats.exactScores || 0) - (a.stats.exactScores || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                      <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 ${
                        player.id === currentUser.id ? "bg-blue-50 ring-2 ring-blue-300 border-blue-300" : "bg-neutral-50"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-500' : 'text-gray-700'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                          />
                          <div>
                            <span className="font-medium text-neutral-900">{player.name}</span>
                            <p className="text-xs text-neutral-500">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900">{player.stats.exactScores || 0}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-neutral-500">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* No-Show (Shooters) */}
            <div className="bg-[#f9fafb] border border-gray-300 rounded-xl p-6 shadow-xl flex flex-col justify-between">
              <h3 className="text-gray-900 mb-4 flex items-center">
                No-Show (Shooters)
              </h3>
              <div className="text-xs text-gray-500 mb-4">
                Données depuis Champions League 25/26
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
                  </div>
                ) : leaderboardData?.topPlayersByPoints ? (
                  [...leaderboardData.topPlayersByPoints]
                    .sort((a, b) => (b.stats.forgottenBets || 0) - (a.stats.forgottenBets || 0))
                    .slice(0, 10)
                    .map((player, index) => (
                      <div key={player.id} className={`flex items-center justify-between p-3 rounded-xl border border-neutral-200/50 ${
                        player.id === currentUser.id ? "bg-blue-50 ring-2 ring-blue-300 border-blue-300" : "bg-neutral-50"
                      }`}>
                        <div className="flex items-center space-x-3">
                          <span className={`text-lg font-medium mr-2 ${index === 0 ? 'text-red-500' : index === 1 ? 'text-orange-500' : index === 2 ? 'text-yellow-500' : 'text-gray-700'}`}>{index + 1}.</span>
                          <img 
                            src={getUserAvatar(player.name)} 
                            alt={player.name}
                            className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                          />
                          <div>
                            <span className="font-medium text-neutral-900">{player.name}</span>
                            <p className="text-xs text-neutral-500">{player.stats.totalPredictions} {t('stats.games')}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-neutral-900">{player.stats.forgottenBets || 0}</span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-neutral-500">{t('stats.noDataAvailable')}</div>
                )}
              </div>
            </div>

            {/* Most Competitions Won */}
            <div className="bg-[#f9fafb] border border-gray-300 rounded-xl p-6 shadow-xl flex flex-col justify-between lg:col-span-3">
              <h3 className="text-gray-900 mb-4 flex items-center text-lg">
                {t('stats.mostCompetitionsWon')}
              </h3>
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
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
                        groupIndex === 0 ? 'border-yellow-400 bg-yellow-50' :
                        groupIndex === 1 ? 'border-gray-400 bg-gray-50' :
                        groupIndex === 2 ? 'border-orange-400 bg-orange-50' :
                        'border-blue-400 bg-blue-50'
                      }`}>
                        <div className="flex items-center mb-3">
                          <span className={`text-lg font-medium mr-2 ${groupIndex === 0 ? 'text-yellow-500' : groupIndex === 1 ? 'text-gray-400' : groupIndex === 2 ? 'text-orange-500' : 'text-gray-700'}`}>{winCount}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupedByWins[winCount].map((player) => (
                            <div key={player.name} className="flex items-start space-x-3 bg-white rounded-lg p-4 shadow border border-gray-200 min-w-0 flex-1">
                              <img 
                                src={getUserAvatar(player.name)} 
                                alt={player.name}
                                className="w-10 h-10 rounded-full border-2 border-yellow-400 flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-gray-900 text-sm mb-2">{player.name}</div>
                                <div className="space-y-1">
                                  {player.wonCompetitions.split(', ').map((competition, index) => (
                                    <div key={index} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border">
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
        <section className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6 mb-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
              <TrophyIcon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Historique des Compétitions</h2>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {t('stats.competition')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {t('stats.period')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {t('stats.winner')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {t('stats.points')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {t('stats.avgPointsGame')}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {t('stats.participants')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div>
                        <p className="text-sm text-neutral-500 mt-2">{t('loading')}...</p>
                      </td>
                    </tr>
                  ) : leaderboardData?.competitions && leaderboardData.competitions.length > 0 ? (
                    leaderboardData.competitions
                      .filter(competition => competition.status === 'COMPLETED' || competition.status === 'completed')
                      .map((competition) => {
                        return (
                          <tr 
                            key={competition.id} 
                            className="hover:bg-yellow-50 transition-colors cursor-pointer"
                            onClick={() => router.push(`/competitions/${competition.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {competition.logo ? (
                                    <img 
                                      src={competition.logo} 
                                      alt={`${competition.name} logo`}
                                      className="h-10 w-10 object-contain"
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
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                                  >
                                    {competition.name}
                                  </Link>
                                  <div className="text-sm text-neutral-500">
                                    {competition.name.includes('Euro') ? t('stats.europeanChampionship') : 
                                     competition.name.includes('World Cup') ? t('stats.fifaWorldCup') : 
                                     competition.name.includes('Champions League') ? t('stats.uefaChampionsLeague') :
                                     t('stats.footballCompetition')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-neutral-900">
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
                              <div className="text-sm text-neutral-500">
                                {Math.ceil((new Date(competition.endDate).getTime() - new Date(competition.startDate).getTime()) / (1000 * 60 * 60 * 24))} {t('stats.days')}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {competition.winner ? (
                                <div className="flex items-center">
                                  <img 
                                    src={getUserAvatar(competition.winner.name)} 
                                    alt={competition.winner.name}
                                    className="w-8 h-8 rounded-full mr-3 border-2 border-yellow-400"
                                  />
                                  <div>
                                    <div className="text-sm font-medium text-neutral-900 flex items-center">
                                      {competition.winner.name}
                                    </div>
                                    <div className="text-sm text-neutral-500">{t('stats.champion')}</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-500">{t('stats.noWinnerSet')}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {competition.winner ? (
                                <div className="text-lg font-bold text-yellow-600">
                                  {competition.winnerPoints}
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-500">-</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {competition.winner && competition.gameCount > 0 ? (
                                <div className="text-sm font-medium text-neutral-900">
                                  {(competition.winnerPoints / competition.gameCount).toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-sm text-neutral-500">-</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-neutral-900">{competition.participantCount}</div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                        {t('stats.noCompetitionHistory')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Competition Summary Stats */}
            {!loading && leaderboardData && (
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {leaderboardData.competitions?.filter(comp => comp.status === 'COMPLETED' || comp.status === 'completed').length || 0}
                    </div>
                    <div className="text-sm text-neutral-600">{t('stats.completedCompetitions')}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {leaderboardData.topPlayersByPoints.reduce((sum, player) => sum + player.stats.totalPoints, 0)}
                    </div>
                    <div className="text-sm text-neutral-600">{t('stats.totalPointsScored')}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary-600">
                      {leaderboardData.topPlayersByPoints.reduce((sum, player) => sum + player.stats.totalPredictions, 0)}
                    </div>
                    <div className="text-sm text-neutral-600">{t('stats.totalPredictions')}</div>
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