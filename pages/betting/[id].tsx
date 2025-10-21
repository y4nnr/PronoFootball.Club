import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { prisma } from '@lib/prisma';
import { useTranslation } from '../../hooks/useTranslation';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

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

  // Debug logging
  console.log('🎯 FRONTEND LOG - Initial allGames:', allGames.length);
  console.log('🎯 FRONTEND LOG - Initial allGamesList:', allGamesList.length);
  console.log('🎯 FRONTEND LOG - Current game ID:', game.id);
  console.log('🎯 FRONTEND LOG - Current game index:', currentGameIndex);

  // CRITICAL FIX: Sync allGamesList from SSR list on route change (no merge), keep deterministic order
  useEffect(() => {
    const sorted = [...allGames].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setAllGamesList(sorted);
  }, [allGames, game.id]);

  // (moved) re-center effect declared after scrollToSelectedGame

  // CRITICAL FIX: Ensure currentGameIndex is always correct
  const actualCurrentGameIndex = allGamesList.findIndex(g => g.id === game.id);
  console.log('🎯 ACTUAL CURRENT GAME INDEX:', actualCurrentGameIndex, 'vs PROPS:', currentGameIndex);

  // Function to load more games
  const MAX_CAROUSEL_GAMES = 24;

  const loadMoreGames = useCallback(async () => {
    if (isLoadingMore || !hasMoreGames) return;
    // Hard cap: do not load beyond MAX_CAROUSEL_GAMES
    if (allGamesList.length >= MAX_CAROUSEL_GAMES) {
      setHasMoreGames(false);
      return;
    }
    
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/user/dashboard-betting-games?page=${currentPage + 1}&limit=12`);
      const data = await response.json();
      
      if (data.games && data.games.length > 0) {
        setAllGamesList(prev => {
          // Merge, de-duplicate by id, then sort by date asc to match competition page order
          const merged = [...prev, ...data.games];
          const uniqueById = Array.from(new Map(merged.map(g => [g.id, g])).values());
          uniqueById.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          // Enforce MAX_CAROUSEL_GAMES cap
          const limited = uniqueById.slice(0, MAX_CAROUSEL_GAMES);
          return limited;
        });
        setCurrentPage(prev => prev + 1);
        // Update hasMore based on cap and API
        setHasMoreGames(data.hasMore && (allGamesList.length + data.games.length) < MAX_CAROUSEL_GAMES);
      } else {
        setHasMoreGames(false);
      }
    } catch (error) {
      console.error('Error loading more games:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, hasMoreGames, isLoadingMore, allGamesList.length]);

  // Navigation functions
  const goToPreviousGame = useCallback(() => {
    // Use calculated index to avoid mismatch after sorting
    const idx = allGamesList.findIndex(g => g.id === game.id);
    if (allGamesList && idx > 0) {
      const previousGame = allGamesList[idx - 1];
      router.push(`/betting/${previousGame.id}`);
    }
  }, [allGamesList, router, game.id]);

  const goToNextGame = useCallback(() => {
    // Use calculated index to avoid mismatch after sorting
    const idx = allGamesList.findIndex(g => g.id === game.id);
    if (allGamesList && idx > -1 && idx < allGamesList.length - 1) {
      const nextGame = allGamesList[idx + 1];
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

  // Scroll to center the selected game
  const scrollToSelectedGame = useCallback(() => {
    const carousel = document.getElementById('games-carousel');
    if (!carousel) return;
    
    // Use the calculated index for stability after re-sorts
    const indexToUse = allGamesList.findIndex(g => g.id === game.id);
    const gameCard = carousel.children[indexToUse] as HTMLElement;
    if (!gameCard) return;
    
    const carouselRect = carousel.getBoundingClientRect();
    const gameRect = gameCard.getBoundingClientRect();
    const scrollLeft = carousel.scrollLeft + (gameRect.left - carouselRect.left) - (carouselRect.width / 2) + (gameRect.width / 2);
    
    carousel.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
  }, [allGamesList, game.id]);

  // Auto-scroll to selected game when it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToSelectedGame();
    }, 100); // Small delay to ensure DOM is updated
    
    return () => clearTimeout(timer);
  }, [allGamesList, game.id, scrollToSelectedGame]);

  // Re-center after list updates that include the current game (declared after scrollToSelectedGame)
  useEffect(() => {
    if (!allGamesList || allGamesList.length === 0) return;
    const hasCurrent = allGamesList.some(g => g.id === game.id);
    if (!hasCurrent) return;
    const timer = setTimeout(() => {
      scrollToSelectedGame();
    }, 50);
    return () => clearTimeout(timer);
  }, [allGamesList, game.id, scrollToSelectedGame]);

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
    const fetchExistingBet = async () => {
      // Reset form state first
      setHomeScore('');
      setAwayScore('');
      setExistingBet(null);
      setError('');
      setSuccess(false);
      setIsLoadingBet(true);
      
      try {
        const response = await fetch(`/api/bets/${game.id}`);
        const data = await response.json();
        if (response.ok && data) {
          setExistingBet(data);
          setHomeScore(data.score1.toString());
          setAwayScore(data.score2.toString());
        }
      } catch (err) {
        console.error('Error fetching existing bet:', err);
      } finally {
        setIsLoadingBet(false);
      }
    };

    fetchExistingBet();
  }, [game.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (allGames && allGames.length > 1) {
        if (event.key === 'ArrowLeft' && currentGameIndex > 0) {
          goToPreviousGame();
        } else if (event.key === 'ArrowRight' && currentGameIndex < allGames.length - 1) {
          goToNextGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGameIndex, allGames, goToPreviousGame, goToNextGame]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/bets', {
        method: existingBet ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          score1: parseInt(homeScore),
          score2: parseInt(awayScore)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Update existing bet state to reflect the new bet
      setExistingBet({ score1: parseInt(homeScore), score2: parseInt(awayScore) });
      
      // Update the game card in the carousel to show the bet
      setAllGamesList(prevGames => 
        prevGames.map(gameItem => 
          gameItem.id === game.id 
            ? {
                ...gameItem,
                bets: [{ 
                  id: data.id || 'temp-id', 
                  score1: parseInt(homeScore), 
                  score2: parseInt(awayScore) 
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Modern Status Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center space-x-4">
                   <div className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${
                     game.status === 'UPCOMING' 
                       ? 'bg-orange-100 text-orange-800 border-orange-300' 
                       : game.status === 'LIVE' 
                       ? 'bg-red-100 text-red-800 border-red-300 animate-pulse' 
                       : 'bg-gray-100 text-gray-800 border-gray-300'
                   }`}>
                     {game.status === 'UPCOMING' ? '⏰ À venir' : game.status === 'LIVE' ? '🔴 En direct' : '✅ Terminé'}
                   </div>
                 </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Compétition</div>
              <div className="text-xl font-bold text-gray-900">{game.competition.name}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden">
          <div className="p-8">

            {/* Game Navigation */}
            {allGamesList && allGamesList.length > 1 && (
              <div className="mb-6">
                {/* Game Carousel Container */}
                <div className="relative bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200 shadow-md w-full group min-h-[200px]">
                  {/* Mobile: Show 1-2 games, Desktop: Show 4-5 games */}
                  {/* Left Arrow */}
                  <button
                    onClick={() => scrollCarousel('left')}
                    disabled={!canScrollLeft}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
                      canScrollLeft 
                        ? 'opacity-100 hover:scale-110' 
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Right Arrow */}
                  <button
                    onClick={() => scrollCarousel('right')}
                    disabled={!canScrollRight}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
                      canScrollRight 
                        ? 'opacity-100 hover:scale-110' 
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Carousel Content */}
                  <div 
                    id="games-carousel"
                    className="flex space-x-3 sm:space-x-4 overflow-x-auto pb-4 scroll-smooth px-2 py-4" 
                    style={{ 
                      scrollbarWidth: 'none', 
                      msOverflowStyle: 'none',
                      scrollSnapType: 'x mandatory'
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
                          router.push(`/betting/${gameItem.id}`);
                        } else {
                          console.log('🎯 Same game clicked, no navigation needed');
                        }
                      };

                      return (
                        <button
                          key={gameItem.id}
                          onClick={handleGameClick}
                          className={`relative p-3 sm:p-4 rounded-xl transition-all duration-300 flex-shrink-0 w-[140px] sm:w-[180px] min-w-[140px] sm:min-w-[180px] scroll-snap-start my-2 ${
                            index === actualCurrentGameIndex
                              ? gameItem.bets && gameItem.bets.length > 0
                                ? 'bg-white text-gray-700 border-4 border-blue-500 shadow-2xl transform scale-105 z-10'
                                : 'bg-white text-gray-700 border-4 border-gray-400 shadow-2xl transform scale-105 z-10'
                              : gameItem.bets && gameItem.bets.length > 0
                                ? 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-blue-400 hover:border-blue-500 shadow-lg hover:shadow-xl hover:scale-102'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-300 hover:border-gray-400 shadow-lg hover:shadow-xl hover:scale-102'
                          }`}
                        >
                        {/* Bet Status Indicator */}
                        {gameItem.bets && gameItem.bets.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        
                        <div className="text-center">
                          <div className="font-semibold text-xs sm:text-sm mb-1 truncate text-gray-900">
                            {gameItem.homeTeam.name}
                          </div>
                          <div className="text-xs mb-1 font-medium text-gray-500">VS</div>
                          <div className="font-semibold text-xs sm:text-sm mb-2 truncate text-gray-900">
                            {gameItem.awayTeam.name}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-center space-x-1 text-gray-600">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm font-medium">{new Date(gameItem.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                            <div className="flex items-center justify-center space-x-1 text-gray-600">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm font-medium">{new Date(gameItem.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          
                          {gameItem.bets && gameItem.bets.length > 0 && (
                            <div className="mt-2 p-1 sm:p-1.5 rounded bg-blue-100">
                              <div className="text-xs font-semibold text-blue-700">
                                {gameItem.bets[0].score1}-{gameItem.bets[0].score2}
                              </div>
                            </div>
                          )}
                        </div>
                        
                          {index === actualCurrentGameIndex && (
                            <div className="absolute -top-1 -right-1">
                              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-400 rounded-full flex items-center justify-center shadow-lg">
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
                        <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-primary-600"></div>
                        <span className="ml-2 text-xs sm:text-sm text-gray-600">Chargement...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Navigation Arrows - Below the carousel (Mobile only) */}
                {allGamesList && allGamesList.length > 1 && (
                  <div className="flex sm:hidden justify-center space-x-4 mt-6">
                    <button
                      type="button"
                      onClick={goToPreviousGame}
                      disabled={currentGameIndex === 0}
                      className={`px-6 py-3 rounded-xl text-base font-bold transition-all duration-200 ${
                        currentGameIndex === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      ← Précédent
                    </button>
                    <button
                      type="button"
                      onClick={goToNextGame}
                      disabled={currentGameIndex === allGamesList.length - 1}
                      className={`px-6 py-3 rounded-xl text-base font-bold transition-all duration-200 ${
                        currentGameIndex === allGamesList.length - 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      Suivant →
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 transition-all duration-500 ease-in-out">
              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-primary-100 text-primary-700 rounded-md flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Pari validé avec succès !
                </div>
              )}

              {/* Combined Game Display + Score Input Section */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200 shadow-md">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Entrez votre pronostic</h3>
                  
                  {/* Date/Time Display - Top Center */}
                  <div className="flex items-center justify-center space-x-4 mb-6">
                    <div className="flex items-center space-x-2 bg-white rounded-lg px-4 py-2 shadow-md border border-gray-200">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-600">
                        {new Date(game.date).toLocaleDateString('fr-FR', { 
                          day: '2-digit', 
                          month: '2-digit',
                          year: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 bg-white rounded-lg px-4 py-2 shadow-md border border-gray-200">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-bold text-gray-800">
                        {new Date(game.date).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Game Display */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-6 mb-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {game.homeTeam.logo && (
                        <div className="w-16 h-16 rounded-full bg-white p-2 shadow-md border border-gray-100">
                          <img
                            src={game.homeTeam.logo}
                            alt={game.homeTeam.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{game.homeTeam.name}</div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Domicile</div>
                      </div>
                    </div>
                    
                    <div className="mx-6 text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-blue-700 text-xl font-bold">VS</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 flex-1 justify-end">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{game.awayTeam.name}</div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Extérieur</div>
                      </div>
                      {game.awayTeam.logo && (
                        <div className="w-16 h-16 rounded-full bg-white p-2 shadow-md border border-gray-100">
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600">Chargement des données...</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-md">
                    <div className="flex items-center justify-between space-x-6">
                      <div className="flex-1">
                        <input
                          type="number"
                          id="homeScore"
                          min="0"
                          value={homeScore}
                          onChange={(e) => setHomeScore(e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 text-center text-2xl font-bold py-4 transition-all duration-200"
                          placeholder="0"
                          required
                        />
                      </div>
                      
                      <div className="text-2xl font-bold text-gray-400 px-4">-</div>
                      
                      <div className="flex-1">
                        <input
                          type="number"
                          id="awayScore"
                          min="0"
                          value={awayScore}
                          onChange={(e) => setAwayScore(e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 text-center text-2xl font-bold py-4 transition-all duration-200"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons - Outside the betting box */}
              <div className="mt-8">
                <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <button
                    type="button"
                    onClick={() => router.push(`/competitions/${game.competition.id}`)}
                    className="px-8 py-4 text-lg font-bold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {t('betting.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-4 text-lg font-bold text-white bg-gradient-to-r from-primary-600 to-primary-700 border-2 border-primary-600 rounded-xl hover:from-primary-700 hover:to-primary-800 hover:border-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        <span className="text-lg font-bold">
                          {existingBet ? t('betting.updatingBet') : t('betting.placingBet')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span className="text-xl font-black">
                          {existingBet ? t('betting.updateBet') : t('betting.placeBet')}
                        </span>
                      </div>
                    )}
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
            name: true
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
    if (game.status !== 'UPCOMING') {
      return {
        redirect: {
          destination: '/competitions',
          permanent: false,
        },
      };
    }

    // Get active competitions (same logic as API)
    const activeCompetitions = await prisma.competition.findMany({
      where: {
        status: { 
          in: ['ACTIVE', 'active', 'UPCOMING', 'upcoming'] 
        },
      },
      select: { id: true }
    });

    // Fetch the closest upcoming games for betting from all active competitions, sorted by date
    // Get ALL games from active competitions, sorted by date
    const allGamesQuery = await prisma.game.findMany({
      where: {
        competitionId: {
          in: activeCompetitions.map(comp => comp.id)
        },
        status: {
          in: ['UPCOMING', 'LIVE'] // Include both upcoming and live games
        }
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
            name: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
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