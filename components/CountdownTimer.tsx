import { useState, useEffect, memo } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

interface CountdownTimerProps {
  nextGameDate: string | null;
  className?: string;
  onCountdownComplete?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer = memo(({ nextGameDate, className = '', onCountdownComplete }: CountdownTimerProps) => {
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
      <div className={`bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 shadow-modern-lg border border-primary-500/20 ${className}`}>
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
    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-modern-lg border border-primary-200/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-primary-600 rounded-full shadow-lg flex items-center justify-center">
          <ClockIcon className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-xl font-bold text-neutral-900">Prochain matchs dans :</h3>
      </div>

      {/* Countdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {timeUnits.map((unit, index) => (
          <div
            key={unit.label}
            className="relative bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4 md:p-5 border border-primary-200/60 shadow-modern hover:shadow-modern-lg transition-all duration-300"
          >
            {/* Number */}
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-black text-primary-800 mb-1">
                {unit.value.toString().padStart(2, '0')}
              </div>
              
              {/* Label */}
              <div className="text-xs md:text-sm font-medium text-primary-600 uppercase tracking-wide">
                <span className="hidden md:inline">{unit.label}</span>
                <span className="md:hidden">{unit.shortLabel}</span>
              </div>
            </div>

            {/* Subtle accent line */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-primary-400 to-primary-500 rounded-full"></div>
          </div>
        ))}
      </div>

    </div>
  );
});

CountdownTimer.displayName = 'CountdownTimer';

export default CountdownTimer;
