import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTranslation } from '../hooks/useTranslation';
import Footer from '../components/Footer';

// Define a type for the session user
interface SessionUserWithPasswordChange {
  needsPasswordChange?: boolean;
  [key: string]: unknown;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [isLoading, setIsLoading] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const loginPopupRef = useRef<HTMLDivElement>(null);
  const signUpPopupRef = useRef<HTMLDivElement>(null);
  
  // Sign up form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  // Close login popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (loginPopupRef.current && !loginPopupRef.current.contains(event.target as Node)) {
        setIsLoginOpen(false);
      }
      if (signUpPopupRef.current && !signUpPopupRef.current.contains(event.target as Node)) {
        setIsSignUpOpen(false);
      }
    }

    if (isLoginOpen || isSignUpOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLoginOpen, isSignUpOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        emailOrUsername,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Handle invalid credentials
      } else {
        // Get the session to check for password change requirement
        const session = await getSession();
        const user = session?.user as SessionUserWithPasswordChange | undefined;
        if (user?.needsPasswordChange) {
          router.push('/change-password');
        } else {
          router.push('/dashboard');
        }
      }
    } catch {
      // Handle general error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignUpError('');
    setSignUpSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password: signUpPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSignUpError(data.error || 'Failed to create account');
      } else {
        setSignUpSuccess(true);
        // Reset form
        setUsername('');
        setEmail('');
        setSignUpPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setSignUpError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-xl text-white animate-pulse">{t('dashboard.loading')}</div>
      </div>
    );
  }

  // Don't show anything while redirecting logged-in users
  if (session) {
    return null;
  }

  return (
    <div className="text-white relative flex flex-col" style={{ minHeight: '100vh', height: '100vh' }}>
      {/* Background image for both mobile and desktop */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/bck-mob.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          willChange: 'auto',
        }}
      >
        {/* Gradient overlay for better text readability - consistent across all screen sizes */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-gray-900/70 via-gray-900/60 to-gray-900/70"
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
          }}
        />
        {/* Static gradient overlay - no animation to prevent re-renders */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20"
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
          }}
        />
      </div>
      
      <div className="relative z-10 flex-1 flex flex-col">

      {/* Top banner (landing only, no navbar) */}
      <header
        className="fixed top-0 left-0 w-full bg-gray-800 backdrop-blur-lg shadow-2xl border-b-2 border-white z-40"
        style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center flex-shrink-0">
            <Link
              href="/"
              className="flex items-center text-white hover:text-white transition-colors select-none"
            >
              <span className="text-white text-xl tablet:text-3xl xl:text-4xl 2xl:text-5xl font-bold tracking-tight pl-2 tablet:pl-4">
                Toopil.app
              </span>
            </Link>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex-1 flex items-start justify-center" style={{ paddingTop: 'clamp(4rem, 10vh, 8rem)', height: '100%' }}>
        <div className="relative max-w-sm sm:max-w-md w-full px-3" style={{ marginTop: 'clamp(0.5rem, 2vh, 2rem)' }}>
          {/* Login Card */}
          <div 
            className="bg-gradient-to-br from-gray-900/40 sm:from-gray-900/60 via-gray-800/40 sm:via-gray-800/60 to-gray-900/40 sm:to-gray-900/60 backdrop-blur-lg sm:backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20"
            style={{ 
              padding: 'clamp(1.25rem, 3vh, 2.5rem)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="text-center mb-4 sm:mb-8">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-4">
                {t('welcome')}
              </h1>
              <p className="hidden sm:block text-xs sm:text-base text-gray-200 leading-relaxed max-w-sm mx-auto">
                {t('homepage.subtitle')}
              </p>
            </div>
            
            {/* Login and Sign Up buttons */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setIsLoginOpen(v => !v)}
                className="w-full px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Se connecter
              </button>
              
              <button
                type="button"
                onClick={() => setIsSignUpOpen(v => !v)}
                className="w-full px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white bg-white/10 hover:bg-white/20 border-2 border-white/30 hover:border-white/40 rounded-lg transition-all duration-200 backdrop-blur-sm"
              >
                Créer un compte
              </button>
            </div>
          </div>

          {/* En savoir plus Card */}
          <div 
            className="bg-gradient-to-br from-gray-900/40 sm:from-gray-900/60 via-gray-800/40 sm:via-gray-800/60 to-gray-900/40 sm:to-gray-900/60 backdrop-blur-lg sm:backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20 mt-8 sm:mt-12"
            style={{ 
              padding: 'clamp(1rem, 2.5vh, 2rem)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="text-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-semibold text-white mb-1.5 sm:mb-2">
                Découvrez Toopil
              </h2>
              <p className="hidden sm:block text-xs sm:text-base text-gray-200 leading-relaxed">
                En savoir plus sur notre plateforme, ses fonctionnalités et comment elle peut transformer votre expérience des pronostics football et rugby.
              </p>
            </div>
            <Link
              href="/about"
              className="block w-full text-center px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              En savoir plus
            </Link>
          </div>
        </div>
      </div>

      {/* Sign Up Modal */}
      {isSignUpOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto" style={{ paddingTop: 'clamp(4rem, 15vh, 10rem)' }} onClick={() => setIsSignUpOpen(false)}>
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-6 sm:p-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsSignUpOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                  aria-label="Close sign up form"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Créer un compte</h3>
                <form onSubmit={handleSignUp} className="space-y-5">
                  {signUpSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                      Compte créé avec succès ! Veuillez attendre l'approbation de l'administrateur avant de vous connecter.
                    </div>
                  )}
                  {signUpError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                      {signUpError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <input
                      id="username-modal"
                      name="username"
                      type="text"
                      required
                      className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      placeholder="Nom d'utilisateur *"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                      id="email-modal"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      placeholder="Email *"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                      id="signUpPassword-modal"
                      name="signUpPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      placeholder="Mot de passe *"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                    />
                    <input
                      id="confirmPassword-modal"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      placeholder="Confirmer le mot de passe *"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSignUpOpen(false)}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-semibold"
                    >
                      {isLoading ? 'Création...' : 'Créer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

      {/* Login Modal */}
      {isLoginOpen && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto" style={{ paddingTop: 'clamp(4rem, 15vh, 10rem)' }} onClick={() => setIsLoginOpen(false)}>
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-6 sm:p-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsLoginOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                  aria-label="Close login form"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Se connecter</h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <input
                      id="emailOrUsername-modal"
                      name="emailOrUsername"
                      type="text"
                      autoComplete="username"
                      required
                      className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      placeholder={t('username')}
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                    />
                    <input
                      id="password-modal"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      placeholder={t('password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsLoginOpen(false)}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-semibold"
                    >
                      {isLoading ? 'Connexion...' : 'Se connecter'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
      </div>

      {/* Use the same footer as the rest of the app */}
      <div className="relative z-10 mt-auto">
        <Footer />
      </div>
    </div>
  );
}
