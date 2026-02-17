import { useState, useEffect } from 'react';
import { TrophyIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
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
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [nextGame, setNextGame] = useState<{ id: string; date: string; homeTeam: string; awayTeam: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Only show for Champions League
  if (!competitionName.includes('Champions League')) {
    return null;
  }

  useEffect(() => {
    fetchPredictionData();
  }, [competitionId]);

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
        setSelectionLocked(!!data.selectionLocked);
        setNextGame(data.nextGame);
        if (data.prediction) {
          setSelectedTeamId(data.prediction.id);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[FinalWinnerPredictionWidget] API error:', response.status, errorData);
      }
    } catch (error) {
      console.error('[FinalWinnerPredictionWidget] Error fetching prediction data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || deadlinePassed || selectionLocked) return;

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
        <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <TrophyIcon className="h-6 w-6 text-white" />
            </div>
            <span className="md:hidden">Vainqueur Final</span>
            <span className="hidden md:inline">Prédiction du Vainqueur Final</span>
          </h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <TrophyIcon className="h-6 w-6 text-white" />
          </div>
          <span className="md:hidden">Vainqueur Final</span>
          <span className="hidden md:inline">Prédiction du Vainqueur Final</span>
        </h3>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-5">
        {/* Current Prediction */}
        {prediction && (
          <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            {prediction.logo && (
              <img
                src={prediction.logo}
                alt={prediction.name}
                className="w-10 h-10 object-contain flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
                Prédiction enregistrée
              </p>
              <p className="text-base font-bold text-green-900 dark:text-green-200 truncate">
                {prediction.name}
              </p>
            </div>
          </div>
        )}

        {/* Form or read-only when locked */}
        {selectionLocked || deadlinePassed ? (
          <div className="p-4 bg-gray-50 dark:bg-[rgb(40,40,40)] border border-gray-200 dark:border-gray-600 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {prediction ? (
                <>La sélection est verrouillée. Votre prédiction <span className="font-semibold text-primary-600 dark:text-accent-dark-400">{prediction.name}</span> ne peut plus être modifiée.</>
              ) : (
                'La sélection est verrouillée. Vous ne pouvez plus faire de prédiction.'
              )}
            </p>
          </div>
        ) : availableTeams.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Bientôt disponible</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <select
                id="team-select"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[rgb(40,40,40)] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500 transition-all"
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
              disabled={!selectedTeamId || submitting}
              className="w-full px-4 py-3 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-md hover:shadow-lg"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Enregistrement...
                </span>
              ) : (
                'Confirmer'
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-t border-gray-300 dark:border-accent-dark-500 px-6 py-3">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 text-center">
          Prédisez le vainqueur final et gagnez <span className="text-primary-600 dark:text-accent-dark-400">5 points</span> bonus
        </p>
      </div>
    </div>
  );
}
