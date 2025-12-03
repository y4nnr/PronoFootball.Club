import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTranslation } from '../hooks/useTranslation';
import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';
import { HomeIcon, PencilSquareIcon, ChartBarIcon, CalendarIcon, UserGroupIcon, ShieldCheckIcon, ArrowLeftIcon, UserIcon, ArrowRightOnRectangleIcon, TrophyIcon } from '@heroicons/react/24/outline';

export default function Navbar() {
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const adminEditRef = useRef<HTMLDivElement>(null);

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
    
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle scroll event to animate profile picture
  useEffect(() => {
    if (!isClient) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 50); // Start animation after 50px of scroll
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient]);

  // Fetch user profile picture separately
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/user/profile-picture')
        .then(res => res.json())
        .then(data => {
          // Only update if we have a real profile picture URL
          if (data.profilePictureUrl) {
            setProfilePictureUrl(data.profilePictureUrl);
          } else {
            // Explicitly set to null if no profile picture
            setProfilePictureUrl(null);
          }
        })
        .catch(err => {
          console.error('Failed to fetch profile picture:', err);
          setProfilePictureUrl(null);
        });
    }
  }, [session?.user?.id]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (adminEditRef.current && !adminEditRef.current.contains(event.target as Node)) {
        setAdminEditOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = session?.user?.role?.toLowerCase() === 'admin';
  
  // Debug logging
  useEffect(() => {
    console.log('Session:', session);
    console.log('Is Admin:', isAdmin);
  }, [session, isAdmin]);

  const navigationItems = [
    { name: t('dashboard.nav.home'), href: '/dashboard', icon: <HomeIcon className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />, showFor: ['user', 'admin'] },
    { name: t('dashboard.nav.competitions'), href: '/competitions', icon: <TrophyIcon className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />, showFor: ['user', 'admin'] },
    { name: t('dashboard.nav.stats'), href: '/stats', icon: <ChartBarIcon className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />, showFor: ['user', 'admin'] },
  ];

  // Admin edit menu items (separate from main navigation)
  const adminEditItems = [
    { name: t('admin.competitions.title'), href: '/admin/competitions', icon: <CalendarIcon className="size-5 text-orange-400" /> },
    { name: t('dashboard.admin.manageTeams'), href: '/admin/teams', icon: <ShieldCheckIcon className="size-5 text-orange-400" /> },
    { name: t('dashboard.admin.manageUsers'), href: '/admin/users', icon: <UserGroupIcon className="size-5 text-orange-400" /> },
  ];

  const filteredNavigation = navigationItems.filter(item => item.showFor.includes(isAdmin ? 'admin' : 'user'));

  // Debug logging
  useEffect(() => {
    console.log('Filtered Navigation:', filteredNavigation);
  }, [filteredNavigation]);

  // Check if we can show a back button (only on client side to prevent hydration mismatch)
  const isOnBettingPage = router.pathname.startsWith('/betting');
  const isOnLoginPage = router.pathname === '/' || router.pathname === '/login';
  const canGoBack = isClient && router.pathname !== '/dashboard' && window.history.length > 1;

  // Back button handler
  const handleGoBack = () => {
    if (isOnBettingPage) {
      // On betting pages, always go to dashboard
      router.push('/dashboard');
    } else if (canGoBack) {
      router.back();
    }
  };

  // Nav item with text label below icon
  const NavItem = ({ item }: { item: typeof filteredNavigation[0] }) => {
    const isActive = router.pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group inline-flex flex-col items-center justify-center gap-1.5 md:gap-2 lg:gap-3 rounded-lg transition-all duration-200 w-[90px] md:w-[100px] lg:w-[115px] xl:w-[128px] h-[50px] md:h-[56px] lg:h-[62px] xl:h-[68px] shrink-0 select-none bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          isActive ? 'bg-white/10 text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <div className="mb-0">{item.icon}</div>
        <span className={`whitespace-nowrap text-[10px] md:text-xs lg:text-sm xl:text-base font-medium leading-none tracking-[0.01em] text-center ${isActive ? 'text-white' : item.showFor.length === 1 && item.showFor.includes('admin') ? 'text-orange-400 group-hover:text-orange-300' : 'text-gray-100 group-hover:text-white'}`}>
          {item.name}
        </span>
      </Link>
    );
  };

  // Back button component
  const BackButton = () => {
    const isEnabled = isOnBettingPage || canGoBack;
    return (
      <button
        onClick={handleGoBack}
        className={`group inline-flex flex-col items-center justify-center gap-1.5 md:gap-2 lg:gap-3 rounded-lg transition-all duration-200 w-[90px] md:w-[100px] lg:w-[115px] xl:w-[128px] h-[50px] md:h-[56px] lg:h-[62px] xl:h-[68px] shrink-0 bg-white/[0.03] ${
          isEnabled
            ? 'text-gray-300 hover:text-white hover:bg-white/10'
            : 'text-gray-600 cursor-not-allowed'
        }`}
        disabled={!isEnabled}
      >
        <div className="mb-0">
          <ArrowLeftIcon className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />
        </div>
        <span className={`${isEnabled ? 'text-[10px] md:text-xs lg:text-sm xl:text-[15px] font-medium tracking-wide text-gray-100 group-hover:text-white whitespace-nowrap' : 'text-[10px] md:text-xs lg:text-sm xl:text-[15px] font-medium tracking-wide text-gray-600 whitespace-nowrap'} leading-tight text-center`}>
          {t('back')}
        </span>
      </button>
    );
  };

  // Mobile bottom navigation bar
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-gray-800 backdrop-blur-lg border-t-2 border-white shadow-2xl" style={{ boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5), 0 -4px 6px -2px rgba(0, 0, 0, 0.3)' }}>
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {filteredNavigation.map(item => {
          const isActive = router.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 flex-1 min-w-0 h-[64px] ${
                isActive 
                  ? 'text-white bg-white/10' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <span className="text-[10px] font-medium leading-tight text-center whitespace-nowrap flex-shrink-0">
                {item.name}
              </span>
            </Link>
          );
        })}
        {/* Back button for mobile - always show in normal color */}
        <button
          onClick={(isOnBettingPage || canGoBack) ? handleGoBack : undefined}
          disabled={!(isOnBettingPage || canGoBack)}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 flex-1 min-w-0 h-[64px] text-gray-300 hover:text-white hover:bg-white/5"
        >
          <ArrowLeftIcon className="h-5 w-5 flex-shrink-0" />
          <span className="text-[10px] font-medium leading-tight text-center whitespace-nowrap flex-shrink-0">
            {t('back')}
          </span>
        </button>
      </div>
    </div>
  );

  // Don't render navbar on login page
  if (isOnLoginPage) {
    return null;
  }

  return (
    <>
      <nav className="fixed top-0 left-0 w-full bg-gray-800 backdrop-blur-lg shadow-2xl border-b-2 md:border-b-3 lg:border-b-4 border-white z-40" style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20 lg:h-24 py-1 md:py-2">
            {/* Left: User Profile + Separator + Back Button + Navigation */}
            <div className="flex items-center space-x-4">
              {/* Site Name */}
              <Link
                href="/"
                className="text-white font-bold text-lg md:text-xl lg:text-2xl xl:text-3xl tracking-tight mr-1 ml-2 md:ml-4 hover:text-white transition-colors select-none"
                style={{ letterSpacing: '0.01em' }}
              >
                PronoFootball.Club
              </Link>
              {/* Back Button + Navigation with text labels (desktop only) */}
              <div className="flex items-center gap-0 hidden md:flex -ml-2">
                <BackButton />
                {filteredNavigation.map(item => (
                  <NavItem key={item.href} item={item} />
                ))}
                {/* Admin Edit Button */}
                {isAdmin && (
                  <div className="relative" ref={adminEditRef}>
                    <button
                      onClick={() => setAdminEditOpen(v => !v)}
                      className={`group inline-flex flex-col items-center justify-center gap-1.5 md:gap-2 lg:gap-3 rounded-lg transition-all duration-200 w-[90px] md:w-[100px] lg:w-[115px] xl:w-[128px] h-[50px] md:h-[56px] lg:h-[62px] xl:h-[68px] shrink-0 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                        router.pathname.startsWith('/admin/competitions') || router.pathname.startsWith('/admin/teams') || router.pathname.startsWith('/admin/users')
                          ? 'bg-white/10 text-orange-400 shadow-md' 
                          : 'text-orange-400 hover:text-orange-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="mb-0">
                        <PencilSquareIcon className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />
                      </div>
                      <span className="whitespace-nowrap text-[10px] md:text-xs lg:text-sm xl:text-base font-medium leading-none tracking-[0.01em] text-center">
                        Edit
                      </span>
                    </button>
                    {/* Admin Edit Dropdown */}
                    {adminEditOpen && (
                      <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
                        {adminEditItems.map(item => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                              router.pathname.startsWith(item.href)
                                ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => setAdminEditOpen(false)}
                          >
                            <span className="text-xl">{item.icon}</span>
                            <span>{item.name}</span>
                          </Link>
                        ))}
                        <div className="border-t border-gray-200 my-2"></div>
                        <button
                          onClick={() => { setAdminEditOpen(false); signOut({ callbackUrl: '/login' }); }}
                          className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
                        >
                          <ArrowRightOnRectangleIcon className="w-5 h-5 shrink-0" />
                          <span>Déconnexion</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: User Profile Picture - Half on banner, half below */}
            {session?.user && (
              <div 
                className="relative h-16 md:h-20 lg:h-24" 
                ref={profileRef} 
                style={{ 
                  display: 'flex', 
                  alignItems: (isOnBettingPage && isMobile) ? 'center' : (isScrolled ? 'center' : 'flex-end')
                }}
              >
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className={`relative z-10 group transition-all duration-500 ease-out ${
                    (isOnBettingPage && isMobile)
                      ? 'mb-0' 
                      : (isScrolled ? 'mb-0' : '-mb-12 md:-mb-14 lg:-mb-[70px]')
                  } ${
                    !isOnBettingPage && isScrolled ? 'avatar-shrink-bounce' : ''
                  }`}
                  aria-label="Open profile menu"
                  style={{ 
                    transform: (isOnBettingPage && isMobile) ? 'scale(1)' : (isScrolled ? 'scale(0.4)' : 'scale(1)'),
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Profile Picture - Bigger, half overlapping (positioned at bottom of navbar) */}
                  {profilePictureUrl && (
                    <img
                      src={profilePictureUrl}
                      alt={session.user.name || 'User'}
                      width={140}
                      height={140}
                      className={`rounded-full border-2 md:border-3 lg:border-4 border-white object-cover shadow-2xl transition-all duration-300 ${
                        (isOnBettingPage && isMobile)
                          ? 'w-12 h-12 md:w-20 md:h-20 lg:w-28 lg:h-28' 
                          : 'w-20 h-20 md:w-28 md:h-28 lg:w-[140px] lg:h-[140px]'
                      }`}
                      loading="eager"
                    />
                  )}
                </button>
                {/* Profile dropdown */}
                {profileOpen && (
                  <div className={`absolute right-0 w-44 bg-zinc-900/95 rounded-xl shadow-lg border border-zinc-800 py-2 z-50 animate-fade-in ${isScrolled ? 'top-full' : 'top-[calc(100%+3rem)] md:top-[calc(100%+3.5rem)] lg:top-[calc(100%+70px)]'}`}>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-4 py-2 text-gray-200 hover:bg-white/10 rounded-md transition"
                      onClick={() => setProfileOpen(false)}
                    >
                      <UserIcon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 min-w-0 break-words text-sm md:text-base">Mon Profile</span>
                    </Link>
                    <button
                      onClick={() => { setProfileOpen(false); signOut({ callbackUrl: '/login' }); }}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-gray-200 hover:bg-white/10 rounded-md transition"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 min-w-0 break-words text-sm md:text-base">Déconnexion</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      {/* Mobile bottom navigation bar */}
      {!isOnLoginPage && <MobileBottomNav />}
    </>
  );
} 