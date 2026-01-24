import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
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
  const [competitionType, setCompetitionType] = useState<'custom' | 'existing'>('custom');
  const [newCompetitionData, setNewCompetitionData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    sportType: 'FOOTBALL' as 'FOOTBALL' | 'RUGBY',
  });
  const [submittingNewCompetition, setSubmittingNewCompetition] = useState(false);
  const [newCompetitionError, setNewCompetitionError] = useState<string | null>(null);
  
  // External competition import state
  const [externalCompetitions, setExternalCompetitions] = useState<any[]>([]);
  const [externalCompetitionsData, setExternalCompetitionsData] = useState<any>(null);
  const [loadingExternalCompetitions, setLoadingExternalCompetitions] = useState(false);
  const [selectedExternalCompetition, setSelectedExternalCompetition] = useState<any | null>(null);
  const [competitionDetails, setCompetitionDetails] = useState<any | null>(null);
  const [loadingCompetitionDetails, setLoadingCompetitionDetails] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null); // Manually selected season
  const [importOnlyFutureGames, setImportOnlyFutureGames] = useState(true);
  const [importingCompetition, setImportingCompetition] = useState(false);
  
  // Filters
  const [competitionFilter, setCompetitionFilter] = useState<'all' | 'local' | 'international'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State for delete confirmation modal (2-step validation)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteFinalConfirmation, setShowDeleteFinalConfirmation] = useState(false);
  const [competitionToDeleteId, setCompetitionToDeleteId] = useState<string | null>(null);
  const [competitionToDeleteName, setCompetitionToDeleteName] = useState<string | null>(null);
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

  // Load/reload external competitions when competition type changes to 'existing' or sport type changes
  useEffect(() => {
    if (competitionType === 'existing' && showNewCompetitionModal) {
      console.log('[ADMIN COMPETITIONS] Loading external competitions. SportType:', newCompetitionData.sportType, 'Has existing data:', !!externalCompetitionsData);
      // ALWAYS clear existing data first to avoid showing stale data when switching sports
      // This is critical: we must clear data even if it doesn't exist yet, to ensure fresh data
      setExternalCompetitionsData(null);
      setExternalCompetitions([]);
      setSelectedExternalCompetition(null);
      setCompetitionDetails(null);
      setSelectedCountry(''); // Also reset country filter when sport changes
      // Use a ref to track if we're already fetching to prevent double calls
      let cancelled = false;
      const fetchData = async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to ensure state is cleared
        if (!cancelled) {
          console.log('[ADMIN COMPETITIONS] Actually fetching with sportType:', newCompetitionData.sportType);
          fetchExternalCompetitions();
        }
      };
      fetchData();
      
      return () => {
        cancelled = true; // Cancel if component unmounts or dependencies change
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCompetitionData.sportType, competitionType, showNewCompetitionModal]);

  const openNewCompetitionModal = useCallback(() => setShowNewCompetitionModal(true), []);
  const closeNewCompetitionModal = useCallback(() => {
    setShowNewCompetitionModal(false);
    setCompetitionType('custom');
    setNewCompetitionData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      sportType: 'FOOTBALL',
    }); // Reset form data on close
    setNewCompetitionError(null); // Clear error on close
    setExternalCompetitions([]);
    setExternalCompetitionsData(null);
    setSelectedExternalCompetition(null);
    setCompetitionDetails(null);
    setImportOnlyFutureGames(true);
    setCompetitionFilter('all');
    setSelectedCountry('');
    setSearchQuery('');
  }, []);

  const handleNewCompetitionInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCompetitionData((prevData) => ({ ...prevData, [name]: value }));
  }, []);

  const fetchExternalCompetitions = useCallback(async () => {
    setLoadingExternalCompetitions(true);
    setNewCompetitionError(null);
    try {
      const sportType = newCompetitionData.sportType || 'FOOTBALL';
      console.log('[ADMIN COMPETITIONS] Fetching external competitions for sport:', sportType);
      const response = await fetch(`/api/admin/competitions/external/list?sportType=${sportType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch external competitions');
      }
      const data = await response.json();
      console.log('[ADMIN COMPETITIONS] Received competitions data:', {
        total: data.competitions?.length || 0,
        local: data.localCompetitions?.length || 0,
        international: data.internationalCompetitions?.length || 0,
        countries: data.countries?.length || 0,
        sampleCompetitions: data.competitions?.slice(0, 3).map((c: any) => ({ name: c.name, country: c.country }))
      });
      setExternalCompetitionsData(data);
      // Set all competitions by default
      setExternalCompetitions(data.competitions || []);
    } catch (error) {
      console.error('Error fetching external competitions:', error);
      setNewCompetitionError(error instanceof Error ? error.message : 'Failed to load external competitions');
    } finally {
      setLoadingExternalCompetitions(false);
    }
  }, [newCompetitionData.sportType]);

  // Filter competitions based on selected filters
  const getFilteredCompetitions = useCallback(() => {
    if (!externalCompetitionsData) {
      console.log('[ADMIN COMPETITIONS] No external competitions data available');
      return [];
    }

    console.log('[ADMIN COMPETITIONS] Filtering competitions:', {
      currentSportType: newCompetitionData.sportType,
      competitionFilter,
      selectedCountry,
      totalCompetitions: externalCompetitionsData.competitions?.length || 0,
      localCompetitions: externalCompetitionsData.localCompetitions?.length || 0,
      internationalCompetitions: externalCompetitionsData.internationalCompetitions?.length || 0,
      competitionsByCountry: Object.keys(externalCompetitionsData.competitionsByCountry || {}),
      sampleCompetitions: externalCompetitionsData.competitions?.slice(0, 3).map((c: any) => ({ name: c.name, country: c.country })),
      hasCompetitionsByCountry: !!externalCompetitionsData.competitionsByCountry,
      competitionsByCountryKeys: externalCompetitionsData.competitionsByCountry ? Object.keys(externalCompetitionsData.competitionsByCountry) : []
    });

    let filtered: any[] = [];

    // Apply type filter
    if (competitionFilter === 'international') {
      filtered = externalCompetitionsData.internationalCompetitions || [];
      console.log(`[ADMIN COMPETITIONS] Filter: international, found ${filtered.length} competitions`);
    } else if (competitionFilter === 'local') {
      if (selectedCountry) {
        filtered = externalCompetitionsData.competitionsByCountry?.[selectedCountry] || [];
        console.log(`[ADMIN COMPETITIONS] Filter: local + country "${selectedCountry}", found ${filtered.length} competitions`);
      } else {
        filtered = externalCompetitionsData.localCompetitions || [];
        console.log(`[ADMIN COMPETITIONS] Filter: local (no country), found ${filtered.length} competitions`);
      }
    } else {
      // All
      if (selectedCountry) {
        filtered = externalCompetitionsData.competitionsByCountry?.[selectedCountry] || [];
        // Also include international
        filtered = [...filtered, ...(externalCompetitionsData.internationalCompetitions || [])];
        console.log(`[ADMIN COMPETITIONS] Filter: all + country "${selectedCountry}", found ${filtered.length} competitions`);
      } else {
        filtered = externalCompetitionsData.competitions || [];
        console.log(`[ADMIN COMPETITIONS] Filter: all (no country), found ${filtered.length} competitions from ${externalCompetitionsData.competitions?.length || 0} total`);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(comp => 
        comp.name.toLowerCase().includes(query) ||
        comp.country.toLowerCase().includes(query)
      );
    }

    console.log('[ADMIN COMPETITIONS] Final filtered competitions:', filtered.length, filtered.slice(0, 3).map((c: any) => ({ name: c.name, country: c.country })));

    // Sort by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [externalCompetitionsData, competitionFilter, selectedCountry, searchQuery, newCompetitionData.sportType]);

  const fetchCompetitionDetails = useCallback(async (competitionId: number) => {
    setLoadingCompetitionDetails(true);
    try {
      const sportType = newCompetitionData.sportType || 'FOOTBALL';
      const response = await fetch(`/api/admin/competitions/external/${competitionId}/details?sportType=${sportType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch competition details');
      }
      const data = await response.json();
      setCompetitionDetails(data);
    } catch (error) {
      console.error('Error fetching competition details:', error);
      setNewCompetitionError(error instanceof Error ? error.message : 'Failed to load competition details');
    } finally {
      setLoadingCompetitionDetails(false);
    }
  }, [newCompetitionData.sportType]);

  const handleCreateCompetition = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (competitionType === 'existing') {
      // Import from external API
      if (!selectedExternalCompetition) {
        setNewCompetitionError('Veuillez sélectionner une compétition');
        return;
      }
      
      // Check if a season is selected (either from seasons list or selectedSeason)
      let seasonToUse: string | null = null;
      
      if (competitionDetails?.seasons && competitionDetails.seasons.length > 0) {
        // Multiple seasons available - use selectedSeason
        if (!selectedSeason) {
          setNewCompetitionError('Veuillez sélectionner une saison');
          return;
        }
        seasonToUse = selectedSeason;
      } else if (competitionDetails?.selectedSeason) {
        // Single season available - use it
        seasonToUse = competitionDetails.selectedSeason.year;
      } else if (newCompetitionData.sportType === 'FOOTBALL') {
        // For Football, season is required
        setNewCompetitionError('Veuillez attendre le chargement des détails de la compétition');
        return;
      }
      // For Rugby, if no season is found, the import endpoint will handle season discovery

      setImportingCompetition(true);
      setNewCompetitionError(null);

      try {
        const response = await fetch('/api/admin/competitions/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            externalCompetitionId: selectedExternalCompetition.id,
            season: seasonToUse,
            importOnlyFutureGames,
            sportType: newCompetitionData.sportType,
          }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to import competition';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`;
            }
          } catch (e) {
            // If response is not JSON, use status text
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Imported competition:', result);
        closeNewCompetitionModal();
        fetchCompetitions(); // Refresh list
        router.push(`/admin/competitions/${result.competition.id}`);

      } catch (error) {
        console.error('Error importing competition:', error);
        setNewCompetitionError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setImportingCompetition(false);
      }
    } else {
      // Create custom competition
      setSubmittingNewCompetition(true);
      setNewCompetitionError(null);

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

        const newCompetition = await response.json();
        console.log('Newly created competition:', newCompetition);
        closeNewCompetitionModal();
        router.push(`/admin/competitions/${newCompetition.id}`);

      } catch (error) {
        console.error('Error creating competition:', error);
        setNewCompetitionError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setSubmittingNewCompetition(false);
      }
    }
  }, [competitionType, newCompetitionData, selectedExternalCompetition, competitionDetails, selectedSeason, importOnlyFutureGames, closeNewCompetitionModal, fetchCompetitions, router]);

  const openDeleteModal = useCallback((competitionId: string, competitionName: string) => {
    setCompetitionToDeleteId(competitionId);
    setCompetitionToDeleteName(competitionName);
    setShowDeleteModal(true);
    setShowDeleteFinalConfirmation(false); // Start with step 1
    setDeleteConfirmationText(''); // Clear previous input
    setDeletingCompetition(false); // Reset deleting state
  }, []);

  const closeDeleteModal = useCallback(() => {
    setCompetitionToDeleteId(null);
    setCompetitionToDeleteName(null);
    setShowDeleteModal(false);
    setShowDeleteFinalConfirmation(false);
    setDeleteConfirmationText('');
    setDeletingCompetition(false);
  }, []);

  const proceedToFinalConfirmation = useCallback(() => {
    setShowDeleteFinalConfirmation(true);
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
    <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)]">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('admin.competitions.title')}</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Gérez les compétitions et leurs campagnes</p>
            </div>
            <button
              onClick={openNewCompetitionModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg shadow-sm hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition-all text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('admin.competitions.new')}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {competitions.length > 0 ? (
              competitions.map((competition) => (
                <div key={competition.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <Link
                      href={`/admin/competitions/${competition.id}`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{competition.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{competition.description}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{t('admin.competitions.start')}: <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(competition.startDate).toLocaleDateString('fr-FR')}</span></span>
                            <span>{t('admin.competitions.end')}: <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(competition.endDate).toLocaleDateString('fr-FR')}</span></span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                          competition.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                          competition.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                          competition.status === 'upcoming' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                          'bg-gray-100 dark:bg-[rgb(40,40,40)] text-gray-800 dark:text-gray-300'
                        }`}>
                          {t(`admin.competitions.status.${competition.status.toLowerCase()}`)}
                        </span>
                      </div>
                    </Link>
                    <button
                      onClick={() => openDeleteModal(competition.id, competition.name)}
                      className="ml-2 p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 transition-colors"
                      title="Supprimer la compétition"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.competitions.noCompetitions')}</p>
              </div>
            )}
          </div>
        </div>

        {/* New Competition Modal */}
        {showNewCompetitionModal && (
          <div className="fixed inset-0 bg-gray-900/50 dark:bg-[rgb(20,20,20)]/75 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <div className="relative p-6 border border-gray-200 dark:border-gray-600 w-full max-w-2xl shadow-xl rounded-xl bg-white dark:bg-[rgb(38,38,38)] max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white mb-6">{t('admin.competitions.new')}</h3>
              
              {/* Competition Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de compétition</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="competitionType"
                      value="custom"
                      checked={competitionType === 'custom'}
                      onChange={(e) => {
                        setCompetitionType('custom');
                        setSelectedExternalCompetition(null);
                        setCompetitionDetails(null);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Personnalisée</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="competitionType"
                      value="existing"
                      checked={competitionType === 'existing'}
                      onChange={(e) => {
                        setCompetitionType('existing');
                        // Reset filters and data when switching to existing
                        setSelectedCountry('');
                        setCompetitionFilter('all');
                        setSearchQuery('');
                        setSelectedExternalCompetition(null);
                        setCompetitionDetails(null);
                        // Clear existing data to force reload with current sportType
                        setExternalCompetitionsData(null);
                        setExternalCompetitions([]);
                        // Data will be loaded by useEffect when competitionType changes
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Depuis l'API (V2 uniquement)</span>
                  </label>
                </div>
              </div>

              <form onSubmit={handleCreateCompetition} className="mt-6 space-y-4">
                {competitionType === 'custom' ? (
                  <>
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('name')}</label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={newCompetitionData.name}
                        onChange={handleNewCompetitionInputChange}
                        required
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('description')}</label>
                      <textarea
                        name="description"
                        id="description"
                        value={newCompetitionData.description}
                        onChange={handleNewCompetitionInputChange}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-white"
                      ></textarea>
                    </div>
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.competitions.start')}</label>
                      <input
                        type="date"
                        name="startDate"
                        id="startDate"
                        value={newCompetitionData.startDate}
                        onChange={handleNewCompetitionInputChange}
                        required
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.competitions.end')}</label>
                      <input
                        type="date"
                        name="endDate"
                        id="endDate"
                        value={newCompetitionData.endDate}
                        onChange={handleNewCompetitionInputChange}
                        required
                        className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-white"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Sport Type Filter */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sport</label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="sportType"
                            value="FOOTBALL"
                            checked={newCompetitionData.sportType === 'FOOTBALL'}
                            onChange={(e) => {
                              setNewCompetitionData(prev => ({ ...prev, sportType: 'FOOTBALL' }));
                              setSelectedExternalCompetition(null);
                              setCompetitionDetails(null);
                              setSelectedCountry(''); // Reset country filter
                              // Data will be reloaded by useEffect when sportType changes
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Football</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="sportType"
                            value="RUGBY"
                            checked={newCompetitionData.sportType === 'RUGBY'}
                            onChange={(e) => {
                              setNewCompetitionData(prev => ({ ...prev, sportType: 'RUGBY' }));
                              setSelectedExternalCompetition(null);
                              setCompetitionDetails(null);
                              setSelectedCountry(''); // Reset country filter
                              // Data will be reloaded by useEffect when sportType changes
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Rugby</span>
                        </label>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="space-y-3">
                      {/* Type Filter */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                        <div className="flex gap-3">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="competitionFilter"
                              value="all"
                              checked={competitionFilter === 'all'}
                              onChange={(e) => {
                                setCompetitionFilter('all');
                                setSelectedCountry('');
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Toutes</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="competitionFilter"
                              value="local"
                              checked={competitionFilter === 'local'}
                              onChange={(e) => {
                                setCompetitionFilter('local');
                                setSelectedCountry('');
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Nationales</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="competitionFilter"
                              value="international"
                              checked={competitionFilter === 'international'}
                              onChange={(e) => {
                                setCompetitionFilter('international');
                                setSelectedCountry('');
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Internationales</span>
                          </label>
                        </div>
                      </div>

                      {/* Country Filter (only for local) */}
                      {competitionFilter === 'local' || (competitionFilter === 'all' && selectedCountry) ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Pays</label>
                          <select
                            value={selectedCountry}
                            onChange={(e) => {
                              setSelectedCountry(e.target.value);
                              setSelectedExternalCompetition(null);
                              setCompetitionDetails(null);
                            }}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                          >
                            <option value="">Tous les pays</option>
                            {externalCompetitionsData?.countries?.map((country: string) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {/* Search Filter */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedExternalCompetition(null);
                            setCompetitionDetails(null);
                          }}
                          placeholder="Nom de la compétition ou pays..."
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                        />
                      </div>
                    </div>

                    {/* External Competition Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Compétition
                        {getFilteredCompetitions().length > 0 && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({getFilteredCompetitions().length} résultat{getFilteredCompetitions().length > 1 ? 's' : ''})
                          </span>
                        )}
                      </label>
                      {loadingExternalCompetitions ? (
                        <div className="text-sm text-gray-500">Chargement...</div>
                      ) : (
                        <div className="relative">
                          {getFilteredCompetitions().length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 text-center border border-gray-300 rounded-md">
                              {searchQuery ? 'Aucun résultat trouvé' : 'Aucune compétition disponible'}
                            </div>
                          ) : (
                            <select
                              value={selectedExternalCompetition?.id || ''}
                              onChange={(e) => {
                                const comp = getFilteredCompetitions().find(c => c.id === parseInt(e.target.value));
                                setSelectedExternalCompetition(comp || null);
                                setSelectedSeason(null); // Reset selected season when changing competition
                                if (comp) {
                                  fetchCompetitionDetails(comp.id);
                                }
                                setCompetitionDetails(null);
                              }}
                              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                              required
                            >
                              <option value="">Sélectionner une compétition</option>
                              {getFilteredCompetitions().map((comp) => (
                                <option key={comp.id} value={comp.id}>
                                  {comp.name} {comp.country ? `(${comp.country})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Season Selection */}
                    {selectedExternalCompetition && (
                      <div>
                        {loadingCompetitionDetails ? (
                          <div className="text-sm text-gray-500">Chargement des détails...</div>
                        ) : competitionDetails ? (
                          <>
                            {competitionDetails.seasons && competitionDetails.seasons.length > 0 ? (
                              <>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Saison
                                </label>
                                <select
                                  value={selectedSeason || ''}
                                  onChange={(e) => setSelectedSeason(e.target.value)}
                                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                                  required
                                >
                                  <option value="">Sélectionner une saison</option>
                                  {competitionDetails.seasons.map((season: any) => (
                                    <option key={season.year} value={season.year}>
                                      {season.year}
                                      {season.current ? ' (En cours)' : ''}
                                      {season.start && season.end ? ` - Du ${new Date(season.start).toLocaleDateString('fr-FR')} au ${new Date(season.end).toLocaleDateString('fr-FR')}` : ''}
                                    </option>
                                  ))}
                                </select>
                                {selectedSeason && (() => {
                                  const season = competitionDetails.seasons.find((s: any) => s.year === selectedSeason);
                                  return season ? (
                                    <div className="mt-2 text-xs text-gray-500">
                                      Du {season.start ? new Date(season.start).toLocaleDateString('fr-FR') : 'N/A'} 
                                      {' au '}
                                      {season.end ? new Date(season.end).toLocaleDateString('fr-FR') : 'N/A'}
                                    </div>
                                  ) : null;
                                })()}
                              </>
                            ) : competitionDetails.selectedSeason ? (
                              <>
                                <div className="mb-2">
                                  <span className="text-sm font-medium text-gray-700">Saison sélectionnée: </span>
                                  <span className="text-sm text-gray-900">
                                    {competitionDetails.selectedSeason.year || 'N/A'}
                                    {competitionDetails.isOngoing && ' (En cours)'}
                                  </span>
                                </div>
                                <div className="mb-2 text-xs text-gray-500">
                                  Du {competitionDetails.selectedSeason.start ? new Date(competitionDetails.selectedSeason.start).toLocaleDateString('fr-FR') : 'N/A'} 
                                  {' au '}
                                  {competitionDetails.selectedSeason.end ? new Date(competitionDetails.selectedSeason.end).toLocaleDateString('fr-FR') : 'N/A'}
                                </div>
                              </>
                            ) : (
                              <div className="mb-2 text-sm text-yellow-600 dark:text-yellow-400">
                                ⚠️ Aucune saison détectée automatiquement. L'import tentera de découvrir la saison lors de l'importation.
                              </div>
                            )}
                            <label className="flex items-center mt-2">
                              <input
                                type="checkbox"
                                checked={importOnlyFutureGames}
                                onChange={(e) => setImportOnlyFutureGames(e.target.checked)}
                                className="mr-2"
                              />
                              <span className="text-sm text-gray-700">Importer uniquement les matchs futurs</span>
                            </label>
                          </>
                        ) : (
                          <div className="text-sm text-red-600 dark:text-red-400">Erreur lors du chargement des détails</div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {newCompetitionError && (
                  <div className="text-red-600 dark:text-red-400 text-sm">{newCompetitionError}</div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeNewCompetitionModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                    disabled={submittingNewCompetition || importingCompetition}
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" 
                    disabled={submittingNewCompetition || importingCompetition}
                  >
                    {submittingNewCompetition || importingCompetition 
                      ? t('submitting') 
                      : competitionType === 'existing' 
                        ? 'Importer' 
                        : t('create')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal - 2 Step Validation */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              {!showDeleteFinalConfirmation ? (
                // Step 1: Initial confirmation
                <>
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="ml-3 text-lg font-medium leading-6 text-gray-900">
                      Confirmer la suppression
                    </h3>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-700">
                      Êtes-vous sûr de vouloir supprimer la compétition <strong>"{competitionToDeleteName}"</strong> ?
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ Cette action est irréversible. Tous les matchs, paris et données associés seront également supprimés.
                    </p>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={closeDeleteModal}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={proceedToFinalConfirmation}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Continuer
                    </button>
                  </div>
                </>
              ) : (
                // Step 2: Final confirmation with text input
                <>
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <h3 className="ml-3 text-lg font-medium leading-6 text-gray-900">
                      Dernière confirmation
                    </h3>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-700 mb-3">
                      Pour confirmer la suppression de <strong>"{competitionToDeleteName}"</strong>, veuillez taper <strong>"delete"</strong> dans le champ ci-dessous :
                    </p>
                    <input
                      type="text"
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 focus:ring-red-500 focus:border-red-500"
                      placeholder='Tapez "delete" pour confirmer'
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteFinalConfirmation(false);
                        setDeleteConfirmationText('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                      disabled={deletingCompetition}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCompetition}
                      className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ${
                        deleteConfirmationText.toLowerCase() !== 'delete' || deletingCompetition ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={deleteConfirmationText.toLowerCase() !== 'delete' || deletingCompetition}
                    >
                      {deletingCompetition ? t('submitting') : 'Supprimer définitivement'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 