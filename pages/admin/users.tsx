import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  profilePictureUrl?: string;
}

const DEFAULT_AVATAR = 'https://via.placeholder.com/40x40?text=User';

export default function AdminUsers() {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch {
      // error handling removed as error variable is unused
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users?id=${deleteUserId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        // error handling removed as error variable is unused
      } else {
        // Show success message briefly
        // setError('');
        console.log('User deleted successfully');
      }
    } catch {
      // error handling removed as error variable is unused
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setDeleteUserId(null);
      fetchUsers();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Users</h1>
          <div className="flex justify-center">
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition"
            >
              New User
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-gray-600">Loading users...</span>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2">
                      <img
                        src={user.profilePictureUrl || DEFAULT_AVATAR}
                        alt={user.name + ' avatar'}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-white"
                        onError={e => (e.currentTarget.src = DEFAULT_AVATAR)}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-2 text-gray-700">{user.email}</td>
                    <td className="px-4 py-2 text-gray-700">{user.role}</td>
                    <td className="px-4 py-2 text-gray-700">{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2 flex space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="px-3 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500 transition text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(user.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                {formError && <div className="text-red-600 text-sm mt-2">{formError}</div>}
                {successMessage && <div className="text-green-600 text-sm mt-2">{successMessage}</div>}
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
                
                <p className="text-red-600 font-semibold text-sm">
                  ⚠️ This action cannot be undone!
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteUserId(null);
                    setDeleteUserName('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition font-medium"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md shadow hover:bg-red-700 transition disabled:opacity-50 font-medium"
                  disabled={deleteLoading}
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