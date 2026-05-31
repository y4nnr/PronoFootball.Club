import { BanknotesIcon } from '@heroicons/react/24/outline';

export type PodiumPayoutPayer = {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  amount: number;
};

export type PodiumPayoutPosition = {
  rank: 1 | 2 | 3;
  prize: number;
  winner: { userId: string; userName: string; profilePictureUrl: string | null };
  payers: PodiumPayoutPayer[];
};

export type PodiumPayoutData = {
  entryFee: number;
  currency: string;
  positions: PodiumPayoutPosition[];
};

interface Props {
  data: PodiumPayoutData;
}

const RANK_STYLES: Record<1 | 2 | 3, { ring: string; chip: string; medal: string; medalText: string; label: string }> = {
  1: {
    ring: 'border-yellow-300 dark:border-yellow-600',
    chip: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    medal: 'bg-yellow-400 dark:bg-yellow-500',
    medalText: 'text-yellow-900',
    label: '1ʳᵉ place',
  },
  2: {
    ring: 'border-gray-300 dark:border-gray-500',
    chip: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    medal: 'bg-gray-300 dark:bg-gray-400',
    medalText: 'text-gray-800',
    label: '2ᵉ place',
  },
  3: {
    ring: 'border-amber-400 dark:border-amber-700',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    medal: 'bg-amber-500 dark:bg-amber-600',
    medalText: 'text-amber-50',
    label: '3ᵉ place',
  },
};

const MEDAL_EMOJI: Record<1 | 2 | 3, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function Avatar({ name, url, size = 'md' }: { name: string; url: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-14 h-14 text-lg' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return <img src={url} alt={name} className={`${dims} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-primary-200 dark:bg-accent-dark-700 flex items-center justify-center font-bold text-primary-700 dark:text-primary-100 flex-shrink-0`}>
      {initial}
    </div>
  );
}

export default function PodiumPayoutWidget({ data }: Props) {
  if (!data || data.positions.length === 0) return null;
  const { entryFee, currency, positions } = data;

  return (
    <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <BanknotesIcon className="h-6 w-6 text-white" />
          </div>
          <span className="md:hidden">Cagnotte</span>
          <span className="hidden md:inline">Cagnotte &amp; Versements</span>
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 ml-12">
          Mise : {entryFee}{currency} par joueur. Chaque non-podium verse sa mise au gagnant indiqué.
        </p>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {positions.map(pos => {
          const styles = RANK_STYLES[pos.rank];
          const totalReceived = pos.payers.reduce((sum, p) => sum + p.amount, 0);
          return (
            <div key={pos.rank} className={`rounded-xl border-2 ${styles.ring} bg-white/70 dark:bg-[rgb(48,48,48)] overflow-hidden flex flex-col`}>
              <div className={`px-4 py-3 ${styles.chip} flex items-center gap-3`}>
                <span className="text-2xl">{MEDAL_EMOJI[pos.rank]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide">{styles.label}</p>
                  <p className="text-base font-bold truncate">{pos.prize}{currency}</p>
                </div>
              </div>

              <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-200 dark:border-gray-600">
                <Avatar name={pos.winner.userName} url={pos.winner.profilePictureUrl} size="lg" />
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{pos.winner.userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">reçoit {pos.prize}{currency}</p>
                </div>
              </div>

              <div className="px-4 py-3 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  {pos.payers.length === 0
                    ? 'Aucun versement à recevoir'
                    : `${pos.payers.length} versement${pos.payers.length > 1 ? 's' : ''} (${totalReceived}${currency})`}
                </p>
                {pos.payers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Récupère sa mise ({entryFee}{currency})
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pos.payers.map(payer => (
                      <li key={payer.userId} className="flex items-center gap-3">
                        <Avatar name={payer.userName} url={payer.profilePictureUrl} size="md" />
                        <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {payer.userName}
                        </span>
                        <span className="flex-shrink-0 text-xs font-mono font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-0.5">
                          {payer.amount}{currency}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
