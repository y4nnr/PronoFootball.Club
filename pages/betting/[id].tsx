import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { prisma } from '@lib/prisma';
import { useTranslation } from '../../hooks/useTranslation';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Game {
  id: string;
  date: string;
  status: string;
  homeTeam: {
    id: string;
    name: string;
    logo?: string;
  };
  awayTeam: {
    id: string;
    name: string;
    logo?: string;
  };
  competition: {
    id: string;
    name: string;
    logo?: string | null;
  };
  bets: {
    id: string;
    score1: number;
    score2: number;
  }[];
}

interface BettingPageProps {
  game: Game;
  allGames: Game[];
  currentGameIndex: number;
}

export default function BettingPage({ game, allGames, currentGameIndex }: BettingPageProps) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingBet, setExistingBet] = useState<{ score1: number; score2: number } | null>(null);
  const [isLoadingBet, setIsLoadingBet] = useState(false);
  const [allGamesList, setAllGamesList] = useState<Game[]>(allGames);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreGames, setHasMoreGames] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isInternalNavigation = useRef(false);

  // Debug logging
  console.log('🎯 FRONTEND LOG - Initial allGames:', allGames.length);
  console.log('🎯 FRONTEND LOG - Initial allGamesList:', allGamesList.length);
  console.log('🎯 FRONTEND LOG - Current game ID:', game.id);
  console.log('🎯 FRONTEND LOG - Current game index:', currentGameIndex);

  // CRITICAL FIX: Sync allGamesList from SSR list on route change (no merge), keep deterministic order
  // Use same sorting logic as dashboard: date first, then ID for stability
  useEffect(() => {
    const sorted = [...allGames].sort((a, b) => {
      // First sort by date, then by ID for stability (matches dashboard sorting)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.id.localeCompare(b.id);
    });
    setAllGamesList(sorted);
  }, [allGames]);

  // Reset initial load flag when game changes (external navigation from dashboard/competition)
  useEffect(() => {
    // Only reset to initial load if this is NOT an internal navigation (carousel click)
    if (isInternalNavigation.current) {
      // Internal navigation - ensure we don't do initial load scroll
      setIsInitialLoad(false);
      isInternalNavigation.current = false;
    } else {
      // External navigation - do initial load scroll
      setIsInitialLoad(true);
    }
  }, [game.id]);

  // (moved) re-center effect declared after scrollToSelectedGame

  // CRITICAL FIX: Ensure currentGameIndex is always correct
  const actualCurrentGameIndex = allGamesList.findIndex(g => g.id === game.id);
  console.log('🎯 ACTUAL CURRENT GAME INDEX:', actualCurrentGameIndex, 'vs PROPS:', currentGameIndex);

  // Function to load more games
  const MAX_CAROUSEL_GAMES = 24;

  const loadMoreGames = useCallback(async () => {
    if (isLoadingMore || !hasMoreGames) return;
    
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/user/dashboard-betting-games?page=${currentPage + 1}&limit=12`);
      const data = await response.json();
      
      if (data.games && data.games.length > 0) {
        setAllGamesList(prev => {
          // Hard cap: do not load beyond MAX_CAROUSEL_GAMES
          if (prev.length >= MAX_CAROUSEL_GAMES) {
            setHasMoreGames(false);
            return prev;
          }
          
          // Transform API response to match Game interface (convert userBet to bets array)
          const transformedGames = data.games.map((g: any) => ({
            ...g,
            bets: g.userBet ? [{
              id: g.userBet.id,
              score1: g.userBet.score1,
              score2: g.userBet.score2
            }] : []
          }));
          
          // Merge, de-duplicate by id, then sort by date asc to match competition page order
          const merged = [...prev, ...transformedGames];
          const uniqueById = Array.from(new Map(merged.map(g => [g.id, g])).values());
          // Use same sorting logic as dashboard: date first, then ID for stability
          uniqueById.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return a.id.localeCompare(b.id);
          });
          // Enforce MAX_CAROUSEL_GAMES cap
          const limited = uniqueById.slice(0, MAX_CAROUSEL_GAMES);
          
          // Update hasMore based on cap and API response (using prev state, not stale closure)
          const reachedCap = limited.length >= MAX_CAROUSEL_GAMES;
          setHasMoreGames(data.hasMore && !reachedCap);
          
          return limited;
        });
        setCurrentPage(prev => prev + 1);
      } else {
        setHasMoreGames(false);
      }
    } catch (error) {
      console.error('Error loading more games:', error);
      setHasMoreGames(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMoreGames, isLoadingMore]);

  // Navigation functions
  const goToPreviousGame = useCallback(() => {
    // Use calculated index to avoid mismatch after sorting
    const idx = allGamesList.findIndex(g => g.id === game.id);
    if (allGamesList && idx > 0) {
      const previousGame = allGamesList[idx - 1];
      // Mark as internal navigation to prevent initial load scroll
      isInternalNavigation.current = true;
      router.push(`/betting/${previousGame.id}`);
    }
  }, [allGamesList, router, game.id]);

  const goToNextGame = useCallback(() => {
    // Use calculated index to avoid mismatch after sorting
    const idx = allGamesList.findIndex(g => g.id === game.id);
    if (allGamesList && idx > -1 && idx < allGamesList.length - 1) {
      const nextGame = allGamesList[idx + 1];
      // Mark as internal navigation to prevent initial load scroll
      isInternalNavigation.current = true;
      router.push(`/betting/${nextGame.id}`);
    }
  }, [allGamesList, router, game.id]);

  // Scroll functions for carousel navigation
  const scrollCarousel = useCallback((direction: 'left' | 'right') => {
    const carousel = document.getElementById('games-carousel');
    if (!carousel) return;
    
    const scrollAmount = 200; // Scroll by 200px
    const currentScroll = carousel.scrollLeft;
    const newScroll = direction === 'left' 
      ? currentScroll - scrollAmount 
      : currentScroll + scrollAmount;
    
    carousel.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  }, []);

  // Custom smooth scroll function with controlled speed
  const smoothScrollTo = useCallback((element: HTMLElement, target: number, duration: number = 600) => {
    const start = element.scrollLeft;
    const distance = target - start;
    const startTime = performance.now();

    const easeInOutCubic = (t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      
      element.scrollLeft = start + distance * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }, []);

  // Scroll to center the selected game with smooth animation
  const scrollToSelectedGame = useCallback((useSmooth: boolean = true) => {
    const carousel = document.getElementById('games-carousel');
    if (!carousel) {
      console.log('🎯 scrollToSelectedGame: Carousel not found');
      return;
    }
    
    // Use the calculated index for stability after re-sorts
    const indexToUse = allGamesList.findIndex(g => g.id === game.id);
    if (indexToUse === -1) {
      console.log('🎯 scrollToSelectedGame: Game not found in list', game.id);
      return;
    }
    
    const gameCard = carousel.children[indexToUse] as HTMLElement;
    if (!gameCard) {
      console.log('🎯 scrollToSelectedGame: Game card not found at index', indexToUse);
      return;
    }
    
    // Calculate target scroll position to center the card
    const carouselRect = carousel.getBoundingClientRect();
    const gameRect = gameCard.getBoundingClientRect();
    const targetScroll = gameCard.offsetLeft - (carouselRect.width / 2) + (gameRect.width / 2);
    
    console.log('🎯 scrollToSelectedGame:', { useSmooth, indexToUse, targetScroll, currentScroll: carousel.scrollLeft });
    
    if (useSmooth) {
      // Use custom smooth scroll with controlled duration (600ms for smoother, slower animation)
      smoothScrollTo(carousel, targetScroll, 600);
    } else {
      // Instant scroll for initial load
      carousel.scrollLeft = targetScroll;
    }
  }, [allGamesList, game.id, smoothScrollTo]);

  // Initial scroll - instant positioning when page loads or game changes from external navigation
  useEffect(() => {
    if (isInitialLoad && allGamesList.length > 0) {
      // Small delay just to ensure DOM is ready, then instant scroll
      const timer = setTimeout(() => {
        scrollToSelectedGame(false); // Instant scroll on initial load
        setIsInitialLoad(false);
      }, 50);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [allGamesList, game.id, isInitialLoad, scrollToSelectedGame]);

  // Smooth scroll for subsequent navigation within carousel
  useEffect(() => {
    // Only smooth scroll if not initial load (i.e., user clicked within carousel)
    // When isInitialLoad is false, it means this is internal navigation
    // We need to ensure we scroll whenever game.id changes and it's not the initial load
    if (!isInitialLoad && allGamesList.length > 0) {
      console.log('🎯 Smooth scroll effect triggered:', { gameId: game.id, isInitialLoad });
      // Use a delay to ensure route change and DOM update are complete
      const timer = setTimeout(() => {
        console.log('🎯 Executing smooth scroll');
        scrollToSelectedGame(true); // Smooth scroll for carousel navigation
      }, 150);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      console.log('🎯 Smooth scroll effect skipped:', { isInitialLoad, allGamesListLength: allGamesList.length });
    }
  }, [game.id, isInitialLoad, allGamesList.length, scrollToSelectedGame]);

  // Check scroll position and update arrow states
  const updateScrollState = useCallback(() => {
    const carousel = document.getElementById('games-carousel');
    if (!carousel) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = carousel;
    const isAtStart = scrollLeft <= 0;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10; // 10px threshold
    
    setCanScrollLeft(!isAtStart);
    setCanScrollRight(!isAtEnd);
    
    // Check for infinite loading
    const isNearEnd = scrollLeft + clientWidth >= scrollWidth - 100;
    if (isNearEnd && hasMoreGames && !isLoadingMore) {
      loadMoreGames();
    }
  }, [hasMoreGames, isLoadingMore, loadMoreGames]);

  // Scroll detection for infinite loading and arrow states
  useEffect(() => {
    const carousel = document.getElementById('games-carousel');
    if (carousel) {
      carousel.addEventListener('scroll', updateScrollState);
      // Initial state check
      updateScrollState();
      return () => carousel.removeEventListener('scroll', updateScrollState);
    }
  }, [updateScrollState]);

  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchExistingBet = async () => {
      // Reset form state first
      setHomeScore('');
      setAwayScore('');
      setExistingBet(null);
      setError('');
      setSuccess(false);
      setIsLoadingBet(true);
      
      try {
        const response = await fetch(`/api/bets/${game.id}`, {
          signal: abortController.signal
        });
        
        if (abortController.signal.aborted) return;
        
        const data = await response.json();
        if (response.ok && data) {
          setExistingBet(data);
          setHomeScore(data.score1.toString());
          setAwayScore(data.score2.toString());
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching existing bet:', err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingBet(false);
        }
      }
    };

    fetchExistingBet();
    
    // Cleanup: abort request if component unmounts or game.id changes
    return () => {
      abortController.abort();
    };
  }, [game.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (allGamesList && allGamesList.length > 1) {
        const currentIdx = allGamesList.findIndex(g => g.id === game.id);
        if (event.key === 'ArrowLeft' && currentIdx > 0) {
          goToPreviousGame();
        } else if (event.key === 'ArrowRight' && currentIdx >= 0 && currentIdx < allGamesList.length - 1) {
          goToNextGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allGamesList, game.id, goToPreviousGame, goToNextGame]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Client-side validation
    const homeScoreNum = parseInt(homeScore, 10);
    const awayScoreNum = parseInt(awayScore, 10);

    // Validate scores are valid numbers
    if (isNaN(homeScoreNum) || isNaN(awayScoreNum)) {
      setError('Veuillez entrer des scores valides');
      setIsSubmitting(false);
      return;
    }

    // Validate score range
    if (homeScoreNum < 0 || homeScoreNum > 99 || awayScoreNum < 0 || awayScoreNum > 99) {
      setError('Les scores doivent être entre 0 et 99');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/bets', {
        method: existingBet ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          score1: homeScoreNum,
          score2: awayScoreNum
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Update existing bet state to reflect the new bet
      setExistingBet({ score1: homeScoreNum, score2: awayScoreNum });
      
      // Update the game card in the carousel to show the bet
      setAllGamesList(prevGames => 
        prevGames.map(gameItem => 
          gameItem.id === game.id 
            ? {
                ...gameItem,
                bets: [{ 
                  id: data.id || 'temp-id', 
                  score1: homeScoreNum, 
                  score2: awayScoreNum 
                }]
              }
            : gameItem
        )
      );
      
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000); // Hide after 3 seconds
    } catch (err) {
      setError(err instanceof Error ? err.message : t('betting.failedToPlaceBet'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[rgb(12,12,12)] dark:via-[rgb(12,12,12)] dark:to-[rgb(12,12,12)] -mt-8 sm:mt-0">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 pt-0 pb-2 sm:pt-3 sm:pb-3 md:pt-4 md:pb-4">
        {/* Modern Status Header */}
        <div className="mb-0 sm:mb-3 md:mb-4">
          {/* Mobile: Hidden */}
          <div className="hidden md:block">
            <div className="flex flex-col items-center mb-1 md:mb-2">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Compétition</div>
              <div className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 text-center">{game.competition.name}</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-gray-100 dark:border-gray-600 overflow-hidden">
          <div className="p-2 sm:p-4 md:p-6">

            {/* Game Navigation */}
            {allGamesList && allGamesList.length > 1 && (
              <div className="mb-3 sm:mb-4 md:mb-5">
                {/* Game Carousel Container */}
                <div className="relative bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-lg sm:rounded-xl p-2 sm:p-3 md:p-5 border border-gray-200 dark:border-gray-600 shadow-md w-full group min-h-[160px] sm:min-h-[180px] md:min-h-[200px]">
                  {/* Mobile: Show 1-2 games, Desktop: Show 4-5 games */}
                  {/* Left Arrow */}
                  <button
                    onClick={() => scrollCarousel('left')}
                    disabled={!canScrollLeft}
                    className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 dark:bg-[rgb(40,40,40)]/90 hover:bg-white dark:hover:bg-[rgb(40,40,40)] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
                      canScrollLeft 
                        ? 'opacity-100 hover:scale-110' 
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Right Arrow */}
                  <button
                    onClick={() => scrollCarousel('right')}
                    disabled={!canScrollRight}
                    className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 dark:bg-[rgb(40,40,40)]/90 hover:bg-white dark:hover:bg-[rgb(40,40,40)] rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
                      canScrollRight 
                        ? 'opacity-100 hover:scale-110' 
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Carousel Content */}
                  <div 
                    id="games-carousel"
                    className="flex space-x-3 sm:space-x-4 overflow-x-auto pb-2 px-2 py-1 sm:py-2" 
                    style={{ 
                      scrollbarWidth: 'none', 
                      msOverflowStyle: 'none',
                      scrollSnapType: 'x mandatory',
                      scrollBehavior: 'smooth',
                      scrollPadding: '0 1rem'
                    }}
                  >
                    {allGamesList.map((gameItem, index) => {
                      const handleGameClick = () => {
                        console.log('🎯 GAME CARD CLICKED:', gameItem.id, 'Index:', index);
                        console.log('🎯 Current game ID:', game.id);
                        console.log('🎯 All games list length:', allGamesList.length);
                        
                        // Only navigate if it's a different game
                        if (gameItem.id !== game.id) {
                          console.log('🎯 Navigating to new game:', gameItem.id);
                          // Mark as internal navigation to prevent initial load scroll
                          isInternalNavigation.current = true;
                          router.push(`/betting/${gameItem.id}`);
                        } else {
                          console.log('🎯 Same game clicked, no navigation needed');
                        }
                      };

                      return (
                        <button
                          key={gameItem.id}
                          onClick={handleGameClick}
                          className={`relative p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl transition-all duration-300 flex-shrink-0 w-[120px] sm:w-[140px] md:w-[180px] min-w-[120px] sm:min-w-[140px] md:min-w-[180px] scroll-snap-start my-0.5 sm:my-1 ${
                            gameItem.bets && gameItem.bets.length > 0
                              ? index === actualCurrentGameIndex
                                ? 'bg-white dark:bg-[rgb(38,38,38)] text-gray-700 dark:text-gray-200 border-4 border-blue-500 dark:border-accent-dark-500 shadow-2xl transform scale-105 z-10'
                                : 'bg-white dark:bg-[rgb(38,38,38)] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[rgb(40,40,40)] border-2 border-blue-500 dark:border-accent-dark-500 shadow-lg hover:shadow-xl hover:scale-102'
                              : index === actualCurrentGameIndex
                                ? 'bg-white dark:bg-[rgb(38,38,38)] text-gray-700 dark:text-gray-200 border-4 border-gray-400 dark:border-gray-600 shadow-2xl transform scale-105 z-10'
                                : 'bg-white dark:bg-[rgb(38,38,38)] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[rgb(40,40,40)] border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 shadow-lg hover:shadow-xl hover:scale-102'
                          }`}
                        >
                        {/* Bet Status Indicator */}
                        {gameItem.bets && gameItem.bets.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 dark:bg-accent-dark-900 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-blue-700 dark:text-accent-dark-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        
                        <div className="text-center">
                          {/* Competition Name & Logo - More visible */}
                          {gameItem.competition && (
                            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2 sm:mb-2.5 pb-1.5 sm:pb-2 border-b border-gray-200 dark:border-gray-600">
                              {gameItem.competition.logo ? (
                                <img 
                                  src={gameItem.competition.logo} 
                                  alt={gameItem.competition.name} 
                                  className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded object-contain border border-gray-200 dark:border-gray-600 bg-white dark:bg-white dark:p-0.5 shadow-sm flex-shrink-0" 
                                />
                              ) : (
                                <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[8px] sm:text-[9px] md:text-[10px] text-gray-600 dark:text-gray-300 font-semibold flex-shrink-0 border border-gray-300 dark:border-gray-500">
                                  {gameItem.competition.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-700 dark:text-gray-300 font-semibold truncate max-w-[90px] sm:max-w-[110px] md:max-w-[130px]">
                                {gameItem.competition.name}
                              </span>
                            </div>
                          )}
                          
                          <div className="font-semibold text-[10px] sm:text-xs md:text-sm mb-1 truncate text-gray-900 dark:text-gray-100">
                            {gameItem.homeTeam.name}
                          </div>
                          <div className="text-[10px] sm:text-xs mb-1 font-medium text-gray-500 dark:text-gray-400">VS</div>
                          <div className="font-semibold text-[10px] sm:text-xs md:text-sm mb-2 truncate text-gray-900 dark:text-gray-100">
                            {gameItem.awayTeam.name}
                          </div>
                          
                          <div className="space-y-0.5 sm:space-y-1">
                            <div className="flex items-center justify-center space-x-0.5 sm:space-x-1 text-gray-600 dark:text-gray-400">
                              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-[10px] sm:text-xs md:text-sm font-medium">{new Date(gameItem.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center justify-center space-x-0.5 sm:space-x-1 text-gray-600 dark:text-gray-400">
                              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-[10px] sm:text-xs md:text-sm font-medium">{new Date(gameItem.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          
                          {gameItem.bets && gameItem.bets.length > 0 && (
                            <div className="mt-1.5 sm:mt-2 p-0.5 sm:p-1 md:p-1.5 rounded bg-blue-100 dark:!bg-gray-600 border border-blue-300 dark:border-accent-dark-500">
                              <div className="text-[10px] sm:text-xs font-semibold text-blue-700 dark:!text-white">
                                {gameItem.bets[0].score1}-{gameItem.bets[0].score2}
                              </div>
                            </div>
                          )}
                        </div>
                        
                          {index === actualCurrentGameIndex && (
                            <div className="absolute -top-1 -right-1">
                              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-400 dark:bg-gray-500 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-white text-xs font-bold">✓</span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    
                    {/* Loading indicator */}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center p-3 sm:p-4">
                        <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
                        <span className="ml-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">Chargement...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Navigation Arrows - Below the carousel (Mobile only) */}
                {allGamesList && allGamesList.length > 1 && (
                  <div className="flex sm:hidden justify-center space-x-3 sm:space-x-4 mt-4 sm:mt-6">
                    <button
                      type="button"
                      onClick={goToPreviousGame}
                      disabled={actualCurrentGameIndex === 0}
                      className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-bold transition-all duration-200 ${
                        actualCurrentGameIndex === 0
                          ? 'bg-gray-100 dark:bg-[rgb(40,40,40)] text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-primary-600 dark:bg-accent-dark-600 text-white hover:bg-primary-700 dark:hover:bg-accent-dark-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      ← Précédent
                    </button>
                    <button
                      type="button"
                      onClick={goToNextGame}
                      disabled={actualCurrentGameIndex === allGamesList.length - 1 || actualCurrentGameIndex === -1}
                      className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-bold transition-all duration-200 ${
                        actualCurrentGameIndex === allGamesList.length - 1 || actualCurrentGameIndex === -1
                          ? 'bg-gray-100 dark:bg-[rgb(40,40,40)] text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-primary-600 dark:bg-accent-dark-600 text-white hover:bg-primary-700 dark:hover:bg-accent-dark-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      Suivant →
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-5 transition-all duration-500 ease-in-out">
              {error && (
                <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm sm:text-base">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-2 sm:p-3 bg-primary-100 dark:bg-accent-dark-900/30 text-primary-700 dark:text-accent-dark-300 rounded-md flex items-center text-sm sm:text-base">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Pari validé avec succès !
                </div>
              )}

              {/* Combined Game Display + Score Input Section */}
              <div className={`bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-700 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border shadow-md relative ${
                existingBet ? 'border-blue-500 dark:border-accent-dark-500 border-2' : 'border-primary-200 dark:border-gray-600'
              }`}>
                {/* Checkmark indicator when bet is placed */}
                {existingBet && (
                  <div className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 dark:bg-accent-dark-600 rounded-full flex items-center justify-center shadow-lg z-10">
                    <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="text-center mb-1.5 sm:mb-2 md:mb-3">
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Entrez votre pronostic</h3>
                  
                  {/* Date/Time Display - Top Center */}
                  <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-1.5 sm:mb-2 md:mb-3">
                    <div className="flex items-center space-x-1 sm:space-x-2 bg-white dark:bg-[rgb(38,38,38)] rounded-md sm:rounded-lg px-2 sm:px-3 md:px-4 py-1 sm:py-2 shadow-md border border-gray-200 dark:border-gray-600">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
                        {new Date(game.date).toLocaleDateString('fr-FR', { 
                          day: '2-digit', 
                          month: '2-digit',
                          year: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 bg-white dark:bg-[rgb(38,38,38)] rounded-md sm:rounded-lg px-2 sm:px-3 md:px-4 py-1 sm:py-2 shadow-md border border-gray-200 dark:border-gray-600">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200">
                        {new Date(game.date).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Game Display */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-2 sm:p-3 md:p-4 mb-2 sm:mb-3 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <div className="flex items-stretch justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-1 min-h-[50px] sm:min-h-[60px] md:min-h-[70px]">
                      {game.homeTeam.logo && (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-white dark:bg-white dark:p-1 sm:dark:p-1.5 md:dark:p-2 p-1 sm:p-1.5 md:p-2 shadow-md border border-gray-100 dark:border-gray-600 flex-shrink-0 self-center">
                          <img
                            src={game.homeTeam.logo}
                            alt={game.homeTeam.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words leading-tight min-h-[2em] flex items-center">{game.homeTeam.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide mt-1">Domicile</div>
                      </div>
                    </div>
                    
                    <div className="mx-2 sm:mx-4 md:mx-6 text-center flex-shrink-0 self-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-blue-100 dark:bg-accent-dark-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-blue-700 dark:text-white text-sm sm:text-base md:text-lg lg:text-xl font-bold">VS</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-1 justify-end min-h-[60px] sm:min-h-[70px] md:min-h-[80px]">
                      <div className="text-right min-w-0 flex-1 flex flex-col justify-center">
                        <div className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words leading-tight min-h-[2em] flex items-center justify-end">{game.awayTeam.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide mt-1">Extérieur</div>
                      </div>
                      {game.awayTeam.logo && (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-white dark:bg-white dark:p-1 sm:dark:p-1.5 md:dark:p-2 p-1 sm:p-1.5 md:p-2 shadow-md border border-gray-100 dark:border-gray-600 flex-shrink-0 self-center">
                          <img
                            src={game.awayTeam.logo}
                            alt={game.awayTeam.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Score Input */}
                {isLoadingBet ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Chargement des données...</span>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-lg p-2 sm:p-3 md:p-4 border border-gray-200 dark:border-gray-600 shadow-md">
                    <div className="flex items-stretch justify-between space-x-2 sm:space-x-4 md:space-x-6">
                      {/* Home Score */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex gap-1 sm:gap-2 items-stretch flex-1">
                          <div className="flex-1 flex flex-col">
                            <label htmlFor="homeScore" className="hidden sm:block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-center break-words leading-tight min-h-[2em] flex items-center justify-center">
                              {game.homeTeam.name}
                            </label>
                            <input
                              type="number"
                              id="homeScore"
                              min="0"
                              max="99"
                              value={homeScore}
                              onChange={(e) => setHomeScore(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-gray-100 shadow-sm focus:border-primary-500 dark:focus:border-accent-dark-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-accent-dark-500/20 text-center text-lg sm:text-xl md:text-2xl font-bold py-1.5 sm:py-2 md:py-3 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0"
                              required
                            />
                          </div>
                          <div className="relative flex-shrink-0 flex flex-col justify-end">
                            <select
                              id="homeScoreDropdown"
                              value=""
                              onChange={(e) => setHomeScore(e.target.value)}
                              className="w-12 sm:w-16 md:w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-gray-100 focus:border-primary-500 dark:focus:border-accent-dark-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-accent-dark-500/20 cursor-pointer appearance-none text-xs sm:text-sm"
                              title="Sélectionner un score"
                              style={{ 
                                paddingTop: '0.375rem', 
                                paddingBottom: '0.375rem',
                                height: '100%'
                              }}
                            >
                              <option value=""></option>
                              {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <ChevronDownIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-500 dark:text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400 dark:text-gray-500 px-2 sm:px-3 md:px-4 self-end pb-1.5 sm:pb-2 md:pb-3">-</div>
                      
                      {/* Away Score */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex gap-1 sm:gap-2 items-stretch flex-1">
                          <div className="flex-1 flex flex-col">
                            <label htmlFor="awayScore" className="hidden sm:block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-center break-words leading-tight min-h-[2em] flex items-center justify-center">
                              {game.awayTeam.name}
                            </label>
                            <input
                              type="number"
                              id="awayScore"
                              min="0"
                              max="99"
                              value={awayScore}
                              onChange={(e) => setAwayScore(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-gray-100 shadow-sm focus:border-primary-500 dark:focus:border-accent-dark-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-accent-dark-500/20 text-center text-lg sm:text-xl md:text-2xl font-bold py-1.5 sm:py-2 md:py-3 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0"
                              required
                            />
                          </div>
                          <div className="relative flex-shrink-0 flex flex-col justify-end">
                            <select
                              id="awayScoreDropdown"
                              value=""
                              onChange={(e) => setAwayScore(e.target.value)}
                              className="w-12 sm:w-16 md:w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-gray-100 focus:border-primary-500 dark:focus:border-accent-dark-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-accent-dark-500/20 cursor-pointer appearance-none text-xs sm:text-sm"
                              title="Sélectionner un score"
                              style={{ 
                                paddingTop: '0.375rem', 
                                paddingBottom: '0.375rem',
                                height: '100%'
                              }}
                            >
                              <option value=""></option>
                              {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={i}>
                                  {i}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <ChevronDownIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-500 dark:text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons - Outside the betting box */}
              <div className="mt-3 sm:mt-4 md:mt-5">
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 md:space-x-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 dark:from-accent-dark-600 dark:to-accent-dark-700 border-2 border-primary-600 dark:border-accent-dark-600 rounded-lg sm:rounded-xl hover:from-primary-700 hover:to-primary-800 dark:hover:from-accent-dark-700 dark:hover:to-accent-dark-700 hover:border-primary-700 dark:hover:border-accent-dark-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-300 dark:focus:ring-accent-dark-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2 sm:mr-3"></div>
                        <span className="text-sm sm:text-base md:text-lg font-bold">
                          {existingBet ? t('betting.updatingBet') : t('betting.placingBet')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-base sm:text-lg md:text-xl font-black">
                          {existingBet ? t('betting.updateBet') : t('betting.placeBet')}
                        </span>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Go back to previous page, or fallback to dashboard if no history
                      if (window.history.length > 1) {
                        router.back();
                      } else {
                        router.push('/dashboard');
                      }
                    }}
                    className="px-6 sm:px-8 py-3 sm:py-3.5 md:py-4 text-base sm:text-lg font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-[rgb(38,38,38)] border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl hover:bg-gray-50 dark:hover:bg-[rgb(40,40,40)] hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 dark:focus:ring-gray-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {t('betting.cancel')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const gameId = context.params?.id as string;
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      }
    });

    if (!game) {
      return {
        notFound: true
      };
    }

    // Check if betting is allowed for this game
    // Game must be UPCOMING and not in the past
    const now = new Date();
    const gameDate = new Date(game.date);
    if (game.status !== 'UPCOMING' || gameDate < now) {
      return {
        redirect: {
          destination: '/competitions',
          permanent: false,
        },
      };
    }

    // Get user ID to filter by user's competitions (same logic as dashboard API)
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      select: { id: true }
    });

    if (!user) {
      return {
        notFound: true
      };
    }

    // Get user's competition participation via CompetitionUser table (same as dashboard API)
    const userCompetitions = await prisma.competitionUser.findMany({
      where: { userId: user.id },
      select: { competitionId: true }
    });
    const userCompetitionIds = userCompetitions.map(cu => cu.competitionId);

    if (userCompetitionIds.length === 0) {
      return {
        notFound: true
      };
    }

    // Get active competitions that the user is part of (same logic as dashboard API)
    const activeCompetitions = await prisma.competition.findMany({
      where: {
        id: {
          in: userCompetitionIds
        },
        status: { 
          in: ['ACTIVE', 'active', 'UPCOMING', 'upcoming'] 
        },
      },
      select: { id: true }
    });

    // Use same date filter as dashboard API: tomorrow onwards (to match "Matchs à venir" section)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    // Check if current game is from today (might be in "Matchs du jour" instead of "Matchs à venir")
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isCurrentGameToday = gameDate >= startOfDay && gameDate < endOfDay;

    // Fetch games using the same logic as dashboard API
    // Get ALL games from user's active competitions, sorted by date
    // Only include UPCOMING games from tomorrow onwards (same as dashboard "Matchs à venir")
    // But also include the current game if it's from today (so it appears in carousel)
    const allGamesQuery = await prisma.game.findMany({
      where: {
        competitionId: {
          in: activeCompetitions.map(comp => comp.id)
        },
        status: 'UPCOMING', // Only UPCOMING games (same as dashboard API)
        OR: [
          {
            date: {
              gte: endOfDay // Tomorrow onwards (same as dashboard "Matchs à venir")
            }
          },
          ...(isCurrentGameToday ? [{
            id: gameId // Include current game if it's from today
          }] : [])
        ]
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        competition: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        bets: {
          where: {
            userId: session.user?.id || ''
          },
          select: {
            id: true,
            score1: true,
            score2: true
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { id: 'asc' } // Secondary sort by ID for stability (matches dashboard sorting)
      ]
    });

    // Find the current game index
    const currentGameIndex = allGamesQuery.findIndex(g => g.id === gameId);
    
    // Get 20 games before and 20 games after the current game
    const startIndex = Math.max(0, currentGameIndex - 20);
    const endIndex = Math.min(allGamesQuery.length, currentGameIndex + 21); // +21 to include current game
    
    const allGames = allGamesQuery.slice(startIndex, endIndex);

    // Find current game index in the sliced array
    const slicedCurrentGameIndex = allGames.findIndex(g => g.id === gameId);

    console.log('🎯 GETSERVERPROPS LOG:');
    console.log('📊 Total games found:', allGames.length);
    console.log('📅 Games details:', allGames.map(g => ({
      id: g.id,
      homeTeam: g.homeTeam.name,
      awayTeam: g.awayTeam.name,
      date: g.date,
      status: g.status
    })));

    return {
      props: {
        game: JSON.parse(JSON.stringify(game)),
        allGames: JSON.parse(JSON.stringify(allGames)),
        currentGameIndex: slicedCurrentGameIndex,
        ...(await serverSideTranslations('fr', ['common']))
      }
    };
  } catch (error) {
    console.error('Error fetching game:', error);
    return {
      notFound: true
    };
  }
}; 