import { useState, useEffect } from 'react';
import { TrophyIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../hooks/useTranslation';

interface Team {
  id: string;
  name: string;
  logo: string | null;
  shortName: string | null;
}

interface FinalWinnerPredictionWidgetProps {
  competitionId: string;
  competitionName: string;
  currentUserId: string;
}

export default function FinalWinnerPredictionWidget({
  competitionId,
  competitionName,
  currentUserId
}: FinalWinnerPredictionWidgetProps) {
  const { t } = useTranslation('common');
  const [prediction, setPrediction] = useState<Team | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [nextGame, setNextGame] = useState<{ id: string; date: string; homeTeam: string; awayTeam: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Only show for Champions League
  if (!competitionName.includes('Champions League')) {
    return null;
  }

  useEffect(() => {
    fetchPredictionData();
  }, [competitionId]);

  useEffect(() => {
    if (deadline && !deadlinePassed) {
      const interval = setInterval(() => {
        updateTimeRemaining();
      }, 1000);
      updateTimeRemaining();
      return () => clearInterval(interval);
    }
  }, [deadline, deadlinePassed]);

  const fetchPredictionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/competitions/${competitionId}/final-winner-prediction`);
      if (response.ok) {
        const data = await response.json();
        setPrediction(data.prediction);
        setAvailableTeams(data.availableTeams || []);
        setDeadline(data.deadline ? new Date(data.deadline) : null);
        setDeadlinePassed(data.deadlinePassed);
        setNextGame(data.nextGame);
        if (data.prediction) {
          setSelectedTeamId(data.prediction.id);
        }
      }
    } catch (error) {
      console.error('Error fetching prediction data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTimeRemaining = () => {
    if (!deadline) return;

    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) {
      setDeadlinePassed(true);
      setTimeRemaining('Délai dépassé');
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      setTimeRemaining(`${days}j ${hours}h ${minutes}m`);
    } else if (hours > 0) {
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    } else if (minutes > 0) {
      setTimeRemaining(`${minutes}m ${seconds}s`);
    } else {
      setTimeRemaining(`${seconds}s`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || deadlinePassed) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/competitions/${competitionId}/final-winner-prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teamId: selectedTeamId })
      });

      if (response.ok) {
        const data = await response.json();
        setPrediction(data.prediction);
        // Refresh the data
        await fetchPredictionData();
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la sauvegarde de votre prédiction');
      }
    } catch (error) {
      console.error('Error submitting prediction:', error);
      alert('Erreur lors de la sauvegarde de votre prédiction');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      {/* Header Section */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <TrophyIcon className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <span className="md:hidden">Vainqueur Final</span>
            <span className="hidden md:inline">Prédiction du Vainqueur Final</span>
          </h3>
          {deadline && !deadlinePassed && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <ClockIcon className="h-5 w-5" />
              <span className="font-medium">{timeRemaining}</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-6">

      {prediction && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
            Votre prédiction actuelle:
          </p>
          <div className="flex items-center space-x-3">
            {prediction.logo && (
              <img
                src={prediction.logo}
                alt={prediction.name}
                className="w-10 h-10 object-contain"
              />
            )}
            <span className="text-lg font-bold text-green-900 dark:text-green-200">
              {prediction.name}
            </span>
          </div>
        </div>
      )}

      {!deadlinePassed ? (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <select
              id="team-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-transparent"
              required
              disabled={submitting}
            >
              <option value="">-- Choisir une équipe --</option>
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!selectedTeamId || submitting || deadlinePassed}
            className="w-full px-3 py-1.5 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            {submitting ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </form>
      ) : (
        <div className="p-4 bg-gray-50 dark:bg-[rgb(40,40,40)] border border-gray-200 dark:border-gray-600 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {prediction
              ? `Le délai est dépassé. Votre prédiction (${prediction.name}) est maintenant verrouillée.`
              : 'Le délai est dépassé. Vous ne pouvez plus faire de prédiction.'}
          </p>
        </div>
      )}
      </div>
      {/* Footer Section */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-6 py-3">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 text-center">
          Prédisez le vainqueur final et gagnez <span className="text-primary-600 dark:text-accent-dark-400">5 points</span> bonus
        </p>
        {nextGame && (
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-1">
            Délai: jusqu'au début du prochain match ({nextGame.homeTeam} vs {nextGame.awayTeam})
          </p>
        )}
      </div>
    </div>
  );
}
