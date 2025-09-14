import { useState } from 'react';

interface ShowPasswordButtonProps {
  userId: string;
  onPasswordShow: (password: string) => void;
}

export default function ShowPasswordButton({ userId, onPasswordShow }: ShowPasswordButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleShowPassword = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}/password`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch password');
      }

      onPasswordShow(data.hashedPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleShowPassword}
        disabled={isLoading}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md disabled:opacity-50 flex items-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>{isLoading ? 'Loading...' : 'Show Password'}</span>
      </button>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
} 