import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from '@hooks/useTranslation';

interface Campaign {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
}

function hasRole(user: unknown): user is { role: string } {
  return (
    typeof user === 'object' &&
    user !== null &&
    'role' in user &&
    typeof (user as { role: string }).role === 'string'
  );
}

export default function AdminCampaignDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { campaignId } = router.query; // Get the campaignId from the URL
  const { t } = useTranslation('common');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (!hasRole(session.user) || session.user.role.toLowerCase() !== 'admin')) {
      router.push('/dashboard');
    }
  }, [status, router, session]);

  const fetchCampaignDetails = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/campaigns/${id}`); // We will create this API endpoint next

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch campaign details');
      }

      const campaignData = await response.json();
      setCampaign(campaignData);
    } catch (err) {
      console.error('Error fetching campaign details:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching campaign details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && campaignId) {
      // Ensure campaignId is a string, it can be string[] in dynamic routes
      const id = Array.isArray(campaignId) ? campaignId[0] : campaignId;
      fetchCampaignDetails(id);
    }
  }, [status, campaignId, fetchCampaignDetails]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.campaigns.loading')}</p> {/* Reuse loading translation */}
        </div>
      </div>
    );
  }

   if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button onClick={() => {
            const id = Array.isArray(campaignId) ? campaignId[0] : campaignId;
            if (id) {
              fetchCampaignDetails(id);
            }
          }} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Retry</button>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <p>{t('admin.campaigns.notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="mt-2 text-gray-600">{campaign.description}</p>
          <div className="mt-4 text-sm text-gray-500">
            <p>{t('admin.campaigns.start')}: {new Date(campaign.startDate).toLocaleDateString('fr-FR')}</p>
            <p>{t('admin.campaigns.end')}: {new Date(campaign.endDate).toLocaleDateString('fr-FR')}</p>
            <p>{t('admin.campaigns.status.title')}: {t(`admin.campaigns.status.${campaign.status.toLowerCase()}`)}</p>
          </div>
        </div>

        {/* Game management section will go here */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">{t('admin.games.title')} for this Campaign</h2>
          {/* List of games and Add Game button will go here */}
          <p className="text-gray-500">Game management features coming soon...</p>
        </div>

      </div>
    </div>
  );
} 