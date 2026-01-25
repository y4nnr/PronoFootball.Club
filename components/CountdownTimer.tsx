import { useState, useEffect, memo } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

interface CountdownTimerProps {
  nextGameDate: string | null;
  className?: string;
  onCountdownComplete?: () => void;
  upcomingGames?: Array<{
    id: string;
    date: string;
    homeTeam: { name: string; logo?: string };
    awayTeam: { name: string; logo?: string };
  }>;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer = memo(({ nextGameDate, className = '', onCountdownComplete, upcomingGames = [] }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!nextGameDate) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const gameTime = new Date(nextGameDate).getTime();
      const difference = gameTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        // Call the callback when countdown reaches zero
        if (onCountdownComplete) {
          onCountdownComplete();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextGameDate]);


  if (!nextGameDate || !timeLeft) {
    return null;
  }

  // If countdown has reached zero, show a different message
  if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return (
      <div className={`bg-gradient-to-r from-primary-600 to-primary-700 dark:from-accent-dark-600 dark:to-accent-dark-700 rounded-2xl p-6 shadow-modern-lg border border-primary-500/20 dark:border-accent-dark-500/20 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="p-2 bg-white/10 rounded-full">
            <ClockIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Le prochain match commence bientôt !</span>
        </div>
      </div>
    );
  }

  const timeUnits = [
    { value: timeLeft.days, label: 'jours', shortLabel: 'j' },
    { value: timeLeft.hours, label: 'heures', shortLabel: 'h' },
    { value: timeLeft.minutes, label: 'minutes', shortLabel: 'min' },
    { value: timeLeft.seconds, label: 'secondes', shortLabel: 'sec' },
  ];

  return (
    <div className={`bg-white dark:bg-[rgb(58,58,58)] rounded-2xl border border-primary-200/50 dark:border-gray-600 overflow-hidden ${className}`} style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      {/* Header Section */}
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <ClockIcon className="h-6 w-6 text-white" />
          </div>
          Prochain coup d'envoi
        </h3>
      </div>
      {/* Content Section */}
      <div className="p-6">
        {/* Countdown Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {timeUnits.map((unit, index) => (
          <div
            key={unit.label}
            className="relative bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(58,58,58)] dark:to-[rgb(56,56,56)] rounded-xl p-3 md:p-4 border-2 border-gray-300 dark:border-gray-600 shadow-lg dark:shadow-dark-modern-lg transition-all duration-300 hover:shadow-xl dark:hover:shadow-dark-xl hover:border-gray-400 dark:hover:border-gray-600"
          >
            {/* Number */}
            <div className="text-center">
              <div className="text-xl md:text-2xl font-black text-primary-800 dark:text-gray-100 mb-0.5">
                {unit.value.toString().padStart(2, '0')}
              </div>
              
              {/* Label */}
              <div className="text-xs font-medium text-primary-600 dark:text-gray-400 uppercase tracking-wide">
                <span className="hidden md:inline">{unit.label}</span>
                <span className="md:hidden">{unit.shortLabel}</span>
              </div>
            </div>

            {/* Subtle accent line */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-primary-400 to-primary-500 dark:from-accent-dark-500 dark:to-accent-dark-600 rounded-full"></div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
});

CountdownTimer.displayName = 'CountdownTimer';

export default CountdownTimer;
