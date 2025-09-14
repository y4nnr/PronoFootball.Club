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
        className={`bg-neutral-50 border border-neutral-200/50 rounded-2xl shadow-modern p-5 flex flex-col justify-between hover:shadow-modern-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div>
          <div className="flex items-center space-x-3 mb-3">
            {competition.logo ? (
              <img 
                src={competition.logo} 
                alt={`${competition.name} logo`}
                className="h-8 w-8 object-contain flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">
                  {competition.name.charAt(0)}
                </span>
              </div>
            )}
            <h3 className="text-lg font-bold text-neutral-900 flex-1">{competition.name}</h3>
          </div>
          <div className="text-sm text-neutral-500 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p><span className="font-medium">Start:</span> {formatDate(competition.startDate)}</p>
                <p><span className="font-medium">End:</span> {formatDate(competition.endDate)}</p>
              </div>
              {typeof userRanking === 'number' && (
                <span className="px-3 py-1 rounded-full bg-accent-500 text-accent-700 text-base font-medium shadow-md">
                  {t('competition.yourPosition')}: #{userRanking}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center px-3 py-1.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-modern bg-primary-600 text-white">
          {actionIcon}
          <span className="ml-2">{actionLabel}</span>
        </div>
      </Link>
    </div>
  );
} 