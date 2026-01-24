import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import Link from 'next/link';

export default function AdminConfig() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session.user as { role?: string })?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, router, session]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [campaignsRes, gamesRes] = await Promise.all([
        fetch('/api/admin/campaigns'),
        fetch('/api/admin/games')
      ]);

      if (!campaignsRes.ok || !gamesRes.ok) throw new Error('Failed to fetch data');

      await Promise.all([
        campaignsRes.json(),
        gamesRes.json()
      ]);

      // campaigns and games are no longer used in the component
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-accent-dark-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)]">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('admin.title')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('admin.description')}</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/competitions"
            className="group relative bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.campaigns.title')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.campaigns.manageCampaignsDesc')}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></div>
          </Link>

          <Link
            href="/admin/teams"
            className="group relative bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Équipes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gérez les équipes nationales et de club</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-600 dark:bg-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></div>
          </Link>

          <Link
            href="/admin/users"
            className="group relative bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('admin.users.title')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.users.manageUsersDesc')}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600 dark:bg-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></div>
          </Link>

          <Link
            href="/admin/live-sync"
            className="group relative bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Live Score Sync</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Surveillez la synchronisation des scores en direct</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600 dark:bg-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></div>
          </Link>
        </div>
      </div>
    </div>
  );
} 