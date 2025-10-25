import React, { useState, useEffect, useCallback, memo } from 'react';
import { CalendarIcon, UserIcon } from '@heroicons/react/24/outline';

interface Player {
  id: string;
  name: string;
  profilePictureUrl: string | null;
}

interface GameDay {
  dayNumber: number;
  journéeNumber: number;
  date: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface PlayerDayScore {
  playerId: string;
  dayNumber: number;
  points: number;
}

interface CalendarWidgetProps {
  players: Player[];
  gameDays: GameDay[];
  playerDayScores: PlayerDayScore[];
  currentUserId?: string;
  loading: boolean;
  error: string | null;
}

const CalendarWidget = memo(({
  players,
  gameDays,
  playerDayScores,
  currentUserId,
  loading,
  error
}: CalendarWidgetProps) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Filter to only show completed game days
  const completedGameDays = gameDays.filter(day => day.isCompleted);
  
  // Group days by journée
  const journéeGroups = completedGameDays.reduce((acc, day) => {
    if (!acc[day.journéeNumber]) {
      acc[day.journéeNumber] = [];
    }
    acc[day.journéeNumber].push(day);
    return acc;
  }, {} as Record<number, GameDay[]>);

  // Get score for a specific player and day
  const getPlayerDayScore = (playerId: string, dayNumber: number): number => {
    const score = playerDayScores.find(
      s => s.playerId === playerId && s.dayNumber === dayNumber
    );
    return score ? score.points : 0;
  };

  // Get the highest score for each day
  const getDayHighestScore = (dayNumber: number) => {
    const dayScores = playerDayScores.filter(score => score.dayNumber === dayNumber);
    if (dayScores.length === 0) return 0;
    return Math.max(...dayScores.map(score => score.points));
  };

  // Get day rankings for overlay
  const getDayRankings = (dayNumber: number) => {
    const dayScores = playerDayScores
      .filter(score => score.dayNumber === dayNumber)
      .map(score => ({
        player: players.find(p => p.id === score.playerId)!,
        points: score.points
      }))
      .sort((a, b) => b.points - a.points);
    
    return dayScores;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-300 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            Points par journée
          </h2>
          <p className="text-sm text-gray-500 mt-1">Du premier au dernier jour joué</p>
        </div>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                  <div className="h-10 bg-gray-200 rounded flex-1"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-300 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            Points par journée
          </h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-red-500 text-4xl mb-3">⚠️</div>
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-blue-500 text-sm hover:underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (completedGameDays.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-300 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            Points par journée
          </h2>
          <p className="text-sm text-gray-500 mt-1">Du premier au dernier jour joué</p>
        </div>
        <div className="p-6">
          <div className="text-center py-12">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucune journée complétée pour l'instant.</p>
            <p className="text-gray-400 text-sm mt-2">Le calendrier apparaîtra une fois que les premiers matchs seront terminés.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-300 overflow-hidden mb-8">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <div className="p-2 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-white" />
          </div>
          Points par journée
        </h2>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start">
            <div className="w-48 text-sm font-medium text-gray-500 uppercase tracking-wider pt-2">
              Joueur
            </div>
            {Object.entries(journéeGroups).map(([journéeNum, days], index) => (
              <div key={journéeNum} className={`flex-1 text-left ${index < Object.keys(journéeGroups).length - 1 ? 'border-r border-gray-300 pr-4 mr-4' : ''}`}>
                <div className="text-sm font-bold text-gray-800 mb-2">
                  J{journéeNum}
                </div>
                <div className="flex space-x-1">
                  {days.map((day) => (
                    <div
                      key={day.dayNumber}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"
                      title={`J${day.journéeNumber} - ${new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`}
                      onClick={() => setSelectedDay(selectedDay === day.dayNumber ? null : day.dayNumber)}
                    >
                      {new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Players Grid */}
        <div className="space-y-4">
          {players.map((player, index) => (
            <div key={player.id} className="flex items-center">
              {/* Player Info */}
              <div className="w-48 flex items-center">
                <img
                  src={player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                  alt={player.name}
                  className="w-8 h-8 rounded-full mr-3 object-cover border border-gray-200"
                />
                <div className="text-sm font-medium text-gray-900 truncate">
                  {player.name}
                </div>
              </div>

              {/* Points Grid */}
              {Object.entries(journéeGroups).map(([journéeNum, days], index) => (
                <div key={journéeNum} className={`flex-1 flex space-x-1 ${index < Object.keys(journéeGroups).length - 1 ? 'border-r border-gray-300 pr-4 mr-4' : ''}`}>
                  {days.map((day) => {
                    const points = getPlayerDayScore(player.id, day.dayNumber);
                    const isHighestScore = points > 0 && points === getDayHighestScore(day.dayNumber);
                    
                    return (
                      <div
                        key={day.dayNumber}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                          isHighestScore
                            ? 'bg-blue-100 text-blue-800'
                            : points > 0
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400'
                        }`}
                        title={`${player.name} — ${points} pts — ${new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`}
                      >
                        {points}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Day rankings overlay */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedDay(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Classement du jour {selectedDay}
            </h3>
            <div className="space-y-2">
              {getDayRankings(selectedDay).map((item, index) => (
                <div key={item.player.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-800 mr-3">
                      {index + 1}
                    </div>
                    <img
                      src={item.player.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.player.name.toLowerCase())}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                      alt={item.player.name}
                      className="w-8 h-8 rounded-full mr-3 object-cover border border-gray-200"
                    />
                    <span className="text-sm font-medium text-gray-900">{item.player.name}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">{item.points} pts</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

CalendarWidget.displayName = 'CalendarWidget';

export default CalendarWidget;