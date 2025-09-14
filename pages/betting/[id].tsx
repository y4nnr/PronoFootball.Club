import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
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

  // Navigation functions
  const goToPreviousGame = useCallback(() => {
    if (allGames && currentGameIndex > 0) {
      const previousGame = allGames[currentGameIndex - 1];
      router.push(`/betting/${previousGame.id}`);
    }
  }, [currentGameIndex, allGames, router]);

  const goToNextGame = useCallback(() => {
    if (allGames && currentGameIndex < allGames.length - 1) {
      const nextGame = allGames[currentGameIndex + 1];
      router.push(`/betting/${nextGame.id}`);
    }
  }, [currentGameIndex, allGames, router]);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {t('betting.placeYourBet')}
              </h1>
              <p className="text-gray-500">
                {game.competition.name} - {new Date(game.date).toLocaleDateString('fr-FR')}
              </p>
            </div>

            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                {game.homeTeam.logo && (
                  <img
                    src={game.homeTeam.logo}
                    alt={game.homeTeam.name}
                    className="w-12 h-12 object-contain"
                  />
                )}
                <span className="text-lg font-medium">{game.homeTeam.name}</span>
              </div>
              <div className="text-gray-500">{t('betting.vs')}</div>
              <div className="flex items-center space-x-4">
                <span className="text-lg font-medium">{game.awayTeam.name}</span>
                {game.awayTeam.logo && (
                  <img
                    src={game.awayTeam.logo}
                    alt={game.awayTeam.name}
                    className="w-12 h-12 object-contain"
                  />
                )}
              </div>
            </div>

            {/* Game Navigation Carousel */}
            {allGames && allGames.length > 1 && (
              <div className="mb-6">
                {/* Navigation Controls */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={goToPreviousGame}
                    disabled={currentGameIndex === 0}
                    className={`flex items-center px-3 py-2 rounded-md border text-sm transition-colors ${
                      currentGameIndex === 0
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Précédent
                  </button>
                  
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 font-medium">
                      {currentGameIndex + 1} / {allGames.length}
                    </span>
                    <div className="flex space-x-1">
                      {allGames.slice(0, 12).map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full ${
                            index === currentGameIndex ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                      {allGames.length > 12 && (
                        <span className="text-xs text-gray-400 ml-1">...</span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={goToNextGame}
                    disabled={currentGameIndex === allGames.length - 1}
                    className={`flex items-center px-3 py-2 rounded-md border text-sm transition-colors ${
                      currentGameIndex === allGames.length - 1
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400'
                    }`}
                  >
                    Suivant
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* Quick Game Preview List */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2 text-center">
                    Prochains 12 matchs disponibles
                    <span className="block text-[10px] mt-1 opacity-75">
                      Utilisez ← → ou cliquez pour naviguer
                    </span>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto pb-1">
                    {allGames.map((gameItem, index) => (
                      <button
                        key={gameItem.id}
                        onClick={() => router.push(`/betting/${gameItem.id}`)}
                        className={`flex-shrink-0 px-2 py-2 rounded-md text-xs transition-colors min-w-[100px] ${
                          index === currentGameIndex
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-medium truncate text-[10px] leading-tight">
                            {gameItem.homeTeam.name.length > 8 
                              ? gameItem.homeTeam.name.substring(0, 8) + '...' 
                              : gameItem.homeTeam.name
                            } vs {gameItem.awayTeam.name.length > 8 
                              ? gameItem.awayTeam.name.substring(0, 8) + '...' 
                              : gameItem.awayTeam.name
                            }
                          </div>
                          <div className="text-[9px] opacity-75 mt-1">
                            {new Date(gameItem.date).toLocaleDateString('fr-FR', { 
                              day: '2-digit', 
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-100 text-green-700 rounded-md flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Pari validé avec succès !
                </div>
              )}

              {/* Score Input Section with Clear Border */}
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="text-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">Entrez votre pronostic</h3>
                  <p className="text-sm text-gray-600">Prédisez le score final du match</p>
                </div>
                
                {isLoadingBet ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Chargement des données...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between space-x-4">
                    <div className="flex-1">
                      <label htmlFor="homeScore" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('betting.homeScore', { team: game.homeTeam.name })}
                      </label>
                      <input
                        type="number"
                        id="homeScore"
                        min="0"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center text-lg font-semibold"
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="text-2xl font-bold text-gray-500 mx-2">-</div>
                    <div className="flex-1">
                      <label htmlFor="awayScore" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('betting.awayScore', { team: game.awayTeam.name })}
                      </label>
                      <input
                        type="number"
                        id="awayScore"
                        min="0"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center text-lg font-semibold"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => router.push(`/competitions/${game.competition.id}`)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('betting.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? 
                    (existingBet ? t('betting.updatingBet') : t('betting.placingBet')) : 
                    (existingBet ? t('betting.updateBet') : t('betting.placeBet'))
                  }
                </button>
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

    // Fetch the 12 closest upcoming games for betting from the same competition, sorted by date
    const allGames = await prisma.game.findMany({
      where: {
        competitionId: game.competition.id,
        status: 'UPCOMING',
        date: {
          gte: new Date() // Only future games
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
      },
      take: 12 // Limit to 12 closest games
    });

    // Find current game index
    const currentGameIndex = allGames.findIndex(g => g.id === gameId);

    return {
      props: {
        game: JSON.parse(JSON.stringify(game)),
        allGames: JSON.parse(JSON.stringify(allGames)),
        currentGameIndex,
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