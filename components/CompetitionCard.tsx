import Link from 'next/link';
import { useTranslation } from '../hooks/useTranslation';

// Utility function to format dates consistently
const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

type Competition = {
  id: string;
  name: string;
  description?: string;
  logo?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  winnerId?: string | null;
  lastPlaceId?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  totalGames?: number;
  gamesPlayed?: number;
  progressPercentage?: number;
};

export default function CompetitionCard({ competition, actionLabel, actionIcon, disabled = false, userRanking }: {
  competition: Competition;
  actionLabel: string;
  actionIcon: React.ReactNode;
  disabled?: boolean;
  userRanking?: number;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="relative">
      <Link
        href={`/competitions/${competition.id}`}
        className={`bg-white dark:bg-[rgb(58,58,58)] border-2 border-gray-300 dark:border-gray-600 rounded-2xl shadow-lg dark:shadow-dark-modern-lg overflow-hidden flex flex-col justify-between hover:shadow-xl dark:hover:shadow-dark-xl hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-200 hover:scale-[1.02] cursor-pointer ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        {/* Header Section */}
        <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-4 py-3">
          <div className="flex items-center space-x-3">
            {competition.logo ? (
              <img 
                src={competition.logo} 
                alt={`${competition.name} logo`}
                className="h-8 w-8 object-contain dark:bg-white dark:p-0.5 dark:rounded flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">
                  {competition.name.charAt(0)}
                </span>
              </div>
            )}
            <h3 className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">{competition.name}</h3>
          </div>
        </div>
        {/* Content Section */}
        <div className="p-4 flex flex-col justify-between flex-1">
          <div className="text-sm text-neutral-500 dark:text-gray-400 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p><span className="font-medium">Start:</span> {formatDate(competition.startDate)}</p>
                <p><span className="font-medium">End:</span> {formatDate(competition.endDate)}</p>
              </div>
              {typeof userRanking === 'number' && (
                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary-600 dark:bg-[rgb(40,40,40)] text-white dark:text-gray-200 text-xs md:text-sm font-bold">
                  {t('competition.yourPosition')}: {userRanking}
                </span>
              )}
            </div>
          </div>
          {/* Progress Bar */}
          {competition.totalGames !== undefined && competition.gamesPlayed !== undefined && competition.progressPercentage !== undefined ? (
            <div className="mt-2">
            <div className="flex items-center justify-center mb-0.5">
              <span className="text-xs md:text-sm font-bold text-neutral-800 dark:text-gray-200">
                {competition.gamesPlayed}/{competition.totalGames} matchs
              </span>
            </div>
            <div className="relative w-full bg-neutral-200 dark:bg-[rgb(40,40,40)] rounded-full h-8">
              <div 
                className="absolute top-0 left-0 bottom-0 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 dark:[background:none] border-2 border-transparent dark:border-white transition-all duration-300 ease-out flex items-center justify-center"
                style={{ 
                  width: `${competition.progressPercentage}%`,
                  height: '100%',
                  minWidth: competition.progressPercentage === 0 ? '0%' : 'auto'
                }}
              >
                {competition.progressPercentage > 0 && (
                  <span className="text-xs font-bold text-white dark:text-gray-200">
                    {competition.progressPercentage}%
                  </span>
                )}
              </div>
              {/* Show percentage text outside the bar when it's 0% or too small to fit text */}
              {competition.progressPercentage === 0 && (
                <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-neutral-800 dark:text-white">
                  0%
                </span>
              )}
            </div>
          </div>
          ) : (
            <div className="mt-2 flex items-center justify-center px-3 py-1.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-modern bg-primary-600 dark:bg-transparent border-2 border-transparent dark:border-accent-dark-500 text-white hover:bg-primary-700 dark:hover:bg-accent-dark-500/10">
              {actionIcon}
              <span className="ml-2">{actionLabel}</span>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
} 