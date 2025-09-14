import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../../../hooks/useTranslation';

interface Game {
  id: string;
  homeTeam: {
    id: string;
    name: string;
    logo?: string;
  };
  awayTeam: {
    id: string;
    name: string;
    logo?: string;
  };
  date: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: {
    id: string;
    name: string;
  };
}

interface Bet {
  id: string;
  score1: number;
  score2: number;
  points: number | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function GameBetsManagement() {
  const router = useRouter();
  const { gameId } = router.query;
  const { data: session, status } = useSession();
  const { t } = useTranslation('common');
  const [game, setGame] = useState<Game | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit bet modal state
  const [showEditBetModal, setShowEditBetModal] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [editBetData, setEditBetData] = useState({ score1: 0, score2: 0 });
  const [isUpdatingBet, setIsUpdatingBet] = useState(false);

  // Delete bet modal state
  const [showDeleteBetModal, setShowDeleteBetModal] = useState(false);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingBet, setIsDeletingBet] = useState(false);

  // Add bet modal state
  const [showAddBetModal, setShowAddBetModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newBetData, setNewBetData] = useState({ score1: 0, score2: 0 });
  const [isCreatingBet, setIsCreatingBet] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && typeof session?.user === 'object' && session?.user && 'role' in session.user && typeof (session.user as { role: string }).role === 'string' && (session.user as { role: string }).role.toLowerCase() !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, router, session]);

  const fetchGameAndBets = useCallback(async () => {
    if (!gameId || status !== 'authenticated') return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/games/${gameId}/bets`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Game not found');
        } else {
          throw new Error('Failed to fetch game and bets');
        }
      } else {
        const data = await response.json();
        setGame(data.game);
        setBets(data.bets);
        setAvailableUsers(data.availableUsers || []);
      }
    } catch (err) {
      console.error('Error fetching game and bets:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [gameId, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchGameAndBets();
    }
  }, [status, fetchGameAndBets]);

  const handleEditBet = (bet: Bet) => {
    setEditingBet(bet);
    setEditBetData({ score1: bet.score1, score2: bet.score2 });
    setShowEditBetModal(true);
  };

  const handleUpdateBet = async () => {
    if (!editingBet) return;
    
    setIsUpdatingBet(true);
    try {
      const response = await fetch(`/api/admin/bets/${editingBet.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editBetData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update bet');
      }

      // Refresh bets
      fetchGameAndBets();
      setShowEditBetModal(false);
      setEditingBet(null);
    } catch (err) {
      console.error('Error updating bet:', err);
      alert(err instanceof Error ? err.message : 'Failed to update bet');
    } finally {
      setIsUpdatingBet(false);
    }
  };

  const handleDeleteBet = async () => {
    if (!deletingBetId || deleteConfirmationText.toLowerCase() !== 'delete') return;

    setIsDeletingBet(true);
    try {
      const response = await fetch(`/api/admin/bets/${deletingBetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete bet');
      }

      // Refresh bets
      fetchGameAndBets();
      setShowDeleteBetModal(false);
      setDeletingBetId(null);
      setDeleteConfirmationText('');
    } catch (err) {
      console.error('Error deleting bet:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete bet');
    } finally {
      setIsDeletingBet(false);
    }
  };

  const openDeleteBetModal = (betId: string) => {
    setDeletingBetId(betId);
    setShowDeleteBetModal(true);
    setDeleteConfirmationText('');
  };

  const closeDeleteBetModal = () => {
    setShowDeleteBetModal(false);
    setDeletingBetId(null);
    setDeleteConfirmationText('');
  };

  const handleCreateBet = async () => {
    if (!selectedUserId || !gameId) return;
    
    setIsCreatingBet(true);
    try {
      const response = await fetch('/api/admin/bets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: gameId,
          userId: selectedUserId,
          score1: newBetData.score1,
          score2: newBetData.score2,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create bet');
      }

      // Refresh bets
      fetchGameAndBets();
      setShowAddBetModal(false);
      setSelectedUserId('');
      setNewBetData({ score1: 0, score2: 0 });
    } catch (err) {
      console.error('Error creating bet:', err);
      alert(err instanceof Error ? err.message : 'Failed to create bet');
    } finally {
      setIsCreatingBet(false);
    }
  };

  const openAddBetModal = () => {
    setShowAddBetModal(true);
    setSelectedUserId('');
    setNewBetData({ score1: 0, score2: 0 });
  };

  const closeAddBetModal = () => {
    setShowAddBetModal(false);
    setSelectedUserId('');
    setNewBetData({ score1: 0, score2: 0 });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading game bets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Game not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.back()}
              className="mr-4 text-blue-600 hover:text-blue-800"
            >
              ← Back to Competition
            </button>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Manage Bets</h1>
          
          {/* Game Info */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {game.homeTeam.logo && (
                  <img src={game.homeTeam.logo} alt={game.homeTeam.name} className="w-8 h-8 object-contain" />
                )}
                <span className="font-medium">{game.homeTeam.name}</span>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold">
                  {typeof game.homeScore === 'number' ? game.homeScore : '-'} : {typeof game.awayScore === 'number' ? game.awayScore : '-'}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(game.date).toLocaleDateString('fr-FR')} à {new Date(game.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-sm text-gray-500">{game.competition.name}</div>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="font-medium">{game.awayTeam.name}</span>
                {game.awayTeam.logo && (
                  <img src={game.awayTeam.logo} alt={game.awayTeam.name} className="w-8 h-8 object-contain" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">User Bets ({bets.length})</h2>
            {availableUsers.length > 0 ? (
              <button
                onClick={openAddBetModal}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Bet
              </button>
            ) : (
              <div className="text-sm text-gray-500">
                No users available to add bets
              </div>
            )}
          </div>
          
          {bets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No bets placed for this game yet.
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prediction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placed At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bets.map((bet) => (
                    <tr key={bet.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{bet.user.name}</div>
                        <div className="text-sm text-gray-500">{bet.user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-gray-900">
                          {bet.score1} : {bet.score2}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          bet.points === 3 ? 'bg-green-100 text-green-800' :
                          bet.points === 1 ? 'bg-blue-100 text-blue-800' :
                          bet.points === 0 ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {bet.points !== null ? `${bet.points} pts` : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(bet.createdAt).toLocaleDateString('fr-FR')} à {new Date(bet.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                            onClick={() => handleEditBet(bet)}
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
                            onClick={() => openDeleteBetModal(bet.id)}
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Bet Modal */}
        {showEditBetModal && editingBet && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                Edit Bet for {editingBet.user.name}
              </h3>
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {game.homeTeam.name} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editBetData.score1}
                      onChange={(e) => setEditBetData({ ...editBetData, score1: parseInt(e.target.value) || 0 })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {game.awayTeam.name} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editBetData.score2}
                      onChange={(e) => setEditBetData({ ...editBetData, score2: parseInt(e.target.value) || 0 })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEditBetModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  disabled={isUpdatingBet}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateBet}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={isUpdatingBet}
                >
                  {isUpdatingBet ? 'Updating...' : 'Update Bet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Bet Modal */}
        {showDeleteBetModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Delete Bet</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 mb-4">
                  Are you sure you want to delete this bet? Type &apos;DELETE&apos; to confirm.
                </p>
                <input
                  type="text"
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  placeholder={t('typeDelete')}
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                />
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeDeleteBetModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  disabled={isDeletingBet}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBet}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 ${
                    deleteConfirmationText.toLowerCase() !== 'delete' || isDeletingBet ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={deleteConfirmationText.toLowerCase() !== 'delete' || isDeletingBet}
                >
                  {isDeletingBet ? 'Deleting...' : 'Delete Bet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Bet Modal */}
        {showAddBetModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                Add New Bet
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select User
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                  >
                    <option value="">Choose a user...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {game?.homeTeam.name} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newBetData.score1}
                      onChange={(e) => setNewBetData({ ...newBetData, score1: parseInt(e.target.value) || 0 })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {game?.awayTeam.name} Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newBetData.score2}
                      onChange={(e) => setNewBetData({ ...newBetData, score2: parseInt(e.target.value) || 0 })}
                      className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeAddBetModal}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  disabled={isCreatingBet}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateBet}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  disabled={!selectedUserId || isCreatingBet}
                >
                  {isCreatingBet ? 'Creating...' : 'Create Bet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 