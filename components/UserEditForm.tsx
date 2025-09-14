import { useState } from 'react';
import ShowPasswordButton from './ShowPasswordButton';
import { useTranslation } from '../hooks/useTranslation';

interface UserEditData {
  name: string;
  email: string;
  role: string;
  profilePictureUrl?: string;
  password?: string;
}

interface UserEditFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    profilePictureUrl?: string;
  };
  onSave: (data: UserEditData) => Promise<void>;
  onCancel: () => void;
}

export default function UserEditForm({ user, onSave, onCancel }: UserEditFormProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [profilePictureUrl, setProfilePictureUrl] = useState(user.profilePictureUrl || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useTranslation('common');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data: UserEditData = {
        name,
        email,
        role,
        profilePictureUrl,
      };

      if (password) {
        data.password = password;
      }

      await onSave(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordShow = (hashedPassword: string) => {
    setShowPassword(true);
    setPassword(hashedPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <label htmlFor="profilePictureUrl" className="block text-sm font-medium text-gray-700">
          Profile Picture URL
        </label>
        <input
          type="url"
          id="profilePictureUrl"
          value={profilePictureUrl}
          onChange={(e) => setProfilePictureUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <div className="mt-1 flex items-center space-x-2">
          <input
            type="text"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={showPassword ? t('profile.hashedPasswordShown') : t('profile.clickShowPassword')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            readOnly={showPassword}
          />
          <ShowPasswordButton userId={user.id} onPasswordShow={handlePasswordShow} />
        </div>
        {showPassword ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-500">
              This is the hashed password. To change it:
            </p>
            <ol className="text-sm text-gray-500 list-decimal list-inside">
              <li>Clear this field</li>
              <li>Enter a new password</li>
              <li>Click Save Changes</li>
            </ol>
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-500">
            Click &quot;Show Password&quot; to view the current password hash
          </p>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
} 