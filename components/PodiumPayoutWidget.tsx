import { useState } from 'react';
import { BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export type PodiumPayoutPayer = {
  userId: string;
  userName: string;
  profilePictureUrl: string | null;
  amount: number;
  paidAt: string | null;
};

export type PodiumPayoutPosition = {
  rank: 1 | 2 | 3;
  prize: number;
  net: number;
  winner: { userId: string; userName: string; profilePictureUrl: string | null };
  payers: PodiumPayoutPayer[];
};

type CommonFields = {
  entryFee: number;
  currency: string;
  pot: number;
  participantCount: number;
  percentages: [number, number, number];
  prizes: [number, number, number];
  nets: [number, number, number];
  adjusted: boolean;
};

export type PodiumPayoutData = CommonFields &
  (
    | { mode: 'pre'; participants: Array<{ userId: string; userName: string; profilePictureUrl: string | null; paidAt: string | null }> }
    | { mode: 'settled'; positions: PodiumPayoutPosition[] }
  );

interface Props {
  data: PodiumPayoutData;
  competitionId: string;
  currentUserId: string;
}

const RANK_STYLES: Record<1 | 2 | 3, { ring: string; chip: string; label: string }> = {
  1: { ring: 'border-yellow-300 dark:border-yellow-600', chip: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200', label: '1ʳᵉ place' },
  2: { ring: 'border-gray-300 dark:border-gray-500',   chip: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',         label: '2ᵉ place' },
  3: { ring: 'border-amber-400 dark:border-amber-700', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',   label: '3ᵉ place' },
};
const MEDAL_EMOJI: Record<1 | 2 | 3, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function fmt(n: number) {
  // Show no decimals for whole numbers, otherwise 2 decimals.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

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

function PaidPill({ paid }: { paid: boolean }) {
  return paid
    ? <span className="text-[11px] text-green-700 dark:text-green-300">Payé</span>
    : <span className="text-[11px] text-gray-500 dark:text-gray-400">En attente</span>;
}

function ConfirmButton({ paid, submitting, onClick }: { paid: boolean; submitting: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
        paid
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-amber-500 text-white hover:bg-amber-600 ring-1 ring-amber-300 dark:ring-amber-700'
      }`}
      title={paid ? 'Annuler la confirmation' : 'Cliquer pour confirmer le paiement'}
    >
      {paid ? <><CheckCircleIcon className="h-4 w-4" />Payé</> : 'Confirmer'}
    </button>
  );
}

export default function PodiumPayoutWidget({ data, competitionId, currentUserId }: Props) {
  const initial: Record<string, string | null> = {};
  if (data.mode === 'settled') {
    data.positions.forEach(pos => pos.payers.forEach(p => { initial[p.userId] = p.paidAt; }));
  }
  const [paidState, setPaidState] = useState<Record<string, string | null>>(initial);
  const [submitting, setSubmitting] = useState(false);

  const { entryFee, currency, pot, participantCount, percentages, prizes, nets, adjusted } = data;

  const togglePaid = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/competitions/${competitionId}/podium-payment`, { method: 'POST' });
      if (res.ok) {
        const { paidAt } = await res.json();
        setPaidState(prev => ({ ...prev, [currentUserId]: paidAt }));
      } else {
        alert('Erreur lors de la mise à jour du paiement');
      }
    } catch (err) {
      console.error('togglePaid error', err);
      alert('Erreur lors de la mise à jour du paiement');
    } finally {
      setSubmitting(false);
    }
  };

  // PRE-COMPLETION: compact projected-prize widget, no payment talk.
  if (data.mode === 'pre') {
    return (
      <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl border border-gray-300 dark:border-gray-600 overflow-hidden mb-8 shadow">
        <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-4 py-3 flex items-center gap-3">
          <div className="p-1.5 bg-primary-600 dark:bg-accent-dark-600 rounded-full flex items-center justify-center">
            <BanknotesIcon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm md:text-base font-bold text-gray-900 dark:text-gray-100">Cagnotte</h3>
            <p className="text-[11px] md:text-xs text-gray-600 dark:text-gray-300">
              {participantCount} joueur{participantCount > 1 ? 's' : ''} · Mise {entryFee}{currency} · Total <span className="font-semibold">{fmt(pot)}{currency}</span>
            </p>
          </div>
        </div>

        {participantCount < 3 ? (
          <div className="px-4 py-3 text-xs md:text-sm text-gray-600 dark:text-gray-300">
            Les prix s'afficheront dès qu'il y aura au moins <span className="font-semibold">3 joueurs</span>.
          </div>
        ) : (
          <div className="p-3 grid grid-cols-3 gap-2">
            {([0, 1, 2] as const).map(idx => {
              const rank = (idx + 1) as 1 | 2 | 3;
              const styles = RANK_STYLES[rank];
              return (
                <div key={rank} className={`rounded-lg border ${styles.ring} ${styles.chip} px-3 py-2 text-center`}>
                  <div className="text-xl leading-none">{MEDAL_EMOJI[rank]}</div>
                  <div className="text-[10px] md:text-xs font-semibold uppercase tracking-wide mt-1">{percentages[idx]}%</div>
                  <div className="text-sm md:text-base font-bold mt-0.5">{fmt(prizes[idx])}{currency}</div>
                </div>
              );
            })}
          </div>
        )}

        {participantCount >= 3 && adjusted && (
          <p className="px-4 pb-2 text-[10px] md:text-[11px] text-amber-700 dark:text-amber-300">
            Répartition ajustée pour que le 3ᵉ ne perde pas sa mise.
          </p>
        )}
      </div>
    );
  }

  // SETTLED MODE: full podium with winners, payer chunks, and per-user payment confirmation.
  const paidCount = Object.values(paidState).filter(Boolean).length;
  return (
    <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-2xl dark:shadow-dark-xl border border-gray-300 dark:border-gray-600 overflow-hidden mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
            <BanknotesIcon className="h-6 w-6 text-white" />
          </div>
          Paiements
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 ml-12">
          Mise : {entryFee}{currency} · {participantCount} joueurs · Cagnotte totale : <span className="font-semibold">{fmt(pot)}{currency}</span>
        </p>
        {adjusted && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 ml-12">
            Avec ce nombre de joueurs, la répartition ajustée garantit que le 3ᵉ ne perde pas sa mise (1ᵉʳ &gt; 2ᵉ &gt; 3ᵉ).
          </p>
        )}
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {([0, 1, 2] as const).map(idx => {
          const rank = (idx + 1) as 1 | 2 | 3;
          const styles = RANK_STYLES[rank];
          const prize = prizes[idx];
          const net = nets[idx];
          const winner = data.positions[idx]?.winner;
          const payers = data.positions[idx]?.payers ?? [];
          const paidNum = payers.filter(p => !!paidState[p.userId]).length;
          return (
            <div key={rank} className={`rounded-xl border-2 ${styles.ring} bg-white/70 dark:bg-[rgb(48,48,48)] overflow-hidden flex flex-col`}>
              <div className={`px-4 py-3 ${styles.chip} flex items-center gap-3`}>
                <span className="text-2xl">{MEDAL_EMOJI[rank]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide">{styles.label} · {percentages[idx]}%</p>
                  <p className="text-base font-bold truncate">{fmt(prize)}{currency}</p>
                </div>
              </div>

              {winner && (
                <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-200 dark:border-gray-600">
                  <Avatar name={winner.userName} url={winner.profilePictureUrl} size="lg" />
                  <div className="min-w-0">
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{winner.userName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {net > 0 ? `reçoit ${fmt(net)}${currency}` : `récupère sa mise (${entryFee}${currency})`}
                    </p>
                  </div>
                </div>
              )}

              <div className="px-4 py-3 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  {payers.length === 0
                    ? 'Aucun versement à recevoir'
                    : `${paidNum}/${payers.length} payé${paidNum > 1 ? 's' : ''} · ${payers.length * entryFee}${currency}`}
                </p>
                {payers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">Récupère sa mise ({entryFee}{currency})</p>
                ) : (
                  <ul className="space-y-2">
                    {payers.map(payer => {
                      const isPaid = !!paidState[payer.userId];
                      const isSelf = payer.userId === currentUserId;
                      return (
                        <li key={payer.userId} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${isPaid ? 'bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-700' : 'border border-transparent'}`}>
                          <Avatar name={payer.userName} url={payer.profilePictureUrl} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{payer.userName}</p>
                            <PaidPill paid={isPaid} />
                          </div>
                          <span className="flex-shrink-0 text-xs font-mono font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-0.5">{payer.amount}{currency}</span>
                          {isSelf
                            ? <ConfirmButton paid={isPaid} submitting={submitting} onClick={togglePaid} />
                            : isPaid && <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
                        </li>
                      );
                    })}
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
