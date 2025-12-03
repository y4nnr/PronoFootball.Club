import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useTranslation } from '../hooks/useTranslation';
import Footer from '../components/Footer';
import { 
  ArrowRightOnRectangleIcon,
  InformationCircleIcon,
  UserGroupIcon,
  CogIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  TrophyIcon,
  BoltIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

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
  const loginPopupRef = useRef<HTMLDivElement>(null);

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
    }

    if (isLoginOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLoginOpen]);

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

      {/* Top banner (landing only, no navbar) */}
      <header
        className="fixed top-0 left-0 w-full bg-gray-800 backdrop-blur-lg shadow-2xl border-b-2 md:border-b-3 lg:border-b-4 border-white z-40"
        style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 lg:h-24 py-1 md:py-2 flex items-center justify-between relative">
          <div className="text-white font-bold text-lg md:text-xl lg:text-2xl tracking-tight" style={{ letterSpacing: '0.01em' }}>
            PronoFootball.Club
          </div>

          {/* Login trigger + aligned popup */}
          <div className="relative" ref={loginPopupRef}>
            <button
              type="button"
              onClick={() => setIsLoginOpen(v => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/30 bg-white/5 text-xs sm:text-sm font-medium text-white hover:bg-white/10 hover:border-white/60 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Se connecter</span>
            </button>

            {isLoginOpen && (
              <div className="absolute right-0 mt-3 w-[min(100vw-2rem,24rem)] sm:w-96 md:w-[26rem] lg:w-[28rem] animate-fade-in z-50">
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
                  <div className="bg-gray-800/95 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl border-2 border-white/30">
                    <div className="space-y-4">
                      <div>
                        <input
                          id="emailOrUsername"
                          name="emailOrUsername"
                          type="text"
                          autoComplete="username"
                          required
                          className="appearance-none relative block w-full px-3 sm:px-4 py-2 sm:py-3 border border-white/30 placeholder-neutral-300 text-white bg-white/20 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-sm backdrop-blur-sm"
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
                          className="appearance-none relative block w-full px-3 sm:px-4 py-2 sm:py-3 border border-white/30 placeholder-neutral-300 text-white bg-white/20 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-sm backdrop-blur-sm"
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
            )}
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-16 relative z-10 pt-20 sm:pt-28 md:pt-32">
        <div className="relative max-w-5xl mx-auto text-center">
          {/* Hero section */}
          <section>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-5 md:mb-6 animate-fade-in">
              <span className="gradient-text-home">{t('welcome')}</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-10 md:mb-12 text-primary-100 animate-slide-in max-w-3xl mx-auto leading-relaxed">
              {t('homepage.subtitle')}
            </p>
          </section>
          
          {/* Vertically separated feature sections */}

          {/* About the app */}
          <section className="mt-16 md:mt-20 max-w-4xl">
            <div className="bg-gray-800/60 backdrop-blur-lg rounded-2xl p-6 sm:p-8 md:p-10 border border-white/20 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),0_8px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6),0_10px_20px_-4px_rgba(0,0,0,0.4)] transition-all duration-300">
              <div className="text-left space-y-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                    <InformationCircleIcon className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4 text-blue-100">Qu'est-ce que PronoFootball.Club ?</h2>
                    <p className="text-sm sm:text-base md:text-lg text-primary-100/90 leading-relaxed">
                      PronoFootball.Club est une plateforme privée de pronostics football conçue pour des ligues réelles entre amis, collègues ou communautés.
                      Créez vos propres compétitions, invitez des joueurs, suivez chaque match et laissez la plateforme calculer les points et classements pour vous en temps réel.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                    <UserGroupIcon className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-semibold mb-3 text-green-100">Fonctionnement pour les joueurs</h3>
                    <ul className="space-y-2 text-sm sm:text-base text-primary-100/90 list-disc list-inside">
                      <li>Créez ou rejoignez une compétition privée (Ligue des Champions, Euro, Coupe du Monde, etc.).</li>
                      <li>Placez vos pronostics pour chaque match avant le coup d'envoi dans une interface simple et adaptée au mobile.</li>
                      <li>Suivez les scores en direct et voyez vos points se mettre à jour automatiquement selon les résultats réels.</li>
                      <li>Comparez votre classement quotidien et global avec les autres joueurs et suivez vos séries et scores exacts.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Separator between thematic sections */}
          <div className="mt-16 md:mt-20 h-[2px] max-w-4xl mx-auto bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* Feature block: Competition & league management */}
          <section className="mt-10 max-w-4xl">
            <div className="bg-gray-800/60 backdrop-blur-lg rounded-2xl p-6 sm:p-8 md:p-10 border border-white/20 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),0_8px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6),0_10px_20px_-4px_rgba(0,0,0,0.4)] transition-all duration-300">
              <div className="text-left flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-amber-500/20 rounded-xl border border-amber-500/30">
                  <TrophyIcon className="w-6 h-6 md:w-8 md:h-8 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-amber-100">Organisez des ligues de pronostics sérieuses, sans le travail administratif</h2>
                  <p className="text-sm sm:text-base md:text-lg text-primary-100/90 leading-relaxed mb-4">
                    En tant qu'organisateur, vous contrôlez les compétitions tandis que PronoFootball.Club gère toutes les tâches fastidieuses :
                  </p>
                  <ul className="space-y-2 text-sm sm:text-base text-primary-100/90 list-disc list-inside">
                    <li>Configurez les compétitions avec dates de début/fin, logos et statut en direct.</li>
                    <li>Gérez les équipes et les matchs une fois, puis réutilisez les mêmes données pour plusieurs éditions.</li>
                    <li>Invitez des joueurs et voyez qui a rejoint, qui est actif et qui prend du retard.</li>
                    <li>Laissez la plateforme calculer automatiquement les classements, les gagnants et les "trophées" de dernière place.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Separator between thematic sections */}
          <div className="mt-16 md:mt-20 h-[2px] max-w-4xl mx-auto bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* Feature block: Live scores & smart stats */}
          <section className="mt-10 max-w-4xl">
            <div className="bg-gray-800/60 backdrop-blur-lg rounded-2xl p-6 sm:p-8 md:p-10 border border-white/20 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),0_8px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6),0_10px_20px_-4px_rgba(0,0,0,0.4)] transition-all duration-300">
              <div className="text-left flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
                  <BoltIcon className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-purple-100">Scores en direct, statistiques détaillées et suivi de progression</h2>
                  <p className="text-sm sm:text-base md:text-lg text-primary-100/90 leading-relaxed mb-4">
                    Sous le capot, PronoFootball.Club se connecte aux données football en direct et transforme les résultats bruts en insights engageants :
                  </p>
                  <ul className="space-y-2 text-sm sm:text-base text-primary-100/90 list-disc list-inside">
                    <li>Synchronisation automatique des scores en direct et finaux pour les compétitions supportées.</li>
                    <li>Tableaux de bord par utilisateur avec points totaux, précision, séries de victoires et séries de scores exacts.</li>
                    <li>Widgets visuels qui montrent comment se sont passés vos derniers matchs et comment votre classement évolue dans le temps.</li>
                    <li>Classements et résumés de compétitions toujours à jour, même pendant les matchs en direct.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Separator between thematic sections */}
          <div className="mt-16 md:mt-20 h-[2px] max-w-4xl mx-auto bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* Feature block: Designed for match days */}
          <section className="mt-10 max-w-4xl">
            <div className="bg-gray-800/60 backdrop-blur-lg rounded-2xl p-6 sm:p-8 md:p-10 border border-white/20 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),0_8px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6),0_10px_20px_-4px_rgba(0,0,0,0.4)] transition-all duration-300">
              <div className="text-left flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                  <DevicePhoneMobileIcon className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 text-cyan-100">Conçu pour les jours de match et l'utilisation mobile</h2>
                  <p className="text-sm sm:text-base md:text-lg text-primary-100/90 leading-relaxed mb-4">
                    Toute l'expérience est optimisée pour les soirées entre amis, les vérifications rapides avant le coup d'envoi et le suspense en direct :
                  </p>
                  <ul className="space-y-2 text-sm sm:text-base text-primary-100/90 list-disc list-inside">
                    <li>Tableau de bord mobile-first avec les matchs du jour, les prochains matchs et vos pronostics ouverts.</li>
                    <li>Compte à rebours clair jusqu'au prochain match pour que personne n'oublie de placer son pronostic.</li>
                    <li>Actualisation en direct des cartes de match quand les scores changent, sans recharger la page.</li>
                    <li>Outils d'administration pour corriger les scores ou les matchs quand quelque chose d'inattendu se produit.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Screenshots section - Add your screenshots in public/images/screenshots/ */}
          {/* 
          <section className="mt-12 md:mt-16 text-left max-w-4xl border-t border-white/10 pt-10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                <ChartBarIcon className="w-6 h-6 md:w-8 md:h-8 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl md:text-2xl font-semibold mb-4 text-indigo-100">Découvrez l'interface</h2>
                <p className="text-sm sm:text-base md:text-lg text-primary-100/90 leading-relaxed mb-6">
                  Voici quelques captures d'écran de PronoFootball.Club en action :
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <img 
                      src="/images/screenshots/dashboard.png" 
                      alt="Tableau de bord PronoFootball.Club" 
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <img 
                      src="/images/screenshots/betting.png" 
                      alt="Page de pronostics PronoFootball.Club" 
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <img 
                      src="/images/screenshots/stats.png" 
                      alt="Statistiques PronoFootball.Club" 
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <img 
                      src="/images/screenshots/competitions.png" 
                      alt="Compétitions PronoFootball.Club" 
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
          */}
        </div>
      </div>

      {/* Use the same footer as the rest of the app */}
      <Footer />
    </div>
  );
}
