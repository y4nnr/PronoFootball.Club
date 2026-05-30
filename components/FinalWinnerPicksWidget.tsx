import { TrophyIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export type FinalWinnerPick = {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  team: { id: string; name: string; logo: string | null } | null;
};

export type FinalWinnerPicksData = {
  picks: FinalWinnerPick[];
  actualWinnerTeam: { id: string; name: string; logo: string | null } | null;
  finalLabel: string | null;
  decidedOnPenalties: boolean;
};

interface Props {
  data: FinalWinnerPicksData;
}

export default function FinalWinnerPicksWidget({ data }: Props) {
  const { picks, actualWinnerTeam, finalLabel, decidedOnPenalties } = data;
  if (!picks || picks.length === 0) return null;

  const withPick = picks.filter(p => p.team);
  const withoutPick = picks.filter(p => !p.team);

  const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <TrophyIcon className="h-6 w-6 text-white" />
          </div>
          <span className="md:hidden">Paris Vainqueur Final</span>
          <span className="hidden md:inline">Paris du Vainqueur Final</span>
        </h3>
        {finalLabel && (
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 ml-12">{finalLabel}</p>
        )}
      </div>

      {actualWinnerTeam && (
        <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {actualWinnerTeam.logo && (
              <img src={actualWinnerTeam.logo} alt={actualWinnerTeam.name} className="w-7 h-7 object-contain flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide leading-tight">Vainqueur</p>
              <p className="text-sm font-bold text-yellow-900 dark:text-yellow-100 truncate">
                {actualWinnerTeam.name}
                {decidedOnPenalties && <span className="ml-2 text-xs font-normal text-yellow-700 dark:text-yellow-300">(aux tirs au but)</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {withPick.map(p => {
          const isCorrect = actualWinnerTeam && p.team && p.team.id === actualWinnerTeam.id;
          return (
            <div
              key={p.userId}
              className={`px-6 py-3 flex items-center gap-3 ${
                isCorrect ? 'bg-green-50/60 dark:bg-green-900/15' : ''
              }`}
            >
              <div className="flex-shrink-0">
                {p.profilePictureUrl ? (
                  <img src={p.profilePictureUrl} alt={p.userName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary-200 dark:bg-accent-dark-700 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-100">
                    {initial(p.userName)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{p.userName}</p>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {p.team!.logo && (
                  <img src={p.team!.logo} alt={p.team!.name} className="w-6 h-6 object-contain flex-shrink-0" />
                )}
                <span className={`text-sm truncate ${isCorrect ? 'font-bold text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {p.team!.name}
                </span>
                {isCorrect && <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
              </div>
            </div>
          );
        })}
        {withoutPick.map(p => (
          <div key={p.userId} className="px-6 py-3 flex items-center gap-3 opacity-60">
            <div className="flex-shrink-0">
              {p.profilePictureUrl ? (
                <img src={p.profilePictureUrl} alt={p.userName} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                  {initial(p.userName)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{p.userName}</p>
            </div>
            <span className="text-xs italic text-gray-500 dark:text-gray-400">Aucun pari</span>
          </div>
        ))}
      </div>
    </div>
  );
}
