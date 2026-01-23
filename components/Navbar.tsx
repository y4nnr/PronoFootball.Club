import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useTranslation } from '../hooks/useTranslation';
import { useRouter } from 'next/router';
import { useState, useRef, useEffect } from 'react';
import { HomeIcon, PencilSquareIcon, ChartBarIcon, CalendarIcon, UserGroupIcon, ShieldCheckIcon, ArrowLeftIcon, UserIcon, ArrowRightOnRectangleIcon, TrophyIcon, ArrowPathIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';
import logoPng from '../logo.png';
import logoDarkPng from '../logo-dark.png';

type Theme = 'light' | 'dark';

export default function Navbar() {
  const { data: session } = useSession();
  const { t } = useTranslation('common');
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  
  // Get initial theme synchronously to prevent logo flash
  const [initialTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme) return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  
  // Use initial theme on first render, then sync with context theme once mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const currentTheme = mounted ? theme : initialTheme;
  // Get profile picture from session directly (no fetch needed)
  // Use persistent state to prevent blinking on navigation
  // Initialize to null to avoid hydration mismatch (will be loaded from localStorage after mount)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return null;
  });
  
  // Load from localStorage and session after mount (client-side only)
  useEffect(() => {
    setIsClient(true);
    
    // First, try to load from localStorage (fastest, prevents blinking)
    const cached = localStorage.getItem('profilePictureUrl');
    if (cached) {
      setProfilePictureUrl(cached);
      // Preload the cached image using native Image constructor
      const img = new window.Image();
      img.src = cached;
    }
    
    // Then, update from session if available (may be different/newer)
    if (session?.user?.profilePictureUrl) {
      if (cached !== session.user.profilePictureUrl) {
        setProfilePictureUrl(session.user.profilePictureUrl);
        // Cache in localStorage for instant load on next page
        localStorage.setItem('profilePictureUrl', session.user.profilePictureUrl);
        // Preload the new image using native Image constructor
        const img = new window.Image();
        img.src = session.user.profilePictureUrl;
      }
    } else if (session?.user && !session.user.profilePictureUrl) {
      // User has no profile picture, clear cache
      setProfilePictureUrl(null);
      localStorage.removeItem('profilePictureUrl');
    }
  }, [session?.user?.profilePictureUrl]);

  // Update profile picture URL when session changes (after initial mount)
  useEffect(() => {
    if (!isClient) return; // Don't run on server
    
    if (session?.user?.profilePictureUrl) {
      // Only update if different to avoid unnecessary re-renders
      if (profilePictureUrl !== session.user.profilePictureUrl) {
        setProfilePictureUrl(session.user.profilePictureUrl);
        // Cache in localStorage for instant load on next page
        localStorage.setItem('profilePictureUrl', session.user.profilePictureUrl);
        // Preload the new image using native Image constructor
        const img = new window.Image();
        img.src = session.user.profilePictureUrl;
      }
    } else if (session?.user && !session.user.profilePictureUrl) {
      // User has no profile picture, clear cache
      if (profilePictureUrl !== null) {
        setProfilePictureUrl(null);
        localStorage.removeItem('profilePictureUrl');
      }
    }
    // Don't clear if session is loading - keep previous value
  }, [session?.user?.profilePictureUrl, profilePictureUrl, isClient]);
  // Initialize with scale that matches logo size
  const [profileScale, setProfileScale] = useState(0.6); // Minimized scale (moderate for mobile)
  const [profileExpandedScale, setProfileExpandedScale] = useState(1.0); // Expanded scale (base size)
  const profileRef = useRef<HTMLDivElement>(null);
  const adminEditRef = useRef<HTMLDivElement>(null);


  // Track window width for responsive profile picture alignment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateWidth = () => {
        setWindowWidth(window.innerWidth);
      };
      // Initialize immediately
      updateWidth();
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);
  

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
    
    // Check if mobile on mount and resize, and calculate profile scale to match logo
    const checkMobileAndScale = () => {
      setIsMobile(window.innerWidth < 768);
      // Calculate scale to match logo size based on screen width
      // When NOT scrolled: use larger scale (for overlap effect)
      // When scrolled (minimized): scale DOWN but to a size bigger than before
      // Logo: w-16 h-16 (64px) mobile, w-20 h-20 (80px) tablet+
      // Profile base: w-20 h-20 (80px) mobile
      // We want minimized size to be bigger, so when scrolled, scale should be > 1 but < the not-scrolled scale
      const width = window.innerWidth;
      if (width < 820) {
        // Mobile: base 80px, make minimized moderate size
        const minimizedScale = 0.6; // 80px * 0.6 = 48px (moderate size)
        const expandedScale = 1.0; // Base size when not scrolled
        setProfileScale(minimizedScale);
        setProfileExpandedScale(expandedScale);
      } else if (width < 1024) {
        // Tablet: base 112px, make minimized smaller
        const minimizedScale = 0.45; // 112px * 0.45 = 50px (smaller)
        const expandedScale = 1.0;
        setProfileScale(minimizedScale);
        setProfileExpandedScale(expandedScale);
      } else {
        // Desktop: base 140px, make minimized slightly smaller
        const minimizedScale = 0.5; // 140px * 0.5 = 70px (slightly smaller)
        const expandedScale = 1.0;
        setProfileScale(minimizedScale);
        setProfileExpandedScale(expandedScale);
      }
    };
    
    checkMobileAndScale();
    window.addEventListener('resize', checkMobileAndScale);
    return () => window.removeEventListener('resize', checkMobileAndScale);
  }, []);

  // Handle scroll event to animate profile picture with smooth debouncing
  useEffect(() => {
    if (!isClient) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const scrolled = scrollY > 50;
          setIsScrolled(scrolled);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Use passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient]);

  // Profile picture is now included in session, no need to fetch separately

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
    { name: 'Live Sync', href: '/admin/live-sync', icon: <ArrowPathIcon className="size-5 text-orange-400" /> },
  ];

  const filteredNavigation = navigationItems.filter(item => item.showFor.includes(isAdmin ? 'admin' : 'user'));

  // Debug logging
  useEffect(() => {
    console.log('Filtered Navigation:', filteredNavigation);
  }, [filteredNavigation]);

  // Check if we can show a back button (only on client side to prevent hydration mismatch)
  const isOnBettingPage = router.pathname.startsWith('/betting');
  const isOnLoginPage = router.pathname === '/' || router.pathname === '/login';
  const isOnAboutPage = router.pathname === '/about';
  const canGoBack = isClient && router.pathname !== '/dashboard' && window.history.length > 1;

  // Back button handler - always enabled, falls back to dashboard if no history
  const handleGoBack = () => {
    if (isOnBettingPage) {
      // On betting pages, always go to dashboard
      router.push('/dashboard');
    } else if (canGoBack) {
      router.back();
    } else {
      // Fallback to dashboard if no history
      router.push('/dashboard');
    }
  };

  // Nav item with text label below icon
  const NavItem = ({ item }: { item: typeof filteredNavigation[0] }) => {
    const isActive = router.pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group inline-flex flex-col items-center justify-center gap-1.5 md:gap-2 lg:gap-3 rounded-md px-3 py-1 transition-all duration-200 w-[90px] md:w-[100px] lg:w-[115px] xl:w-[128px] h-[50px] md:h-[56px] lg:h-[62px] xl:h-[68px] shrink-0 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          isActive 
            ? 'text-white' 
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
        style={isActive ? {
          background: 'rgba(255, 255, 255, 0.15)',
          borderBottom: theme === 'dark' 
            ? '3px solid var(--accent-500)' // Uses CSS variable for accent color
            : '3px solid rgba(255, 255, 255, 0.9)',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          transform: 'translateZ(0)',
          willChange: 'auto'
        } : {}}
      >
        <div className="mb-0">
          {item.icon}
        </div>
        <span className={`whitespace-nowrap text-[10px] md:text-xs lg:text-sm xl:text-base font-medium leading-none tracking-[0.01em] text-center ${
          isActive 
            ? 'text-white' 
            : item.showFor.length === 1 && item.showFor.includes('admin') 
              ? 'text-orange-400 group-hover:text-orange-300' 
              : 'text-gray-100 group-hover:text-white'
        }`}>
          {item.name}
        </span>
      </Link>
    );
  };

  // Back button component - always visible and enabled
  const BackButton = () => {
    // Always enabled - button is always visible and clickable
    const isEnabled = true;
    return (
      <button
        onClick={handleGoBack}
        className="group inline-flex flex-col items-center justify-center gap-1.5 md:gap-2 lg:gap-3 rounded-lg transition-all duration-200 w-[90px] md:w-[100px] lg:w-[115px] xl:w-[128px] h-[50px] md:h-[56px] lg:h-[62px] xl:h-[68px] shrink-0 bg-white/[0.03] text-gray-300 hover:text-white hover:bg-white/10"
      >
        <div className="mb-0">
          <ArrowLeftIcon className="h-4 w-4 md:h-4 md:w-4 lg:h-5 lg:w-5" />
        </div>
        <span className="text-[10px] md:text-xs lg:text-sm xl:text-[15px] font-medium tracking-wide text-gray-100 group-hover:text-white whitespace-nowrap leading-tight text-center">
          {t('back')}
        </span>
      </button>
    );
  };

  // Mobile bottom navigation bar
  // Mobile nav shows until 820px (using custom tablet: breakpoint)
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-40 tablet:hidden bg-gray-800 dark:bg-gray-900 backdrop-blur-lg border-t-2 border-white dark:border-accent-dark-500 shadow-2xl" style={{ boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5), 0 -4px 6px -2px rgba(0, 0, 0, 0.3)' }}>
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {filteredNavigation.map(item => {
          const isActive = router.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-md px-3 py-1 transition-all duration-200 flex-1 min-w-0 h-[64px] ${
                isActive 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              style={isActive ? {
                background: 'rgba(255, 255, 255, 0.15)',
                borderBottom: theme === 'dark'
                  ? '3px solid var(--accent-500)' // Uses CSS variable for accent color
                  : '3px solid rgba(255, 255, 255, 0.9)',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                transform: 'translateZ(0)',
                willChange: 'auto'
              } : {}}
            >
              <span className="text-xl flex-shrink-0">
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium leading-tight text-center whitespace-nowrap flex-shrink-0 ${
                isActive ? 'text-white' : ''
              }`}>
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

  // Don't render navbar on login page or about page
  if (isOnLoginPage || isOnAboutPage) {
    return null;
  }

  return (
    <>
      {/* Navbar border: consistent until 820px (tablet:), then increase */}
      <nav className="fixed top-0 left-0 w-full bg-gray-800 dark:bg-gray-900 backdrop-blur-lg shadow-2xl border-b-2 tablet:border-b-3 xl:border-b-4 dark:xl:border-b-2 border-white dark:border-accent-dark-500 z-40" style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Navbar height: consistent until 820px (tablet:), then increase */}
          <div className={`flex items-center h-16 tablet:h-20 xl:h-24 py-1 tablet:py-2 ${
            // Mobile: justify-between (logo left, profile right)
            // Desktop: 3-column layout (logo left, menu center, profile right)
            isMobile ? 'justify-between' : ''
          }`}>
            {/* Left: Site Name with Logo */}
            <div className="flex items-center flex-shrink-0">
              <Link
                href="/"
                className="flex items-center text-white hover:text-white transition-colors select-none"
              >
                {/* Site name as text - left aligned with padding */}
                <span className="text-white text-xl tablet:text-3xl xl:text-4xl 2xl:text-5xl font-bold tracking-tight pl-2 tablet:pl-4">
                  Toopil<span className="dark:text-accent-dark-400">.app</span>
                </span>
              </Link>
            </div>

            {/* Center: Back Button + Navigation with text labels (desktop only - show from 820px/tablet: breakpoint) */}
            <div className="flex items-center gap-0 hidden tablet:flex flex-1 justify-center min-w-0">
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
                      router.pathname.startsWith('/admin/competitions') || router.pathname.startsWith('/admin/teams') || router.pathname.startsWith('/admin/users') || router.pathname.startsWith('/admin/live-sync')
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
                    <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-300 py-2 z-50 animate-fade-in">
                      {adminEditItems.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                            router.pathname.startsWith(item.href)
                              ? 'bg-gray-50 text-gray-900 shadow-sm' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => setAdminEditOpen(false)}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <span>{item.name}</span>
                        </Link>
                      ))}
                      <div className="border-t border-gray-300 my-2"></div>
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

            {/* Right: User Profile Picture - Half on banner, half below */}
            {/* When scrolled (minimized), matches logo size and vertical position for symmetry */}
            {/* Reserve space for profile picture to prevent menu shift on load */}
            <div 
              className={`relative h-16 tablet:h-20 xl:h-24 flex items-end overflow-visible flex-shrink-0 ${
                isClient && (profilePictureUrl || session?.user) ? '' : 'invisible'
              } w-20 tablet:w-28 lg:w-[140px]`}
              style={{ 
                // Reserve space even when not loaded to prevent layout shift
                minWidth: '80px' // Minimum width on mobile
              }}
              ref={profileRef}
            >
              {isClient && (profilePictureUrl || session?.user) && (
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className={`relative z-10 group self-end ${
                    isMobile
                      ? 'mb-2' // Mobile: always minimized position (same for all pages)
                      : 'mb-2' // Base margin, will be overridden by inline style
                  }`}
                  aria-label="Open profile menu"
                  style={{ 
                    // On mobile: always minimized, no animation
                    // On desktop: animate based on scroll
                    transform: isMobile 
                      ? `scale(${profileScale})` // Mobile: always minimized
                      : `scale(${profileScale})`, // Desktop: always minimized (no animation)
                    transformOrigin: 'center bottom', // Always scale from bottom to prevent jumping
                    // No transition on mobile or desktop (always minimized)
                    transition: 'none',
                    // Optimize for smooth animation (desktop only)
                    willChange: isMobile ? 'auto' : 'transform',
                    // Force hardware acceleration for ultra-smooth animation (desktop only)
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    // Additional smooth rendering properties
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    // Ensure smooth sub-pixel rendering
                    imageRendering: 'auto',
                    // Fix vertical alignment: use smaller margin for resolutions below 1280px
                    marginBottom: isMobile 
                      ? '0.5rem' // mb-2
                      : (windowWidth === null || windowWidth < 1280)
                        ? '0.5rem' // mb-2 for resolutions below 1280px (default to smaller if width not yet known)
                        : '0.75rem' // mb-3 for 1280px and above
                  }}
                >
                  {/* Profile Picture - Full size, scaled down when scrolled to match logo */}
                  {profilePictureUrl && (
                    <img
                      src={profilePictureUrl}
                      alt={session?.user?.name || 'User'}
                      className="rounded-full border-2 tablet:border-3 xl:border-4 border-white object-cover shadow-2xl w-20 h-20 md:w-28 md:h-28 lg:w-[140px] lg:h-[140px]"
                      loading="eager"
                      style={{
                        // Ensure the image respects the className sizes and can be scaled
                        maxWidth: 'none',
                        maxHeight: 'none',
                        // Remove any transitions that might conflict with parent transform
                        transition: 'none'
                      }}
                    />
                  )}
                </button>
              )}
              {/* Profile dropdown */}
              {session?.user && (
                <div className={`absolute right-0 w-48 bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl shadow-lg border border-gray-300 dark:border-gray-700 py-2 z-50 transition-all duration-300 ease-in-out ${
                  isMobile 
                    ? 'top-full mt-2' // Mobile: always minimized, menu just below with small gap
                    : 'top-full' // Desktop: always minimized position (no animation)
                } ${
                  profileOpen 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 translate-x-full pointer-events-none'
                }`}
                >
                  {/* Theme Toggle - At the top */}
                  <div className="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
                    <div className="flex items-center justify-center gap-2">
                      <SunIcon className="w-5 h-5 shrink-0 text-gray-600 dark:text-gray-400" />
                      <button
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:ring-offset-2 ${
                          theme === 'dark' ? 'bg-primary-600 dark:bg-accent-dark-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        role="switch"
                        aria-checked={theme === 'dark'}
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <MoonIcon className="w-5 h-5 shrink-0 text-gray-600 dark:text-gray-400" />
                    </div>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-700 my-1"></div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors duration-200"
                    onClick={() => setProfileOpen(false)}
                  >
                    <UserIcon className="w-5 h-5 shrink-0 text-gray-600 dark:text-gray-400" />
                    <span className="flex-1 min-w-0 break-words text-sm font-medium">Mon Profile</span>
                  </Link>
                  <div className="border-t border-gray-300 dark:border-gray-700 my-1"></div>
                  <button
                    onClick={() => { setProfileOpen(false); signOut({ callbackUrl: '/login' }); }}
                    className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 rounded-lg transition-colors duration-200"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                    <span className="flex-1 min-w-0 break-words text-sm font-medium">Déconnexion</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      {/* Mobile bottom navigation bar */}
      {!isOnLoginPage && <MobileBottomNav />}
    </>
  );
} 