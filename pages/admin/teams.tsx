import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../hooks/useTranslation';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('dashboard.loading')}</p>
          </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-red-600 mb-3">Erreur</h2>
          <p className="text-sm text-gray-700">{error}</p>
          <button
            onClick={fetchTeams}
            className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            {t('Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-4 px-3 sm:px-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-col items-center mb-3">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Équipes</h1>
              <p className="mt-1 text-xs text-gray-600">Gérez les équipes nationales et de club</p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg shadow-md hover:bg-primary-700 transition-all text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle équipe
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-3">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder={t('admin.teams.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
              />
              <svg
                className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
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
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            {/* Sport Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Sport:</label>
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value as 'ALL' | 'FOOTBALL' | 'RUGBY')}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">Tous</option>
                <option value="FOOTBALL">Football</option>
                <option value="RUGBY">Rugby</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Catégorie:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | 'NATIONAL' | 'CLUB')}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">Toutes</option>
                <option value="NATIONAL">Nationales</option>
                <option value="CLUB">Clubs</option>
              </select>
            </div>

            {/* Country Filter */}
            {(() => {
              const countries = Array.from(new Set(teams.map(t => t.country).filter(Boolean))).sort() as string[];
              if (countries.length > 0) {
                return (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-700">Pays:</label>
                    <select
                      value={countryFilter}
                      onChange={(e) => setCountryFilter(e.target.value)}
                      className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="ALL">Tous</option>
                      {countries.map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}
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
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">{t('admin.teams.noTeams')}</p>
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
            <div className="space-y-4">
              {/* Football Section */}
              {(footballTeams.length > 0) && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⚽</span>
                    Football ({footballTeams.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Football National Teams */}
                    <div className="bg-white rounded-lg shadow p-3">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <span className="mr-2">🏆</span>
                        Équipes nationales ({footballNational.length})
                      </h3>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {footballNational
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
                        {footballNational.length === 0 && (
                          <p className="text-gray-500 text-xs">Aucune équipe nationale trouvée.</p>
                        )}
                      </div>
                    </div>

                    {/* Football Club Teams */}
                    <div className="bg-white rounded-lg shadow p-3">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <span className="mr-2">⚽</span>
                        Équipes de club ({footballClub.length})
                      </h3>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {footballClub
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
                        {footballClub.length === 0 && (
                          <p className="text-gray-500 text-xs">Aucune équipe de club trouvée.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rugby Section */}
              {(rugbyTeams.length > 0) && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🏉</span>
                    Rugby ({rugbyTeams.length})
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Rugby National Teams */}
                    <div className="bg-white rounded-lg shadow p-3">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <span className="mr-2">🏆</span>
                        Équipes nationales ({rugbyNational.length})
                      </h3>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {rugbyNational
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
                        {rugbyNational.length === 0 && (
                          <p className="text-gray-500 text-xs">Aucune équipe nationale trouvée.</p>
                        )}
                      </div>
                    </div>

                    {/* Rugby Club Teams */}
                    <div className="bg-white rounded-lg shadow p-3">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <span className="mr-2">🏉</span>
                        Équipes de club ({rugbyClub.length})
                      </h3>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {rugbyClub
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
                        {rugbyClub.length === 0 && (
                          <p className="text-gray-500 text-xs">Aucune équipe de club trouvée.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* National Teams Column */}
              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">🏆</span>
                  Équipes nationales ({nationalTeams.length})
                </h2>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {nationalTeams
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
                  {nationalTeams.length === 0 && (
                    <p className="text-gray-500 text-xs">Aucune équipe nationale trouvée.</p>
                  )}
                </div>
              </div>

              {/* Club Teams Column */}
              <div className="bg-white rounded-lg shadow p-3">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">⚽</span>
                  Équipes de club ({clubTeams.length})
                </h2>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {clubTeams
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
                  {clubTeams.length === 0 && (
                    <p className="text-gray-500 text-xs">Aucune équipe de club trouvée.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">{modalMode === 'add' ? 'Add Team' : 'Edit Team'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Name<span className="text-red-500">*</span></label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={t('admin.teams.namePlaceholder')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Name</label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={t('admin.teams.shortNamePlaceholder')}
                    value={shortName}
                    onChange={e => setShortName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={t('admin.teams.logoPlaceholder')}
                    value={logo}
                    onChange={e => setLogo(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    value={category}
                    onChange={e => setCategory(e.target.value as 'NATIONAL' | 'CLUB')}
                    disabled={loading}
                  >
                    <option value="NATIONAL">NATIONAL</option>
                    <option value="CLUB">CLUB</option>
                  </select>
                </div>
                {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition disabled:opacity-50"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative animate-fade-in">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Delete Team</h2>
              <p className="mb-4 text-gray-700">Are you sure you want to delete this team? This action cannot be undone.</p>
              <div className="flex justify-end space-x-2">
                  <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                  disabled={deleteLoading}
                  >
                  Cancel
                  </button>
                  <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md shadow hover:bg-red-700 transition disabled:opacity-50"
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