import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../../hooks/useTranslation';
import Link from 'next/link';

interface Competition {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  logo?: string;
  games: Game[];
}

interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  logo?: string;
}

export default function CompetitionDetail() {
  const router = useRouter();
  const { competitionId } = router.query;
  const { status } = useSession();
  const { t } = useTranslation('common');
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newGame, setNewGame] = useState({
    homeTeamId: '',
    awayTeamId: '',
    date: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [editGame, setEditGame] = useState<Game | null>(null);
  const [showEditGameModal, setShowEditGameModal] = useState(false);
  
  // Competition editing state
  const [showEditCompetitionModal, setShowEditCompetitionModal] = useState(false);
  const [editCompetitionData, setEditCompetitionData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    logo: '',
    status: '',
  });
  const [competitionError, setCompetitionError] = useState<string | null>(null);

  // Game deletion state
  const [showDeleteGameModal, setShowDeleteGameModal] = useState(false);
  const [gameToDeleteId, setGameToDeleteId] = useState<string | null>(null);
  const [deleteGameConfirmationText, setDeleteGameConfirmationText] = useState('');
  const [showDuplicateGameModal, setShowDuplicateGameModal] = useState(false);
  const [gameToDuplicate, setGameToDuplicate] = useState<Game | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [deletingGame, setDeletingGame] = useState(false);

  // Participants management state
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [showRemoveParticipantModal, setShowRemoveParticipantModal] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState<{ userId: string; userName: string } | null>(null);
  const [removingParticipant, setRemovingParticipant] = useState(false);

  // Pagination state for games
  const [currentPage, setCurrentPage] = useState(1);
  const gamesPerPage = 50;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sorting state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('asc'); // Default to ascending (oldest first)

  const fetchCompetitionDetails = useCallback(async () => {
    if (!competitionId || status !== 'authenticated') return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/competitions/${competitionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError(t('admin.competitions.notFound'));
        } else {
          throw new Error('Failed to fetch competition details');
        }
      } else {
        const data = await response.json();
        setCompetition(data);
      }
    } catch (err) {
      console.error('Error fetching competition details:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [competitionId, status, t]);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/teams');
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      const data = await response.json();
      setTeams(data);
      console.log('Fetched teams:', data);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  }, []);

  // useEffect(() => {
  //   if (status !== 'loading' && (!session || session.user.role.toLowerCase() !== 'admin')) {
  //     router.push('/');
  //   }
  // }, [session, status, router]);

  const fetchParticipants = useCallback(async () => {
    if (!competitionId || status !== 'authenticated') return;

    setLoadingParticipants(true);
    try {
      const response = await fetch(`/api/admin/competitions/${competitionId}/participants`);
      if (!response.ok) {
        throw new Error('Failed to fetch participants');
      }
      const data = await response.json();
      setParticipants(data.participants || []);
    } catch (err) {
      console.error('Error fetching participants:', err);
    } finally {
      setLoadingParticipants(false);
    }
  }, [competitionId, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCompetitionDetails();
      fetchTeams();
      fetchParticipants();
    }
  }, [status, fetchCompetitionDetails, fetchTeams, fetchParticipants]);

  const handleCreateGame = async () => {
    setFormError(null);
    
    if (!newGame.homeTeamId || !newGame.awayTeamId || !newGame.date) {
      setFormError(t('admin.games.error.missingFields'));
      return;
    }

    if (newGame.homeTeamId === newGame.awayTeamId) {
      setFormError(t('admin.games.error.sameTeams'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitionId,
          team1: newGame.homeTeamId,
          team2: newGame.awayTeamId,
          date: newGame.date,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create game');
      }

      // Reset form and close modal
      setNewGame({ homeTeamId: '', awayTeamId: '', date: '' });
      setShowNewGameModal(false);
      // Refresh competition details to show new game
      fetchCompetitionDetails();
    } catch (error) {
      console.error('Error creating game:', error);
      setFormError(error instanceof Error ? error.message : t('admin.games.error.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Log when the modal state changes
  useEffect(() => {
    console.log('showNewGameModal state changed:', showNewGameModal);
    if (showNewGameModal) {
      console.log('Teams available when modal opened:', teams);
    }
  }, [showNewGameModal, teams]);

  const handleEditGame = (game: Game) => {
    setEditGame(game);
    setShowEditGameModal(true);
    setFormError(null);
  };

  const openDuplicateGameModal = (game: Game) => {
    setGameToDuplicate(game);
    setShowDuplicateGameModal(true);
  };

  const closeDuplicateGameModal = () => {
    setShowDuplicateGameModal(false);
    setGameToDuplicate(null);
  };

  const handleDuplicateGame = async () => {
    if (!gameToDuplicate) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/admin/games/${gameToDuplicate.id}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to duplicate game');
      }
      closeDuplicateGameModal();
      fetchCompetitionDetails();
    } catch (e) {
      console.error('Duplicate game error', e);
      setFormError(e instanceof Error ? e.message : 'Failed to duplicate game');
    } finally {
      setDuplicating(false);
    }
  };

  const handleUpdateGame = async () => {
    if (!editGame) return;
    setFormError(null);
    if (!editGame.homeTeam?.id || !editGame.awayTeam?.id || !editGame.date) {
      setFormError('Please fill in all fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/games/${editGame.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeamId: editGame.homeTeam.id,
          awayTeamId: editGame.awayTeam.id,
          date: editGame.date,
          homeScore: editGame.homeScore,
          awayScore: editGame.awayScore,
          status: editGame.status,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update game');
      }
      setShowEditGameModal(false);
      setEditGame(null);
      fetchCompetitionDetails();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update game');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteGameModal = (gameId: string) => {
    setGameToDeleteId(gameId);
    setShowDeleteGameModal(true);
    setDeleteGameConfirmationText('');
    setDeletingGame(false);
  };

  const closeDeleteGameModal = () => {
    setGameToDeleteId(null);
    setShowDeleteGameModal(false);
    setDeleteGameConfirmationText('');
    setDeletingGame(false);
  };

  const handleDeleteGame = async () => {
    if (!gameToDeleteId || deleteGameConfirmationText.toUpperCase() !== 'DELETE') return;

    setDeletingGame(true);
    try {
      const response = await fetch(`/api/admin/games/${gameToDeleteId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete game');
      }
      fetchCompetitionDetails();
      closeDeleteGameModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to delete game');
    } finally {
      setDeletingGame(false);
    }
  };

  const handleRemoveParticipant = async () => {
    if (!participantToRemove || !competitionId) return;

    setRemovingParticipant(true);
    try {
      const response = await fetch(`/api/admin/competitions/${competitionId}/participants/${participantToRemove.userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove participant');
      }

      // Remove participant from local state
      setParticipants(prev => prev.filter(p => p.userId !== participantToRemove.userId));
      setShowRemoveParticipantModal(false);
      setParticipantToRemove(null);
    } catch (error) {
      console.error('Error removing participant:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de la suppression du participant');
    } finally {
      setRemovingParticipant(false);
    }
  };

  // Competition editing functions
  const handleEditCompetition = () => {
    if (!competition) return;
    
    setEditCompetitionData({
      name: competition.name,
      description: competition.description || '',
      startDate: competition.startDate.slice(0, 10), // Convert to YYYY-MM-DD format
      endDate: competition.endDate.slice(0, 10),
      logo: competition.logo || '',
      status: competition.status,
    });
    setShowEditCompetitionModal(true);
    setCompetitionError(null);
  };

  const handleCompetitionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditCompetitionData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompetitionError(null);
    
    if (!editCompetitionData.name || !editCompetitionData.startDate || !editCompetitionData.endDate) {
      setCompetitionError('Please fill in all required fields.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/competitions/${competitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCompetitionData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update competition');
      }

      const updatedCompetition = await response.json();
      setCompetition(updatedCompetition);
      setShowEditCompetitionModal(false);
    } catch (error) {
      setCompetitionError(error instanceof Error ? error.message : 'Failed to update competition');
    }
  };

  // Filter and search logic
  const filteredGames = competition?.games.filter(game => {
    const matchesSearch = searchQuery === '' || 
      game.homeTeam?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.awayTeam?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || game.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // Handle date column sorting
  const handleDateSort = () => {
    // Clear filters when sorting by date to show full range
    setSearchQuery('');
    setStatusFilter('ALL');
    
    if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else if (sortOrder === 'desc') {
      setSortOrder(null);
    } else {
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Apply sorting to filtered games
  const sortedGames = [...filteredGames].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    
    if (sortOrder === 'asc') {
      return dateA - dateB; // Oldest first
    } else if (sortOrder === 'desc') {
      return dateB - dateA; // Newest first
    } else {
      // No specific sorting, maintain original order or some default
      return dateA - dateB; // Default to ascending
    }
  });

  // Debug: Log date range when sorting changes
  useEffect(() => {
    if (sortedGames.length > 0) {
      const dates = sortedGames.map(game => new Date(game.date));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      console.log(`Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]} (${sortedGames.length} games)`);
    }
  }, [sortedGames.length, sortOrder]);

  // Update pagination to use sorted games
  const paginatedGames = sortedGames.slice((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage);

  // Calculate total pages
  const totalPages = Math.ceil(sortedGames.length / gamesPerPage);

  // Format date helper
  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    };
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
          <h2 className="text-lg font-semibold text-red-600 mb-3">Error</h2>
          <p className="text-gray-700">{error}</p>
          {error === t('admin.competitions.notFound') && (
            <div className="mt-4">
              <Link href="/admin/competitions">
                <span className="text-blue-600 hover:underline cursor-pointer">{t('admin.competitions.viewAll')}</span>
              </Link>
            </div>
          )}
          {error !== t('admin.competitions.notFound') && (
             <button
              onClick={() => fetchCompetitionDetails()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('Retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!competition) {
    return null; // Should not happen if no error and not loading
  }

  return (
    <>
      <div className="max-w-6xl mx-auto py-4 px-3 sm:px-4">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-4">
            {competition.logo && (
              <img 
                src={competition.logo} 
                alt={`${competition.name} logo`}
                className="h-12 w-12 object-contain"
              />
            )}
                    <div>
              <h2 className="text-2xl font-bold text-gray-100 md:text-gray-900" style={{color: 'var(--competition-title-color, #fff)'}}>{competition.name}</h2>
              {competition.description && (
                <p className="text-gray-600 mt-1">{competition.description}</p>
              )}
                    </div>
                  </div>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-2"
            onClick={handleEditCompetition}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Competition</span>
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="font-medium text-gray-700">Start Date:</span>
              <p className="text-gray-900">{new Date(competition.startDate).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">End Date:</span>
              <p className="text-gray-900">{new Date(competition.endDate).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <span className={`inline-block px-2 py-1 text-xs rounded-full ml-2 ${
                competition.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                competition.status === 'UPCOMING' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {competition.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Participants Management Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Participants</h3>
          <p className="text-sm text-gray-500">
            {loadingParticipants ? 'Chargement...' : `${participants.length} participant${participants.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {loadingParticipants ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Chargement des participants...</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun participant</h3>
            <p className="text-gray-500">Aucun utilisateur n'a encore rejoint cette compétition.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paris
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rejoint le
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participants.map((participant, index) => (
                  <tr key={participant.userId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {participant.user.profilePictureUrl ? (
                          <img
                            className="h-10 w-10 rounded-full mr-3"
                            src={participant.user.profilePictureUrl}
                            alt={participant.user.name}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {participant.user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {participant.user.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{participant.user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{participant.betCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{participant.totalPoints}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(participant.joinedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setParticipantToRemove({
                            userId: participant.userId,
                            userName: participant.user.name
                          });
                          setShowRemoveParticipantModal(true);
                        }}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <button
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => setShowNewGameModal(true)}
      >
        Add Game
      </button>
      
      {/* Games Management Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {competition.games.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No games yet</h3>
            <p className="text-gray-500">Start by adding your first game to this competition.</p>
          </div>
        ) : (
          <>
            {/* Header with filters and search */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Games Management</h3>
                  <p className="text-sm text-gray-500">
                    {filteredGames.length} of {competition.games.length} games
                    {sortOrder && (
                      <span className="ml-2 text-blue-600">
                        (sorted by date {sortOrder === 'asc' ? '↑' : '↓'})
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search teams..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                  >
                    <option value="ALL">Tous les Statuts</option>
                    <option value="UPCOMING">À Venir</option>
                    <option value="LIVE">En Direct</option>
                    <option value="FINISHED">Terminé</option>
                    <option value="CANCELLED">Annulé</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Games Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button 
                        onClick={handleDateSort}
                        className="flex items-center space-x-1 hover:text-gray-700 transition-colors focus:outline-none"
                      >
                        <span>Date & Time</span>
                        <div className="flex flex-col">
                          <svg 
                            className={`h-3 w-3 ${sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-300'}`} 
                            fill="currentColor" 
                            viewBox="0 0 12 12"
                          >
                            <path d="M6 0L0 6h12L6 0z"/>
                          </svg>
                          <svg 
                            className={`h-3 w-3 ${sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-300'}`} 
                            fill="currentColor" 
                            viewBox="0 0 12 12"
                          >
                            <path d="M6 12L0 6h12L6 12z"/>
                          </svg>
                        </div>
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedGames.map((game, index) => {
                    const { date, time } = formatGameDate(game.date);
                    return (
                      <tr key={game.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">{date}</div>
                          <div className="text-sm text-gray-500">{time}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-between max-w-sm">
                            {/* Home Team */}
                            <div className="flex items-center flex-1">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {game.homeTeam?.name}
                              </span>
                              {game.homeTeam?.logo && (
                                <img 
                                  src={game.homeTeam.logo} 
                                  alt={`${game.homeTeam.name} logo`} 
                                  className="h-6 w-6 rounded-full object-cover ml-2" 
                                />
                              )}
                            </div>
                            
                            {/* Score */}
                            <div className="flex items-center px-3">
                              <span className="text-lg font-bold text-gray-700">
                                {typeof game.homeScore === 'number' ? game.homeScore : '-'}
                              </span>
                              <span className="mx-2 text-gray-400">:</span>
                              <span className="text-lg font-bold text-gray-700">
                                {typeof game.awayScore === 'number' ? game.awayScore : '-'}
                              </span>
                            </div>
                            
                            {/* Away Team */}
                            <div className="flex items-center flex-1 justify-end">
                              <span className="text-sm font-medium text-gray-900 truncate mr-2">
                                {game.awayTeam?.name}
                              </span>
                              {game.awayTeam?.logo && (
                                <img 
                                  src={game.awayTeam.logo} 
                                  alt={`${game.awayTeam.name} logo`} 
                                  className="h-6 w-6 rounded-full object-cover" 
                                />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            game.status === 'FINISHED' ? 'bg-green-100 text-green-800' :
                            game.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                            game.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {game.status === 'UPCOMING' ? 'À Venir' :
                             game.status === 'LIVE' ? 'En Direct' :
                             game.status === 'FINISHED' ? 'Terminé' :
                             game.status === 'CANCELLED' ? 'Annulé' :
                             game.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                          <div className="flex space-x-2">
                            <button
                              className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                              onClick={() => handleEditGame(game)}
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              className="inline-flex items-center px-3 py-1 bg-accent-100 text-accent-800 rounded-md hover:bg-accent-200 transition-colors"
                              onClick={() => router.push(`/admin/games/${game.id}/bets`)}
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Overwrite Bets
                            </button>
                            <button
                              className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
                              onClick={() => openDeleteGameModal(game.id)}
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          <button
                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                            onClick={() => openDuplicateGameModal(game)}
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h8M4 7h.01M4 11h.01M4 15h.01" />
                            </svg>
                            Duplicate
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{Math.min((currentPage - 1) * gamesPerPage + 1, filteredGames.length)}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * gamesPerPage, filteredGames.length)}</span> of{' '}
                    <span className="font-medium">{filteredGames.length}</span> games
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            } border`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
        {showNewGameModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Game</h2>
            {formError && <div className="text-red-500 mb-2">{formError}</div>}
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">Home Team</label>
                            <select
                className="w-full border rounded px-2 py-1 text-gray-800"
                              value={newGame.homeTeamId}
                onChange={e => setNewGame({ ...newGame, homeTeamId: e.target.value })}
                            >
                <option value="">Select team</option>
                              {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                              ))}
                            </select>
                          </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">Away Team</label>
                            <select
                className="w-full border rounded px-2 py-1 text-gray-800"
                              value={newGame.awayTeamId}
                onChange={e => setNewGame({ ...newGame, awayTeamId: e.target.value })}
                            >
                <option value="">Select team</option>
                              {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                              ))}
                            </select>
                          </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">Date & Time</label>
                            <input
                              type="datetime-local"
                className="w-full border rounded px-2 py-1 text-gray-800"
                              value={newGame.date}
                onChange={e => setNewGame({ ...newGame, date: e.target.value })}
                            />
                          </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => setShowNewGameModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleCreateGame}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('creating') : t('create')}
              </button>
                        </div>
                      </div>
                    </div>
      )}
      {showNewTeamModal && (
        <div style={{ position: 'fixed', top: 100, left: 100, background: 'white', zIndex: 9999, padding: 20 }}>
          Modal Open
          <button onClick={() => setShowNewTeamModal(false)}>{t('cancel')}</button>
        </div>
      )}
      {showEditGameModal && editGame && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">{t('admin.games.edit')}</h2>
            {formError && <div className="text-red-500 mb-2">{formError}</div>}
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">{t('admin.games.homeTeam')}</label>
              <select
                className="w-full border rounded px-2 py-1 text-gray-800"
                value={editGame.homeTeam?.id || ''}
                onChange={e => setEditGame({ ...editGame, homeTeam: { ...editGame.homeTeam, id: e.target.value } })}
              >
                <option value="">{t('admin.games.selectTeam')}</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">{t('admin.games.awayTeam')}</label>
              <select
                className="w-full border rounded px-2 py-1 text-gray-800"
                value={editGame.awayTeam?.id || ''}
                onChange={e => setEditGame({ ...editGame, awayTeam: { ...editGame.awayTeam, id: e.target.value } })}
              >
                <option value="">{t('admin.games.selectTeam')}</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">{t('admin.games.dateTime')}</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-2 py-1 text-gray-800"
                value={editGame.date.slice(0, 16)}
                onChange={e => setEditGame({ ...editGame, date: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-700 font-medium">Status du Match</label>
              <select
                className="w-full border rounded px-2 py-1 text-gray-800"
                value={editGame.status || 'UPCOMING'}
                onChange={e => setEditGame({ ...editGame, status: e.target.value as any })}
              >
                <option value="UPCOMING">À Venir</option>
                <option value="LIVE">En Direct</option>
                <option value="FINISHED">Terminé</option>
                <option value="CANCELLED">Annulé</option>
              </select>
            </div>
            <div className="mb-4 flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 text-gray-700 font-medium">{t('admin.games.homeScore')}</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1 text-gray-800"
                  value={editGame.homeScore ?? ''}
                  onChange={e => setEditGame({ ...editGame, homeScore: e.target.value === '' ? null : Number(e.target.value) })}
                  min="0"
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-gray-700 font-medium">{t('admin.games.awayScore')}</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1 text-gray-800"
                  value={editGame.awayScore ?? ''}
                  onChange={e => setEditGame({ ...editGame, awayScore: e.target.value === '' ? null : Number(e.target.value) })}
                  min="0"
                />
                  </div>
                </div>
            <div className="flex justify-end gap-2">
                  <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => setShowEditGameModal(false)}
                  >
                {t('cancel')}
                  </button>
                  <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleUpdateGame}
                    disabled={isSubmitting}
                  >
                {isSubmitting ? t('saving') : t('save')}
                  </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Edit Competition Modal */}
        {showEditCompetitionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">{t('admin.editCompetition')}</h3>
              
              {competitionError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {competitionError}
                </div>
              )}
              
              <form onSubmit={handleUpdateCompetition}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.competitionName')} *</label>
                    <input
                      type="text"
                      name="name"
                      value={editCompetitionData.name}
                      onChange={handleCompetitionInputChange}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.description')}</label>
                    <textarea
                      name="description"
                      value={editCompetitionData.description}
                      onChange={handleCompetitionInputChange}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.startDate')} *</label>
                      <input
                        type="date"
                        name="startDate"
                        value={editCompetitionData.startDate}
                        onChange={handleCompetitionInputChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.endDate')} *</label>
                      <input
                        type="date"
                        name="endDate"
                        value={editCompetitionData.endDate}
                        onChange={handleCompetitionInputChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.logoUrl')}</label>
                    <input
                      type="url"
                      name="logo"
                      value={editCompetitionData.logo}
                      onChange={handleCompetitionInputChange}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.status')} *</label>
                    <select
                      name="status"
                      value={editCompetitionData.status}
                      onChange={handleCompetitionInputChange}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                      required
                    >
                      <option value="ACTIVE">{t('admin.active')}</option>
                      <option value="COMPLETED">{t('admin.finished')}</option>
                      <option value="CANCELLED">{t('admin.cancelled')}</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('admin.statusHelp')}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditCompetitionModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? t('saving') : t('save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showDeleteGameModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Confirm Game Deletion</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">Are you sure you want to delete this game? Type &apos;DELETE&apos; to confirm.</p>
                <input
                  type="text"
                  className="mt-2 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  placeholder={t('typeDeleteUpper')}
                  value={deleteGameConfirmationText}
                  onChange={(e) => setDeleteGameConfirmationText(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeDeleteGameModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 mr-2"
                  disabled={deletingGame}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGame}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ${
                    deleteGameConfirmationText.toUpperCase() !== 'DELETE' || deletingGame ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={deleteGameConfirmationText.toUpperCase() !== 'DELETE' || deletingGame}
                >
                  {deletingGame ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

  {showDuplicateGameModal && gameToDuplicate && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Duplicate game</h3>
        <p className="text-sm text-gray-600 mb-4">{gameToDuplicate.homeTeam?.name} vs {gameToDuplicate.awayTeam?.name}</p>
        <p className="text-sm text-gray-700 mb-4">The duplicate will use the same date and time.</p>
        <div className="flex justify-end gap-3">
          <button onClick={closeDuplicateGameModal} className="px-4 py-2 rounded-lg border">Cancel</button>
          <button onClick={handleDuplicateGame} disabled={duplicating} className="px-4 py-2 rounded-lg bg-primary-600 text-white">
            {duplicating ? 'Duplicating...' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  )}
      </div>

      {/* Remove Participant Modal */}
      {showRemoveParticipantModal && participantToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Retirer un participant</h3>
            <p className="text-gray-700 mb-4">
              Êtes-vous sûr de vouloir retirer <strong>{participantToRemove.userName}</strong> de cette compétition ?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Cette action retirera l'utilisateur de la compétition. Ses paris existants seront conservés mais il ne pourra plus voir cette compétition dans son dashboard.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowRemoveParticipantModal(false);
                  setParticipantToRemove(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                disabled={removingParticipant}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRemoveParticipant}
                className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ${
                  removingParticipant ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={removingParticipant}
              >
                {removingParticipant ? 'Suppression...' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 