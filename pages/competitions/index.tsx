import { getSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { CheckCircleIcon, PlusCircleIcon, ArchiveBoxIcon, ArrowRightIcon, TrophyIcon } from '@heroicons/react/24/outline';
import Navbar from '../../components/Navbar';
import Link from 'next/link';

// Utility function to format dates consistently
const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

type Competition = {
  id: string;
  name: string;
  description: string;
  logo?: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  winnerId?: string | null;
  lastPlaceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CompetitionsPageProps = {
  joinedCompetitions: Competition[];
  availableCompetitions: Competition[];
  archivedCompetitions: Competition[];
};

const SectionCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl shadow-modern border border-neutral-200/50 p-6 mb-8">
    <div className="flex items-center mb-6">
      <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
    </div>
    {children}
  </div>
);

const CompetitionCard = ({ competition, actionLabel, actionIcon, disabled = false }: {
  competition: Competition;
  actionLabel: string;
  actionIcon: React.ReactNode;
  disabled?: boolean;
}) => (
  <Link
    href={`/competitions/${competition.id}`}
    className={`bg-neutral-50 border border-neutral-200/50 rounded-2xl shadow-modern p-5 flex flex-col justify-between hover:shadow-modern-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled}
    style={{ textDecoration: 'none', color: 'inherit' }}
  >
    <div>
      <div className="flex items-center space-x-3 mb-2">
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
      <div className="text-xs text-neutral-500 mb-3">
        <p><span className="font-medium">Start:</span> {formatDate(competition.startDate)}</p>
        <p><span className="font-medium">End:</span> {formatDate(competition.endDate)}</p>
      </div>
    </div>
    <div className="mt-2 flex items-center justify-center px-3 py-1.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-modern bg-primary-600 text-white">
      {actionIcon}
      <span className="ml-2">{actionLabel}</span>
    </div>
  </Link>
);

export default function CompetitionsPage({
  joinedCompetitions,
  availableCompetitions,
  archivedCompetitions,
}: CompetitionsPageProps) {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-4 bg-primary-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
              <TrophyIcon className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              {t('competitions.title')}
            </h1>
          </div>
        </div>

        {/* Joined Competitions */}
        <SectionCard 
          icon={<CheckCircleIcon className="h-6 w-6 text-white" />} 
          title={t('competitions.joined')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {joinedCompetitions.length > 0 ? (
              joinedCompetitions.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  actionLabel={t('competitions.view') || 'View'}
                  actionIcon={<ArrowRightIcon className="h-5 w-5" />}
                />
              ))
            ) : (
              <div className="col-span-full text-center text-neutral-500 py-8">{t('competitions.noJoined')}</div>
            )}
          </div>
        </SectionCard>
        
        {/* Available Competitions */}
        <SectionCard 
          icon={<PlusCircleIcon className="h-6 w-6 text-white" />} 
          title={t('competitions.available')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCompetitions.length > 0 ? (
              availableCompetitions.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  actionLabel={t('competitions.join') || 'Join'}
                  actionIcon={<PlusCircleIcon className="h-5 w-5" />}
                />
              ))
            ) : (
              <div className="col-span-full text-center text-neutral-500 py-8">{t('competitions.noAvailable')}</div>
            )}
          </div>
        </SectionCard>
        
        {/* Archived Competitions */}
        <SectionCard 
          icon={<ArchiveBoxIcon className="h-6 w-6 text-white" />} 
          title={t('competitions.archived')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archivedCompetitions.length > 0 ? (
              archivedCompetitions.map((competition) => (
                <CompetitionCard
                  key={competition.id}
                  competition={competition}
                  actionLabel={t('competitions.viewResults') || 'View Results'}
                  actionIcon={<ArchiveBoxIcon className="h-5 w-5" />}
                />
              ))
            ) : (
              <div className="col-span-full text-center text-neutral-500 py-8">{t('competitions.noArchived')}</div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  
  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  // Fetch all competitions
  const allCompetitions = await prisma.competition.findMany({
    orderBy: {
      startDate: 'desc',
    },
  });

  // Fetch user's bets to determine participation
  const userBets = await prisma.bet.findMany({
    where: { userId: session.user.id },
    select: { game: { select: { competitionId: true } } }
  });
  const betCompetitionIds = Array.from(new Set(userBets.map(bet => bet.game.competitionId)));

  // Filter competitions into three groups
  // Vos Compétitions: Active/Upcoming competitions where user has placed bets
  const joinedCompetitions = allCompetitions.filter((c: Competition) => 
    betCompetitionIds.includes(c.id) && c.status !== 'COMPLETED' && c.status !== 'completed'
  );

  // Compétitions Disponibles: Active/Upcoming competitions where user hasn't placed bets
  const availableCompetitions = allCompetitions.filter((c: Competition) => 
    !betCompetitionIds.includes(c.id) && c.status !== 'COMPLETED' && c.status !== 'completed'
  );

  // Compétitions Archivées: All completed competitions (regardless of participation)
  const archivedCompetitions = allCompetitions.filter((c: Competition) => 
    c.status === 'COMPLETED' || c.status === 'completed'
  );

  return {
    props: {
      ...(await serverSideTranslations('fr', ['common'])),
      joinedCompetitions: JSON.parse(JSON.stringify(joinedCompetitions)),
      availableCompetitions: JSON.parse(JSON.stringify(availableCompetitions)),
      archivedCompetitions: JSON.parse(JSON.stringify(archivedCompetitions)),
    },
  };
}; 