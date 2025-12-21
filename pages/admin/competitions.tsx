import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from '../../hooks/useTranslation';
import Link from 'next/link';

interface Competition {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
}

export default function AdminCompetitions() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCompetitionModal, setShowNewCompetitionModal] = useState(false);
  const [newCompetitionData, setNewCompetitionData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [submittingNewCompetition, setSubmittingNewCompetition] = useState(false);
  const [newCompetitionError, setNewCompetitionError] = useState<string | null>(null);

  // State for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [competitionToDeleteId, setCompetitionToDeleteId] = useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deletingCompetition, setDeletingCompetition] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && (session.user as { role?: string })?.role?.toLowerCase() !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, router, session]);

  const fetchCompetitions = useCallback(async () => {
    try {
      setLoading(true);
      const competitionsRes = await fetch('/api/admin/competitions');

      if (!competitionsRes.ok) throw new Error('Failed to fetch competitions');

      const competitionsData = await competitionsRes.json();
      setCompetitions(competitionsData.competitions || []);
    } catch (error) {
      console.error('Error fetching admin competitions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCompetitions();
    }
  }, [status, fetchCompetitions]);

  const openNewCompetitionModal = useCallback(() => setShowNewCompetitionModal(true), []);
  const closeNewCompetitionModal = useCallback(() => {
    setShowNewCompetitionModal(false);
    setNewCompetitionData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
    }); // Reset form data on close
    setNewCompetitionError(null); // Clear error on close
  }, []);

  const handleNewCompetitionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCompetitionData((prevData) => ({ ...prevData, [name]: value }));
  }, []);

  const handleCreateCompetition = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingNewCompetition(true);
    setNewCompetitionError(null);

    // TODO: Implement API call to create competition
    console.log('Creating competition with data:', newCompetitionData);

    // Simulate API call success/failure
    try {
      const response = await fetch('/api/admin/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCompetitionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create competition');
      }

      // Assuming success, navigate to the new competition's detail page
      const newCompetition = await response.json();
      console.log('Newly created competition:', newCompetition);
      console.log('Navigating to competition ID:', newCompetition.id);
      closeNewCompetitionModal(); // Close modal before navigation
      router.push(`/admin/competitions/${newCompetition.id}`);

    } catch (error) {
      console.error('Error creating competition:', error);
      setNewCompetitionError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setSubmittingNewCompetition(false);
    }
  }, [newCompetitionData, fetchCompetitions, closeNewCompetitionModal]);

  const openDeleteModal = useCallback((competitionId: string) => {
    setCompetitionToDeleteId(competitionId);
    setShowDeleteModal(true);
    setDeleteConfirmationText(''); // Clear previous input
    setDeletingCompetition(false); // Reset deleting state
  }, []);

  const closeDeleteModal = useCallback(() => {
    setCompetitionToDeleteId(null);
    setShowDeleteModal(false);
    setDeleteConfirmationText('');
    setDeletingCompetition(false);
  }, []);

  const handleDeleteCompetition = useCallback(async () => {
    if (!competitionToDeleteId || deleteConfirmationText.toLowerCase() !== 'delete') return;

    setDeletingCompetition(true);

    try {
      const response = await fetch(`/api/admin/competitions/${competitionToDeleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Handle specific errors if needed, e.g., not found, forbidden
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete competition');
      }

      // Remove the deleted competition from the state
      setCompetitions(prevCompetitions =>
        prevCompetitions.filter(comp => comp.id !== competitionToDeleteId)
      );

      closeDeleteModal(); // Close modal on success
    } catch (error) {
      console.error('Error deleting competition:', error);
      // Optionally show an error message to the user
      alert(error instanceof Error ? error.message : 'An error occurred while deleting the competition.');
    } finally {
      setDeletingCompetition(false);
    }
  }, [competitionToDeleteId, deleteConfirmationText, closeDeleteModal]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.competitions.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-4 px-3 sm:px-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('admin.competitions.title')}</h1>
              <p className="mt-1 text-xs text-gray-600">Gérez les compétitions et leurs campagnes</p>
            </div>
            <button
              onClick={openNewCompetitionModal}
              className="mt-2 sm:mt-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg shadow-md hover:bg-primary-700 transition-all text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('admin.competitions.new')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3">
          <div className="space-y-2">
            {competitions.length > 0 ? (
              competitions.map((competition) => (
                <div key={competition.id} className="border rounded-lg p-3 hover:bg-gray-50 flex justify-between items-center">
                  <Link
                    href={`/admin/competitions/${competition.id}`}
                    className="flex-1"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-sm text-gray-900">{competition.name}</h3>
                        <p className="text-xs text-gray-600 mt-0.5">{competition.description}</p>
                        <div className="mt-1.5 text-xs text-gray-500">
                          <p>{t('admin.competitions.start')}: {new Date(competition.startDate).toLocaleDateString('fr-FR')}</p>
                          <p>{t('admin.competitions.end')}: {new Date(competition.endDate).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ml-3 ${
                        competition.status === 'active' ? 'bg-green-100 text-green-800' :
                        competition.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        competition.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`admin.competitions.status.${competition.status.toLowerCase()}`)}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={() => openDeleteModal(competition.id)}
                    className="ml-3 p-1.5 rounded-md text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    title="Supprimer la compétition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">{t('admin.competitions.noCompetitions')}</p>
            )}
          </div>
        </div>

        {/* New Competition Modal */}
        {showNewCompetitionModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{t('admin.competitions.new')}</h3>
              <form onSubmit={handleCreateCompetition} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">{t('name')}</label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={newCompetitionData.name}
                    onChange={handleNewCompetitionInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">{t('description')}</label>
                  <textarea
                    name="description"
                    id="description"
                    value={newCompetitionData.description}
                    onChange={handleNewCompetitionInputChange}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  ></textarea>
                </div>
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">{t('admin.competitions.start')}</label>
                  <input
                    type="date"
                    name="startDate"
                    id="startDate"
                    value={newCompetitionData.startDate}
                    onChange={handleNewCompetitionInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">{t('admin.competitions.end')}</label>
                  <input
                    type="date"
                    name="endDate"
                    id="endDate"
                    value={newCompetitionData.endDate}
                    onChange={handleNewCompetitionInputChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  />
                </div>
                {newCompetitionError && (
                  <div className="text-red-600 text-sm">{newCompetitionError}</div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeNewCompetitionModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                    disabled={submittingNewCompetition}
                  >
                    {t('cancel')}
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={submittingNewCompetition}>
                    {submittingNewCompetition ? t('submitting') : t('create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{t('admin.competitions.deleteConfirmationTitle')}</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{t('admin.competitions.deleteConfirmationText')}</p>
                <input
                  type="text"
                  className="mt-2 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  placeholder={t('admin.competitions.typeDelete')}
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                  disabled={deletingCompetition}
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCompetition}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ${
                    deleteConfirmationText.toLowerCase() !== 'delete' || deletingCompetition ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={deleteConfirmationText.toLowerCase() !== 'delete' || deletingCompetition}
                >
                  {deletingCompetition ? t('submitting') : t('delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 