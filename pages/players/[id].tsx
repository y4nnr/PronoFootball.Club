import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { TrophyIcon, BanknotesIcon, StarIcon, ChartBarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

type Career = {
  competitionId: string;
  competitionName: string;
  competitionLogo: string | null;
  sportType: string;
  startDate: string;
  endDate: string;
  status: string;
  position: number;
  totalPoints: number;
  exactScores: number;
  shooters: number;
  totalPredictions: number;
  participantCount: number;
  entryFee: number;
  prize: number;
  net: number;
  isPodium: boolean;
};

type Profile = {
  user: { id: string; name: string; profilePictureUrl: string | null; createdAt: string };
  career: Career[];
  palmares: {
    wins: number; seconds: number; thirds: number;
    competitionsPlayed: number;
    totalPoints: number; totalPredictions: number;
    exactScores: number; shooters: number;
  };
  financial: { totalEarned: number; totalSpent: number; netEur: number; moneyComps: number };
  distinctions: Array<{ category: string; label: string; value: string; rank: number }>;
};

function fmtDate(s: string) {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function avatar(name: string, url: string | null, big = false) {
  const dims = big ? 'w-32 h-32 text-4xl' : 'w-12 h-12 text-base';
  if (url) {
    return <img src={url} alt={name} className={`${dims} rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-xl`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-primary-200 dark:bg-accent-dark-700 flex items-center justify-center font-bold text-primary-700 dark:text-primary-100 border-4 border-white dark:border-gray-700 shadow-xl`}>
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </div>
  );
}

function rankBadge(pos: number, last: boolean) {
  if (pos === 1) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">🏆 1ᵉʳ</span>;
  if (pos === 2) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200">🥈 2ᵉ</span>;
  if (pos === 3) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">🥉 3ᵉ</span>;
  if (last) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">🍕 Hôte</span>;
  return <span className="text-sm font-mono text-neutral-700 dark:text-gray-300">#{pos}</span>;
}

export default function PlayerProfile() {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/players/${id}`);
        if (!r.ok) { setError('Joueur introuvable'); return; }
        const data = await r.json();
        setProfile(data);
      } catch (e) { setError('Erreur de chargement'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] dark:bg-[rgb(20,20,20)] flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-accent-dark-500"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] dark:bg-[rgb(20,20,20)]">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-neutral-500 dark:text-gray-400">{error ?? 'Joueur introuvable'}</p>
          <Link href="/stats" className="inline-flex items-center gap-2 mt-4 text-primary-600 dark:text-accent-dark-400">
            <ArrowLeftIcon className="h-4 w-4" /> Retour aux statistiques
          </Link>
        </div>
      </div>
    );
  }

  const { user, career, palmares, financial, distinctions } = profile;
  const completedCareer = career.filter(c => c.status === 'COMPLETED' || c.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 dark:from-[rgb(20,20,20)] dark:via-[rgb(25,25,25)] dark:to-[rgb(30,30,30)]">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 dark:from-[rgb(40,40,40)] dark:via-[rgb(36,36,36)] dark:to-[rgb(30,30,30)] border-b border-primary-900/20 dark:border-gray-700">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
            <Link href="/stats" className="inline-flex items-center gap-2 text-xs md:text-sm text-white/80 dark:text-gray-300 hover:text-white mb-6">
              <ArrowLeftIcon className="h-4 w-4" /> Statistiques
            </Link>
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="flex-shrink-0">{avatar(user.name, user.profilePictureUrl, true)}</div>
              <div className="flex-1 min-w-0 text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-bold text-white">{user.name}</h1>
                <p className="text-sm md:text-base text-white/80 dark:text-gray-300 mt-2">
                  {palmares.competitionsPlayed} compétition{palmares.competitionsPlayed > 1 ? 's' : ''}
                  {palmares.wins > 0 && <> · {palmares.wins} victoire{palmares.wins > 1 ? 's' : ''}</>}
                  {financial.moneyComps > 0 && <> · bilan financier {financial.netEur >= 0 ? '+' : ''}{financial.netEur}€</>}
                </p>
                {distinctions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                    {distinctions.slice(0, 4).map(d => (
                      <span key={d.category} className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 dark:bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-white">
                        {d.rank === 1 ? '🥇' : d.rank === 2 ? '🥈' : '🥉'} {d.label} · {d.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
          {/* Quick stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatTile icon="🏆" label="Victoires" value={String(palmares.wins)} accent="yellow" />
            <StatTile icon="🎯" label="Scores exacts" value={String(palmares.exactScores)} accent="green" />
            <StatTile icon="📊" label="Total points" value={String(palmares.totalPoints)} accent="primary" />
            <StatTile icon="💸" label="Bilan financier" value={`${financial.netEur >= 0 ? '+' : ''}${financial.netEur}€`} accent={financial.netEur >= 0 ? 'green' : 'red'} />
          </div>

          {/* Palmarès */}
          <Section title="Palmarès" icon={<TrophyIcon className="h-6 w-6 text-white" />}>
            <div className="grid grid-cols-3 gap-3 md:gap-6 text-center">
              <PodiumStat emoji="🥇" count={palmares.wins} label="Victoires" />
              <PodiumStat emoji="🥈" count={palmares.seconds} label="2ᵉ place" />
              <PodiumStat emoji="🥉" count={palmares.thirds} label="3ᵉ place" />
            </div>
          </Section>

          {/* Bilan financier */}
          {financial.moneyComps > 0 && (
            <Section title="Bilan Financier" icon={<BanknotesIcon className="h-6 w-6 text-white" />}>
              <div className="grid grid-cols-3 gap-3 md:gap-6 text-center">
                <MoneyTile label="Gagné" value={`+${financial.totalEarned}€`} color="green" />
                <MoneyTile label="Dépensé" value={`−${financial.totalSpent}€`} color="red" />
                <MoneyTile label="Net" value={`${financial.netEur >= 0 ? '+' : ''}${financial.netEur}€`} color={financial.netEur > 0 ? 'green' : financial.netEur < 0 ? 'red' : 'gray'} />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-gray-400 mt-3 text-center">
                Calculé sur {financial.moneyComps} compétition{financial.moneyComps > 1 ? 's' : ''} avec mise.
              </p>
            </Section>
          )}

          {/* Distinctions (full list) */}
          {distinctions.length > 0 && (
            <Section title="Distinctions" icon={<StarIcon className="h-6 w-6 text-white" />}>
              <ul className="divide-y divide-neutral-200 dark:divide-gray-700">
                {distinctions.map(d => (
                  <li key={d.category} className="py-2 flex items-center gap-3">
                    <span className="text-2xl">{d.rank === 1 ? '🥇' : d.rank === 2 ? '🥈' : '🥉'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-gray-100">{d.label}</p>
                      <p className="text-xs text-neutral-500 dark:text-gray-400">Classement global : #{d.rank}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-neutral-700 dark:text-gray-200">{d.value}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Carrière */}
          <Section title="Carrière" icon={<ChartBarIcon className="h-6 w-6 text-white" />}>
            {completedCareer.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-gray-400">Aucune compétition terminée pour l'instant.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-neutral-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-neutral-50 dark:bg-[rgb(45,45,45)]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] md:text-xs font-bold text-neutral-500 dark:text-gray-300 uppercase tracking-wider">Compétition</th>
                      <th className="px-3 py-2 text-center text-[10px] md:text-xs font-bold text-neutral-500 dark:text-gray-300 uppercase tracking-wider">Pos</th>
                      <th className="px-3 py-2 text-center text-[10px] md:text-xs font-bold text-neutral-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
                      <th className="px-3 py-2 text-center hidden md:table-cell text-[10px] md:text-xs font-bold text-neutral-500 dark:text-gray-300 uppercase tracking-wider">Scores exacts</th>
                      <th className="px-3 py-2 text-right text-[10px] md:text-xs font-bold text-neutral-500 dark:text-gray-300 uppercase tracking-wider">Cagnotte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-gray-700/60">
                    {completedCareer.map(c => (
                      <tr key={c.competitionId} className="hover:bg-yellow-50 dark:hover:bg-yellow-900/15">
                        <td className="px-3 py-2">
                          <Link href={`/competitions/${c.competitionId}`} className="flex items-center gap-2 group">
                            {c.competitionLogo ? (
                              <img src={c.competitionLogo} alt="" className="w-7 h-7 rounded object-contain flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded bg-primary-200 dark:bg-accent-dark-700 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs md:text-sm font-semibold text-neutral-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-accent-dark-400 truncate">{c.competitionName}</p>
                              <p className="text-[10px] text-neutral-500 dark:text-gray-400">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">{rankBadge(c.position, c.position === c.participantCount)}</td>
                        <td className="px-3 py-2 text-center text-xs md:text-sm font-mono font-semibold text-neutral-900 dark:text-gray-100">{c.totalPoints}</td>
                        <td className="px-3 py-2 text-center hidden md:table-cell text-xs md:text-sm text-neutral-700 dark:text-gray-300">{c.exactScores}</td>
                        <td className="px-3 py-2 text-right text-xs md:text-sm font-mono">
                          {c.entryFee === 0 ? (
                            <span className="text-neutral-400 dark:text-gray-500">—</span>
                          ) : (
                            <span className={c.net > 0 ? 'text-green-600 dark:text-green-400 font-semibold' : c.net < 0 ? 'text-red-500 dark:text-red-400' : 'text-neutral-500 dark:text-gray-400'}>
                              {c.net > 0 ? '+' : ''}{c.net}€
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <p className="text-[11px] text-center text-neutral-400 dark:text-gray-500 pb-8">
            Membre depuis le {fmtDate(user.createdAt)}
          </p>
        </div>
      </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-[rgb(58,58,58)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-600 overflow-hidden">
      <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-neutral-200 dark:border-accent-dark-500 px-6 py-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">{icon}</div>
          {title}
        </h2>
      </div>
      <div className="p-4 md:p-6">{children}</div>
    </section>
  );
}

function StatTile({ icon, label, value, accent }: { icon: string; label: string; value: string; accent: 'yellow' | 'green' | 'red' | 'primary' }) {
  const colors: Record<string, string> = {
    yellow: 'text-yellow-700 dark:text-yellow-300',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-500 dark:text-red-400',
    primary: 'text-primary-700 dark:text-accent-dark-400',
  };
  return (
    <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-xl shadow-md border border-neutral-200/50 dark:border-gray-600 p-3 md:p-4 text-center">
      <div className="text-2xl md:text-3xl">{icon}</div>
      <div className={`text-xl md:text-2xl font-bold ${colors[accent]} mt-1`}>{value}</div>
      <div className="text-[10px] md:text-xs text-neutral-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function PodiumStat({ emoji, count, label }: { emoji: string; count: number; label: string }) {
  return (
    <div>
      <div className="text-4xl md:text-5xl">{emoji}</div>
      <div className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-gray-100 mt-1">{count}</div>
      <div className="text-[10px] md:text-xs text-neutral-500 dark:text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function MoneyTile({ label, value, color }: { label: string; value: string; color: 'green' | 'red' | 'gray' }) {
  const c = color === 'green' ? 'text-green-600 dark:text-green-400' : color === 'red' ? 'text-red-500 dark:text-red-400' : 'text-neutral-500 dark:text-gray-400';
  return (
    <div>
      <div className={`text-2xl md:text-3xl font-bold font-mono ${c}`}>{value}</div>
      <div className="text-xs text-neutral-500 dark:text-gray-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return {
    props: {
      ...(await serverSideTranslations('fr', ['common'])),
    },
  };
};
