import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

interface User {
  id: string;
  name: string;
  profilePictureUrl?: string;
  totalPoints: number;
  exactScores: number;
  correctResults: number;
}

interface Competition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function LeaderboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const language = router.locale === 'fr' ? 'fr' : 'en';
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [rankings, setRankings] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const translations = {
    fr: {
      title: 'Classement',
      selectCompetition: 'Sélectionner une compétition',
      ongoing: 'En cours',
      finished: 'Terminée',
      rank: 'Rang',
      user: 'Utilisateur',
      points: 'Points',
      exactScores: 'Scores exacts',
      correctResults: 'Résultats corrects',
      loading: 'Chargement...',
      error: 'Erreur',
      noData: 'Aucune donnée disponible',
      currentCompetition: 'Compétition en cours',
      previousCompetitions: 'Compétitions précédentes'
    },
    en: {
      title: 'Leaderboard',
      selectCompetition: 'Select a competition',
      ongoing: 'Ongoing',
      finished: 'Finished',
      rank: 'Rank',
      user: 'User',
      points: 'Points',
      exactScores: 'Exact scores',
      correctResults: 'Correct results',
      loading: 'Loading...',
      error: 'Error',
      noData: 'No data available',
      currentCompetition: 'Current competition',
      previousCompetitions: 'Previous competitions'
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const res = await fetch('/api/competitions');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load competitions');
        
        setCompetitions(data);
        // Select the active competition by default
        const activeCompetition = data.find((c: Competition) => c.isActive);
        if (activeCompetition) {
          setSelectedCompetition(activeCompetition.id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load competitions');
      }
    };

    if (status === 'authenticated') {
      fetchCompetitions();
    }
  }, [status]);

  useEffect(() => {
    const fetchRankings = async () => {
      if (!selectedCompetition) return;
      
      try {
        setLoading(true);
        const res = await fetch(`/api/rankings?competitionId=${selectedCompetition}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load rankings');
        
        setRankings(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load rankings');
      } finally {
        setLoading(false);
      }
    };

    if (selectedCompetition) {
      fetchRankings();
    }
  }, [selectedCompetition]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-800">{translations[language].loading}</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{translations[language].error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-white">{translations[language].title}</h1>

      {/* Competition Selector */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {translations[language].selectCompetition}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {competitions.map(competition => (
            <button
              key={competition.id}
              onClick={() => setSelectedCompetition(competition.id)}
              className={`p-4 rounded-lg text-left transition-colors ${
                selectedCompetition === competition.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{competition.name}</span>
                <span className={`text-sm px-2 py-1 rounded ${
                  competition.isActive
                    ? 'bg-green-900 text-green-200'
                    : 'bg-gray-700 text-gray-300'
                }`}>
                  {competition.isActive ? translations[language].ongoing : translations[language].finished}
                </span>
              </div>
              <div className="text-sm mt-1">
                {new Date(competition.startDate).toLocaleDateString('fr-FR')} - {new Date(competition.endDate).toLocaleDateString('fr-FR')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Rankings Table */}
      {rankings.length > 0 ? (
        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {translations[language].rank}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {translations[language].user}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {translations[language].points}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {translations[language].exactScores}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {translations[language].correctResults}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {rankings.map((user, index) => (
                  <tr key={user.id} className={user.id === session?.user?.id ? 'bg-blue-900/30' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.profilePictureUrl ? (
                          <img
                            src={user.profilePictureUrl}
                            alt={user.name}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-300 text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="ml-3 text-sm font-medium text-white">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {user.totalPoints}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {user.exactScores}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {user.correctResults}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          {translations[language].noData}
        </div>
      )}
    </div>
  );
} 