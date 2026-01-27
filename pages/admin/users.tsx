import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  profilePictureUrl?: string;
  isActive?: boolean;
}

const DEFAULT_AVATAR = 'https://via.placeholder.com/40x40?text=User';

export default function AdminUsers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profilePictureMethod, setProfilePictureMethod] = useState<'url' | 'upload'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>('');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | 'createdAt' | 'status'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Function to upload file and get URL
  const uploadFile = async (file: File): Promise<string> => {
    // Check file size (limit to 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 2MB');
    }

    // For now, we'll convert to base64 data URL
    // In production, you'd upload to a service like AWS S3, Cloudinary, etc.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Additional check for base64 size
        if (result.length > 500000) { // ~500KB base64 limit
          reject(new Error('Processed image is too large. Please use a smaller image or URL instead.'));
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch users:', errorData);
        const errorMessage = errorData.error || `Failed to fetch users (${res.status})`;
        setError(errorMessage);
        return; // Don't throw, just set error and return
      }
      const data = await res.json();
      console.log('Fetched users:', data);
      setUsers(data);
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch users. Please check your connection and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      const userRole = (session?.user as { role?: string })?.role?.toLowerCase();
      if (userRole !== 'admin') {
        router.push('/dashboard');
      } else {
        fetchUsers();
      }
    }
  }, [status, session, router]);

  const openAddModal = () => {
    setModalMode('add');
    setEditUserId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setProfilePictureUrl('');
    setProfilePictureMethod('url');
    setSelectedFile(null);
    setPreviewUrl('');
    setFormError('');
    setSuccessMessage('');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('edit');
    setEditUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setProfilePictureUrl(user.profilePictureUrl || '');
    setProfilePictureMethod('url');
    setSelectedFile(null);
    setPreviewUrl('');
    setFormError('');
    setSuccessMessage('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    setSuccessMessage('');
    if (!name || !email || (modalMode === 'add' && !password)) {
      setFormError('Name, email, and password are required');
      return;
    }
    setFormLoading(true);
    
    try {
      let finalProfilePictureUrl = profilePictureUrl;
      
      // Handle file upload if upload method is selected
      if (profilePictureMethod === 'upload' && selectedFile) {
        try {
          finalProfilePictureUrl = await uploadFile(selectedFile);
        } catch {
          // error handling removed as error variable is unused
        }
      }
      
      if (modalMode === 'add') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role, profilePictureUrl: finalProfilePictureUrl }),
        });
        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error || 'Failed to create user');
          setFormLoading(false);
          return;
        }
        setSuccessMessage('User created successfully!');
      } else if (modalMode === 'edit' && editUserId) {
        const res = await fetch(`/api/admin/users?id=${editUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, role, profilePictureUrl: finalProfilePictureUrl, password: password || undefined }),
        });
        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error || 'Failed to update user');
          setFormLoading(false);
          return;
        }
        const responseData = await res.json();
        setSuccessMessage(responseData.message || 'User updated successfully!');
      }
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        setShowModal(false);
        setFormLoading(false);
        setName('');
        setEmail('');
        setPassword('');
        setRole('user');
        setProfilePictureUrl('');
        setProfilePictureMethod('url');
        setSelectedFile(null);
        setPreviewUrl('');
        setEditUserId(null);
        setSuccessMessage('');
        fetchUsers();
      }, 1500);
    } catch {
      // error handling removed as error variable is unused
    }
  };

  const openDeleteModal = (userId: string) => {
    const user = users.find(u => u.id === userId);
    setDeleteUserId(userId);
    setDeleteUserName(user?.name || 'Unknown User');
    setDeleteConfirmation(''); // Reset confirmation when opening modal
    setFormError(''); // Clear any previous errors
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    
    // Verify confirmation text
    const expectedConfirmation = `delete ${deleteUserName}`.toLowerCase();
    if (deleteConfirmation.toLowerCase() !== expectedConfirmation) {
      setFormError(`Please type "delete ${deleteUserName}" to confirm deletion.`);
      return;
    }
    
    setDeleteLoading(true);
    setFormError('');
    try {
      const res = await fetch(`/api/admin/users?id=${deleteUserId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setFormError(errorData.error || 'Failed to delete user');
        setDeleteLoading(false);
      } else {
        console.log('User deleted successfully');
        setShowDeleteConfirm(false);
        setDeleteUserId(null);
        setDeleteUserName('');
        setDeleteConfirmation('');
        setFormError('');
        fetchUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setFormError('An error occurred while deleting the user.');
      setDeleteLoading(false);
    }
  };

  const handleToggleActivation = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || 'Failed to update user status');
        setTimeout(() => setFormError(''), 5000);
      } else {
        setSuccessMessage(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
        setTimeout(() => setSuccessMessage(''), 3000);
        fetchUsers();
      }
    } catch (error) {
      setFormError('An error occurred. Please try again.');
      setTimeout(() => setFormError(''), 5000);
    }
  };

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter(user => {
      // Search filter
      const matchesSearch = !searchQuery || 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive);
      
      // Role filter
      const matchesRole = roleFilter === 'all' ||
        user.role.toLowerCase() === roleFilter;
      
      return matchesSearch && matchesStatus && matchesRole;
    });

    // Sort users
    filtered.sort((a, b) => {
      let aValue: string | number | boolean;
      let bValue: string | number | boolean;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'role':
          aValue = a.role.toLowerCase();
          bValue = b.role.toLowerCase();
          break;
        case 'status':
          aValue = a.isActive ? 1 : 0;
          bValue = b.isActive ? 1 : 0;
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, searchQuery, statusFilter, roleFilter, sortField, sortDirection]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.isActive).length;
    const inactive = users.filter(u => !u.isActive).length;
    const admins = users.filter(u => u.role.toLowerCase() === 'admin').length;
    return { total, active, inactive, admins };
  }, [users]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)]">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des utilisateurs</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Gérez les comptes utilisateurs et leurs permissions</p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg shadow-sm hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition-all text-sm font-medium"
            >
              <UserPlusIcon className="w-5 h-5" />
              Nouvel utilisateur
            </button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm p-4 border-l-4 border-blue-500 dark:border-blue-400">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm p-4 border-l-4 border-green-500 dark:border-green-400">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Actifs</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.active}</div>
            </div>
            <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm p-4 border-l-4 border-yellow-500 dark:border-yellow-400">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">En attente</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.inactive}</div>
            </div>
            <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm p-4 border-l-4 border-purple-500 dark:border-purple-400">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Admins</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.admins}</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-2">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    statusFilter === 'all'
                      ? 'bg-primary-600 dark:bg-accent-dark-600 text-white'
                      : 'bg-gray-100 dark:bg-[rgb(40,40,40)] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[rgb(45,45,45)]'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    statusFilter === 'active'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Actifs
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    statusFilter === 'inactive'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  En attente
                </button>
              </div>

              {/* Role Filter */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    roleFilter === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    roleFilter === 'admin'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Admins
                </button>
                <button
                  onClick={() => setRoleFilter('user')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    roleFilter === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Users
                </button>
              </div>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
            <span className="ml-4 text-gray-600 dark:text-gray-400">Loading users...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-300 font-medium">Error: {error}</p>
            <button
              onClick={fetchUsers}
              className="mt-2 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
            {filteredAndSortedUsers.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">Aucun utilisateur trouvé</p>
                {searchQuery && (
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Essayez de modifier vos critères de recherche</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-[rgb(20,20,20)]/50">
                    <tr>
                      <th className="px-3 py-2 text-left"></th>
                      <th className="px-3 py-2 text-left">
                        <button
                          onClick={() => handleSort('name')}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Nom
                          {sortField === 'name' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            )
                          ) : (
                            <Bars3Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">
                        <button
                          onClick={() => handleSort('email')}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Email
                          {sortField === 'email' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            )
                          ) : (
                            <Bars3Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">
                        <button
                          onClick={() => handleSort('role')}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Rôle
                          {sortField === 'role' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            )
                          ) : (
                            <Bars3Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">
                        <button
                          onClick={() => handleSort('status')}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Statut
                          {sortField === 'status' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            )
                          ) : (
                            <Bars3Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left hidden md:table-cell">
                        <button
                          onClick={() => handleSort('createdAt')}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Inscription
                          {sortField === 'createdAt' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUpIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-primary-600 dark:text-accent-dark-400" />
                            )
                          ) : (
                            <Bars3Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[rgb(38,38,38)] divide-y divide-gray-200 dark:divide-gray-600">
                    {filteredAndSortedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <img
                            src={user.profilePictureUrl || DEFAULT_AVATAR}
                            alt={user.name + ' avatar'}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-[rgb(40,40,40)] shadow-sm"
                            onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{user.name}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{user.email}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${
                            user.role.toLowerCase() === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          }`}>
                            {user.role.toLowerCase() === 'admin' ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex items-center text-xs leading-4 font-semibold rounded-full ${
                            user.isActive 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          }`}>
                            {user.isActive ? (
                              <>
                                <CheckCircleIcon className="w-3 h-3 mr-0.5" />
                                Actif
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="w-3 h-3 mr-0.5" />
                                En attente
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleActivation(user.id, !user.isActive)}
                              className={`inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium transition ${
                                user.isActive 
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50' 
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                              }`}
                              title={user.isActive ? 'Désactiver' : 'Activer'}
                            >
                              {user.isActive ? (
                                <XCircleIcon className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircleIcon className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => openEditModal(user)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition text-xs font-medium"
                              title="Modifier"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(user.id)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition text-xs font-medium"
                              title="Supprimer"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredAndSortedUsers.length > 0 && (
              <div className="bg-gray-50 dark:bg-[rgb(20,20,20)]/50 px-3 py-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Affichage de <span className="font-medium">{filteredAndSortedUsers.length}</span> utilisateur{filteredAndSortedUsers.length > 1 ? 's' : ''}
                  {searchQuery || statusFilter !== 'all' || roleFilter !== 'all' ? (
                    <> sur <span className="font-medium">{users.length}</span> total</>
                  ) : null}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">{modalMode === 'add' ? 'Add User' : 'Edit User'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.name')}<span className="text-red-500">*</span></label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={t('admin.users.namePlaceholder')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={9}
                    disabled={formLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.email')}<span className="text-red-500">*</span></label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder={t('admin.users.emailPlaceholder')}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={formLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.profilePicture')}</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="profilePictureMethod"
                        value="url"
                        checked={profilePictureMethod === 'url'}
                        onChange={e => setProfilePictureMethod(e.target.value as 'url')}
                        disabled={formLoading}
                      />
                      <span className="ml-2">URL</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="profilePictureMethod"
                        value="upload"
                        checked={profilePictureMethod === 'upload'}
                        onChange={e => setProfilePictureMethod(e.target.value as 'upload')}
                        disabled={formLoading}
                      />
                      <span className="ml-2">{t('profile.uploadFile')}</span>
                    </label>
                  </div>
                </div>
                {profilePictureMethod === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.profilePictureUrl')}</label>
                    <input
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder={t('admin.users.profileUrlPlaceholder')}
                      value={profilePictureUrl}
                      onChange={e => setProfilePictureUrl(e.target.value)}
                      disabled={formLoading}
                    />
                    {profilePictureUrl && (
                      <img
                        src={profilePictureUrl}
                        alt="Profile preview"
                        className="w-16 h-16 rounded-full mt-2 border border-gray-200 object-cover"
                        onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                      />
                    )}
                  </div>
                )}
                {profilePictureMethod === 'upload' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.uploadProfilePicture')}</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                      <div className="space-y-1 text-center">
                        {!selectedFile ? (
                          <>
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                <span>{t('admin.users.uploadFile')}</span>
                                <input
                                  id="file-upload"
                                  name="file-upload"
                                  type="file"
                                  className="sr-only"
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                      const file = e.target.files[0];
                                      
                                      // Validate file size
                                      const maxSize = 2 * 1024 * 1024; // 2MB
                                      if (file.size > maxSize) {
                                        setFormError(t('admin.users.fileSizeError'));
                                        return;
                                      }
                                      
                                      setSelectedFile(file);
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setPreviewUrl(reader.result as string);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  disabled={formLoading}
                                />
                              </label>
                              <p className="pl-1">{t('admin.users.dragDrop')}</p>
                            </div>
                            <p className="text-xs text-gray-500">{t('admin.users.fileTypes')}</p>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <img
                              src={previewUrl}
                              alt="Profile preview"
                              className="mx-auto w-20 h-20 rounded-full border border-gray-200 object-cover"
                            />
                            <p className="text-sm text-gray-600">{selectedFile.name}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                setPreviewUrl('');
                              }}
                              className="text-sm text-red-600 hover:text-red-500"
                              disabled={formLoading}
                            >
                              {t('admin.users.remove')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {modalMode === 'add' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.password')}<span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder={t('admin.users.passwordPlaceholder')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={formLoading}
                    />
                  </div>
                )}
                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.newPassword')}</label>
                    <input
                      type="password"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder={t('admin.users.newPasswordPlaceholder')}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={formLoading}
                    />
                    <span className="text-xs text-gray-500">{t('admin.users.passwordHelp')}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.role')}</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    disabled={formLoading}
                  >
                    <option value="user">{t('admin.users.user')}</option>
                    <option value="admin">{t('admin.users.admin')}</option>
                  </select>
                </div>
                {formError && <div className="text-red-600 dark:text-red-400 text-sm mt-2">{formError}</div>}
                {successMessage && <div className="text-green-600 dark:text-green-400 text-sm mt-2">{successMessage}</div>}
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={formLoading}
                >
                  {formLoading ? (modalMode === 'add' ? 'Creating...' : 'Saving...') : (modalMode === 'add' ? 'Create' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in border-2 border-red-200">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h2 className="text-lg font-semibold text-red-900">⚠️ Delete User</h2>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-900 font-medium mb-2">
                  You are about to permanently delete:
                </p>
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-red-800 font-semibold">{deleteUserName}</p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                  <p className="text-yellow-800 text-sm font-medium mb-2">⚠️ This will permanently delete:</p>
                  <ul className="text-yellow-700 text-sm space-y-1 ml-4">
                    <li>• User account and profile</li>
                    <li>• All user statistics</li>
                    <li>• All betting predictions</li>
                    <li>• Competition memberships</li>
                  </ul>
                </div>
                
                <p className="text-red-600 font-semibold text-sm mb-4">
                  ⚠️ This action cannot be undone!
                </p>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To confirm, type <span className="font-mono font-bold text-red-600">delete {deleteUserName}</span>:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={`delete ${deleteUserName}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    disabled={deleteLoading}
                    autoFocus
                  />
                  {deleteConfirmation && deleteConfirmation.toLowerCase() !== `delete ${deleteUserName}`.toLowerCase() && (
                    <p className="mt-2 text-sm text-red-600">
                      Confirmation text does not match. Please type exactly: <span className="font-mono font-bold">delete {deleteUserName}</span>
                    </p>
                  )}
                </div>
              </div>
              
              {formError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-red-800 text-sm">{formError}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteUserId(null);
                    setDeleteUserName('');
                    setDeleteConfirmation('');
                    setFormError('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition font-medium"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md shadow hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  disabled={deleteLoading || deleteConfirmation.toLowerCase() !== `delete ${deleteUserName}`.toLowerCase()}
                >
                  {deleteLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </span>
                  ) : (
                    'Yes, Delete User'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 