import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ChangePasswordForm from '../components/ChangePasswordForm';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // Check if user needs to change password
      fetch('/api/auth/check-password-change')
        .then(res => res.json())
        .then(data => {
          if (!data.needsPasswordChange) {
            router.push('/dashboard');
          } else {
            setNeedsPasswordChange(true);
          }
        })
        .catch(() => {
          router.push('/dashboard');
        });
    }
  }, [status, router]);

  if (status === 'loading' || !needsPasswordChange) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f8fa' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: '#f7f8fa' }}>
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold gradient-text">Change Your Password</h1>
          <p className="mt-2 text-neutral-700">
            For security reasons, you must change your password before continuing.
          </p>
        </div>
        <ChangePasswordForm
          onSuccess={() => router.push('/dashboard')}
        />
      </div>
    </div>
  );
} 