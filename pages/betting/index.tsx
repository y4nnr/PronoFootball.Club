import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

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
  homeScore?: number;
  awayScore?: number;
  competition: {
    id: string;
    name: string;
  };
}

export default function BettingPage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/games');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setGames(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load games');
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Place Your Bets</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-4 border-b border-gray-200">
                <div className="text-sm text-gray-500 mb-2">
                  {new Date(game.date).toLocaleDateString('fr-FR')} - {game.competition.name}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{game.homeTeam.name}</span>
                    {game.homeTeam.logo && (
                      <img
                        src={game.homeTeam.logo}
                        alt={game.homeTeam.name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                  </div>
                  <div className="text-gray-500">vs</div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{game.awayTeam.name}</span>
                    {game.awayTeam.logo && (
                      <img
                        src={game.awayTeam.logo}
                        alt={game.awayTeam.name}
                        className="w-8 h-8 object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    game.status === 'UPCOMING' ? 'bg-green-100 text-green-800' :
                    game.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {game.status}
                  </span>
                  <button
                    onClick={() => router.push(`/betting/${game.id}`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Place Bet
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 