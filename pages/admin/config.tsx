import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from '../../hooks/useTranslation';
import Link from 'next/link';

export default function AdminConfig() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation('common');
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>
          <p className="mt-2 text-gray-600">{t('admin.description')}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/competitions"
              className="flex items-center p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <svg className="h-6 w-6 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="font-medium text-blue-900">{t('admin.campaigns.title')}</h3>
                </div>
                <p className="text-sm text-blue-700">{t('admin.campaigns.manageCampaignsDesc')}</p>
              </div>
            </Link>

            <div className="flex items-center p-6 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-200 opacity-50 cursor-not-allowed">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <svg className="h-6 w-6 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="font-medium text-green-900">{t('admin.games.title')}</h3>
                </div>
                <p className="text-sm text-green-700">{t('admin.games.manageGamesDesc')}</p>
              </div>
            </div>

            <div className="flex items-center p-6 bg-accent-50 rounded-lg hover:bg-accent-100 transition-colors border border-accent-200 opacity-50 cursor-not-allowed">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <svg className="h-6 w-6 text-accent-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h3 className="font-medium text-accent-900">{t('admin.users.title')}</h3>
                </div>
                <p className="text-sm text-accent-700">{t('admin.users.manageUsersDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 