import { getSession } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { CheckCircleIcon, PlusCircleIcon, ArchiveBoxIcon, ArrowRightIcon, TrophyIcon } from '@heroicons/react/24/outline';
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
  <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-2xl shadow-2xl dark:shadow-dark-xl border border-neutral-200/50 dark:border-gray-600 overflow-hidden mb-8" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
    {/* Header Section */}
    <div className="bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500 px-6 py-4">
      <div className="flex items-center">
        <div className="p-2 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-2 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
    </div>
    {/* Content Section */}
    <div className="px-2 md:px-6 py-6">
      {children}
    </div>
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
      <div className="text-xs text-neutral-500 dark:text-gray-400 mb-3">
        <p><span className="font-medium">Start:</span> {formatDate(competition.startDate)}</p>
        <p><span className="font-medium">End:</span> {formatDate(competition.endDate)}</p>
      </div>
      <div className="mt-2 flex items-center justify-center px-3 py-1.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-modern bg-primary-600 dark:bg-transparent border-2 border-transparent dark:border-accent-dark-500 text-white hover:bg-primary-700 dark:hover:bg-accent-dark-500/10">
        {actionIcon}
        <span className="ml-2">{actionLabel}</span>
      </div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10">

        {/* Joined Competitions */}
        <SectionCard 
          icon={<CheckCircleIcon className="h-6 w-6 text-white" />} 
          title={t('competitions.joined')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
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

  // Fetch user's competition participation via CompetitionUser table
  const userCompetitions = await prisma.competitionUser.findMany({
    where: { userId: session.user.id },
    select: { competitionId: true }
  });
  const userCompetitionIds = userCompetitions.map(cu => cu.competitionId);

  // Filter competitions into three groups
  // Vos Compétitions: Active/Upcoming competitions where user is a member
  const joinedCompetitions = allCompetitions.filter((c: Competition) => 
    userCompetitionIds.includes(c.id) && c.status !== 'COMPLETED' && c.status !== 'completed'
  );

  // Compétitions Disponibles: Active/Upcoming competitions where user is not a member
  const availableCompetitions = allCompetitions.filter((c: Competition) => 
    !userCompetitionIds.includes(c.id) && c.status !== 'COMPLETED' && c.status !== 'completed'
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