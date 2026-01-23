import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';

interface Team {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  category: 'NATIONAL' | 'CLUB';
  sportType?: 'FOOTBALL' | 'RUGBY' | null;
  sportTypes?: string[];
  country?: string | null;
}

const DEFAULT_LOGO = 'https://via.placeholder.com/40x40?text=Logo';

export default function TeamsAdmin() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation('common');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<'ALL' | 'FOOTBALL' | 'RUGBY'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'NATIONAL' | 'CLUB'>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logo, setLogo] = useState('');
  const [category, setCategory] = useState<'NATIONAL' | 'CLUB'>('NATIONAL');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTeams();
    }
  }, [status, fetchTeams]);

  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role.toLowerCase() !== 'admin')) {
      router.push('/');
    }
  }, [session, status, router]);

  const openAddModal = () => {
    setModalMode('add');
    setEditTeamId(null);
    setName('');
    setShortName('');
    setLogo('');
    setCategory('NATIONAL');
    setError('');
    setShowModal(true);
  };

  const openEditModal = (team: Team) => {
    setModalMode('edit');
    setEditTeamId(team.id);
    setName(team.name);
    setShortName(team.shortName || '');
    setLogo(team.logo || '');
    setCategory(team.category);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setError('');
    if (!name) {
      setError('Team name is required');
      return;
    }
    setLoading(true);
    if (modalMode === 'add') {
      await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, shortName, logo, category }),
      });
    } else if (modalMode === 'edit' && editTeamId) {
      await fetch(`/api/admin/teams?id=${editTeamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, shortName, logo, category }),
      });
    }
    setShowModal(false);
    setLoading(false);
    setName('');
    setShortName('');
    setLogo('');
    setCategory('NATIONAL');
    setEditTeamId(null);
    fetchTeams();
  };

  const openDeleteModal = (teamId: string) => {
    setDeleteTeamId(teamId);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTeamId) return;
    setDeleteLoading(true);
    await fetch(`/api/admin/teams?id=${deleteTeamId}`, {
      method: 'DELETE',
    });
    setDeleteLoading(false);
    setShowDeleteConfirm(false);
    setDeleteTeamId(null);
    fetchTeams();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-accent-dark-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('dashboard.loading')}</p>
          </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Erreur</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={fetchTeams}
            className="px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 text-sm font-medium transition"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Équipes</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Gérez les équipes nationales et de club</p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg shadow-sm hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition-all text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle équipe
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder={t('admin.teams.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                  />
                </div>
              </div>

              {/* Sport Filter */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSportFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    sportFilter === 'ALL'
                      ? 'bg-primary-600 dark:bg-accent-dark-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setSportFilter('FOOTBALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    sportFilter === 'FOOTBALL'
                      ? 'bg-blue-600 dark:bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Football
                </button>
                <button
                  onClick={() => setSportFilter('RUGBY')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    sportFilter === 'RUGBY'
                      ? 'bg-orange-600 dark:bg-orange-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Rugby
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    categoryFilter === 'ALL'
                      ? 'bg-primary-600 dark:bg-accent-dark-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setCategoryFilter('NATIONAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    categoryFilter === 'NATIONAL'
                      ? 'bg-yellow-600 dark:bg-yellow-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Nationales
                </button>
                <button
                  onClick={() => setCategoryFilter('CLUB')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    categoryFilter === 'CLUB'
                      ? 'bg-green-600 dark:bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Clubs
                </button>
              </div>

              {/* Country Filter */}
              {(() => {
                const countries = Array.from(new Set(teams.map(t => t.country).filter(Boolean))).sort() as string[];
                if (countries.length > 0) {
                  return (
                    <select
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                    >
                      <option value="ALL">Tous les pays</option>
                      {countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>

        {(() => {
          // Filter teams by sport, category, country, and search query
          const filteredTeams = teams.filter(team => {
            const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesSport = sportFilter === 'ALL' || team.sportType === sportFilter;
            const matchesCategory = categoryFilter === 'ALL' || team.category === categoryFilter;
            const matchesCountry = countryFilter === 'ALL' || team.country === countryFilter;
            return matchesSearch && matchesSport && matchesCategory && matchesCountry;
          });
          
          // Group by sport type when showing all sports
          const footballTeams = filteredTeams.filter(team => team.sportType === 'FOOTBALL' || !team.sportType);
          const rugbyTeams = filteredTeams.filter(team => team.sportType === 'RUGBY');
          
          const footballNational = footballTeams.filter(team => team.category === 'NATIONAL');
          const footballClub = footballTeams.filter(team => team.category === 'CLUB');
          const rugbyNational = rugbyTeams.filter(team => team.category === 'NATIONAL');
          const rugbyClub = rugbyTeams.filter(team => team.category === 'CLUB');
          
          const nationalTeams = filteredTeams.filter(team => team.category === 'NATIONAL');
          const clubTeams = filteredTeams.filter(team => team.category === 'CLUB');
          
          // If category filter is set, show only that category in a single column
          const showSingleColumn = categoryFilter !== 'ALL';
          // If sport filter is 'ALL', show separate sections for Football and Rugby
          const showSportSections = sportFilter === 'ALL' && !showSingleColumn;
          
          return filteredTeams.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.teams.noTeams')}</p>
            </div>
          ) : showSingleColumn ? (
            // Single column view when category filter is active
            <div className="bg-white rounded-lg shadow p-3">
              <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <span className="mr-2">{categoryFilter === 'NATIONAL' ? '🏆' : '⚽'}</span>
                {categoryFilter === 'NATIONAL' ? 'Équipes nationales' : 'Équipes de club'} ({filteredTeams.length})
              </h2>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {filteredTeams
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((team) => (
                    <div key={team.id} className="border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <img
                            src={team.logo || DEFAULT_LOGO}
                            alt={team.name + ' logo'}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 bg-white"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== DEFAULT_LOGO) {
                                target.src = DEFAULT_LOGO;
                              }
                            }}
                          />
                          <div>
                            <div className="text-xs font-medium text-gray-800">{team.name}</div>
                            {team.shortName && <div className="text-xs text-gray-500">{team.shortName}</div>}
                            {team.sportType && (
                              <div className="text-xs mt-0.5">
                                <span className={`px-1.5 py-0.5 rounded ${
                                  team.sportType === 'RUGBY' 
                                    ? 'bg-orange-100 text-orange-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {team.sportType === 'RUGBY' ? 'Rugby' : 'Football'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openEditModal(team)}
                            className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition text-xs"
                            title="Modifier"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(team.id)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-xs"
                            title="Supprimer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {filteredTeams.length === 0 && (
                  <p className="text-gray-500 text-xs">Aucune équipe trouvée.</p>
                )}
              </div>
            </div>
          ) : showSportSections ? (
            // Show separate sections for Football and Rugby when sportFilter is 'ALL'
            <div className="space-y-6">
              {/* Football Section */}
              {(footballTeams.length > 0) && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <span className="mr-2">⚽</span>
                    Football ({footballTeams.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Football National Teams */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <span className="mr-2">🏆</span>
                          Équipes nationales ({footballNational.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                        {footballNational
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((team) => (
                          <div key={team.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={team.logo || DEFAULT_LOGO}
                                  alt={team.name + ' logo'}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src !== DEFAULT_LOGO) {
                                      target.src = DEFAULT_LOGO;
                                    }
                                  }}
                                />
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</div>
                                  {team.shortName && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{team.shortName}</div>}
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => openEditModal(team)}
                                  className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs"
                                  title="Modifier"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(team.id)}
                                  className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {footballNational.length === 0 && (
                          <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400 text-xs">Aucune équipe nationale trouvée.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Football Club Teams */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <span className="mr-2">⚽</span>
                          Équipes de club ({footballClub.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                        {footballClub
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((team) => (
                          <div key={team.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={team.logo || DEFAULT_LOGO}
                                  alt={team.name + ' logo'}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src !== DEFAULT_LOGO) {
                                      target.src = DEFAULT_LOGO;
                                    }
                                  }}
                                />
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</div>
                                  {team.shortName && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{team.shortName}</div>}
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => openEditModal(team)}
                                  className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs"
                                  title="Modifier"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(team.id)}
                                  className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {footballClub.length === 0 && (
                          <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400 text-xs">Aucune équipe de club trouvée.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rugby Section */}
              {(rugbyTeams.length > 0) && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <span className="mr-2">🏉</span>
                    Rugby ({rugbyTeams.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Rugby National Teams */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <span className="mr-2">🏆</span>
                          Équipes nationales ({rugbyNational.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                        {rugbyNational
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((team) => (
                          <div key={team.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={team.logo || DEFAULT_LOGO}
                                  alt={team.name + ' logo'}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src !== DEFAULT_LOGO) {
                                      target.src = DEFAULT_LOGO;
                                    }
                                  }}
                                />
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</div>
                                  {team.shortName && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{team.shortName}</div>}
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => openEditModal(team)}
                                  className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs"
                                  title="Modifier"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(team.id)}
                                  className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {rugbyNational.length === 0 && (
                          <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400 text-xs">Aucune équipe nationale trouvée.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rugby Club Teams */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                          <span className="mr-2">🏉</span>
                          Équipes de club ({rugbyClub.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                        {rugbyClub
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((team) => (
                          <div key={team.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={team.logo || DEFAULT_LOGO}
                                  alt={team.name + ' logo'}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.src !== DEFAULT_LOGO) {
                                      target.src = DEFAULT_LOGO;
                                    }
                                  }}
                                />
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</div>
                                  {team.shortName && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{team.shortName}</div>}
                                </div>
                              </div>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => openEditModal(team)}
                                  className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs"
                                  title="Modifier"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(team.id)}
                                  className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs"
                                  title="Supprimer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {rugbyClub.length === 0 && (
                          <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400 text-xs">Aucune équipe de club trouvée.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* National Teams Column */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <span className="mr-2">🏆</span>
                    Équipes nationales ({nationalTeams.length})
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
                  {nationalTeams
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((team) => (
                    <div key={team.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            src={team.logo || DEFAULT_LOGO}
                            alt={team.name + ' logo'}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== DEFAULT_LOGO) {
                                target.src = DEFAULT_LOGO;
                              }
                            }}
                          />
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</div>
                            {team.shortName && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{team.shortName}</div>}
                            {team.sportType && (
                              <div className="text-xs mt-1.5">
                                <span className={`px-2 py-0.5 rounded-full font-medium ${
                                  team.sportType === 'RUGBY' 
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' 
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                }`}>
                                  {team.sportType === 'RUGBY' ? 'Rugby' : 'Football'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openEditModal(team)}
                            className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(team.id)}
                            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs"
                            title="Supprimer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {nationalTeams.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-gray-500 dark:text-gray-400 text-xs">Aucune équipe nationale trouvée.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Club Teams Column */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <span className="mr-2">⚽</span>
                    Équipes de club ({clubTeams.length})
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
                  {clubTeams
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((team) => (
                    <div key={team.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            src={team.logo || DEFAULT_LOGO}
                            alt={team.name + ' logo'}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== DEFAULT_LOGO) {
                                target.src = DEFAULT_LOGO;
                              }
                            }}
                          />
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{team.name}</div>
                            {team.shortName && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{team.shortName}</div>}
                            {team.sportType && (
                              <div className="text-xs mt-1.5">
                                <span className={`px-2 py-0.5 rounded-full font-medium ${
                                  team.sportType === 'RUGBY' 
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' 
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                }`}>
                                  {team.sportType === 'RUGBY' ? 'Rugby' : 'Football'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openEditModal(team)}
                            className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(team.id)}
                            className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs"
                            title="Supprimer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {clubTeams.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-gray-500 dark:text-gray-400 text-xs">Aucune équipe de club trouvée.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 dark:bg-gray-900/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">{modalMode === 'add' ? 'Ajouter une équipe' : 'Modifier l\'équipe'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nom de l'équipe<span className="text-red-500 dark:text-red-400">*</span></label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500"
                    placeholder={t('admin.teams.namePlaceholder')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nom court</label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500"
                    placeholder={t('admin.teams.shortNamePlaceholder')}
                    value={shortName}
                    onChange={e => setShortName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo URL</label>
                  <input
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500"
                    placeholder={t('admin.teams.logoPlaceholder')}
                    value={logo}
                    onChange={e => setLogo(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Catégorie</label>
                  <select
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500"
                    value={category}
                    onChange={e => setCategory(e.target.value as 'NATIONAL' | 'CLUB')}
                    disabled={loading}
                  >
                    <option value="NATIONAL">NATIONAL</option>
                    <option value="CLUB">CLUB</option>
                  </select>
                </div>
                {error && <div className="text-red-600 dark:text-red-400 text-sm mt-2">{error}</div>}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg shadow-sm hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition disabled:opacity-50 font-medium"
                  disabled={loading}
                >
                  {loading ? (modalMode === 'add' ? t('creating') : t('saving')) : (modalMode === 'add' ? t('create') : t('save'))}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 dark:bg-gray-900/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Supprimer l'équipe</h2>
              <p className="mb-6 text-gray-700 dark:text-gray-300">Êtes-vous sûr de vouloir supprimer cette équipe ? Cette action est irréversible.</p>
              <div className="flex justify-end space-x-3">
                  <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                  disabled={deleteLoading}
                  >
                  Annuler
                  </button>
                  <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg shadow-sm hover:bg-red-700 dark:hover:bg-red-600 transition disabled:opacity-50 font-medium"
                  disabled={deleteLoading}
                  >
                  {deleteLoading ? t('deleting') : t('delete')}
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 