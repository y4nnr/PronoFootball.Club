import { useState, useEffect } from 'react';
import { useSession, signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useTranslation } from '../hooks/useTranslation';

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

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

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
    <div className="min-h-screen bg-neutral-900 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      {/* Main content */}
      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-16 relative z-10 pt-8 sm:pt-24 md:pt-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-5 md:mb-6 animate-fade-in">
            <span className="gradient-text-home">{t('welcome')}</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-10 md:mb-12 text-primary-100 animate-slide-in max-w-3xl mx-auto leading-relaxed">
            {t('homepage.subtitle')}
          </p>
          
          {/* Login Form - shown directly for non-logged-in users */}
          <div className="max-w-md mx-auto mb-12 sm:mb-16 md:mb-20 animate-fade-in">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
              <div className="glass-dark rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-modern-lg border border-white/20">
                <div className="mt-1"></div>

                <div className="space-y-4">
                  <div>
                    <input
                      id="emailOrUsername"
                      name="emailOrUsername"
                      type="text"
                      autoComplete="username"
                      required
                      className="appearance-none relative block w-full px-3 sm:px-4 py-2 sm:py-3 border border-white/20 placeholder-neutral-400 text-white bg-white/10 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-sm backdrop-blur-md"
                      placeholder={t('username')}
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="appearance-none relative block w-full px-3 sm:px-4 py-2 sm:py-3 border border-white/20 placeholder-neutral-400 text-white bg-white/10 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-sm backdrop-blur-md"
                      placeholder={t('password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4 sm:mt-5 md:mt-6">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-all duration-200 shadow-modern hover:shadow-modern-lg hover:scale-[1.02]"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        {t('signingIn')}
                      </div>
                    ) : (
                      t('signInButton')
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
          
          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-8">
            {/* Mobile: Horizontal layout with icon on left */}
            <div className="glass-dark rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 animate-fade-in md:text-left" style={{animationDelay: '0.2s'}}>
              <div className="flex items-center md:flex-col md:items-start gap-3 md:gap-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-12 md:h-12 bg-accent-500 rounded-lg sm:rounded-xl flex-shrink-0 md:mb-4 flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl md:text-2xl">⚽</span>
                </div>
                <div className="flex-1 md:flex-none">
                  <h3 className="text-sm sm:text-base md:text-xl font-semibold mb-1 md:mb-2">{t('homepage.features.predictions.title')}</h3>
                  <p className="text-xs sm:text-sm md:text-base text-primary-200 leading-relaxed">{t('homepage.features.predictions.description')}</p>
                </div>
              </div>
            </div>
            
            <div className="glass-dark rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 animate-fade-in md:text-left" style={{animationDelay: '0.4s'}}>
              <div className="flex items-center md:flex-col md:items-start gap-3 md:gap-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-12 md:h-12 bg-warm-500 rounded-lg sm:rounded-xl flex-shrink-0 md:mb-4 flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl md:text-2xl">🏆</span>
                </div>
                <div className="flex-1 md:flex-none">
                  <h3 className="text-sm sm:text-base md:text-xl font-semibold mb-1 md:mb-2">{t('homepage.features.competitions.title')}</h3>
                  <p className="text-xs sm:text-sm md:text-base text-primary-200 leading-relaxed">{t('homepage.features.competitions.description')}</p>
                </div>
              </div>
            </div>
            
            <div className="glass-dark rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 animate-fade-in md:text-left" style={{animationDelay: '0.6s'}}>
              <div className="flex items-center md:flex-col md:items-start gap-3 md:gap-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-12 md:h-12 bg-primary-500 rounded-lg sm:rounded-xl flex-shrink-0 md:mb-4 flex items-center justify-center">
                  <span className="text-2xl sm:text-3xl md:text-2xl">📊</span>
                </div>
                <div className="flex-1 md:flex-none">
                  <h3 className="text-sm sm:text-base md:text-xl font-semibold mb-1 md:mb-2">{t('homepage.features.statistics.title')}</h3>
                  <p className="text-xs sm:text-sm md:text-base text-primary-200 leading-relaxed">{t('homepage.features.statistics.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
