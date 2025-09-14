import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useLanguage } from '../contexts/LanguageContext';
import Link from 'next/link';
import axios, { AxiosResponse } from 'axios';

export default function MyCompetitionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const [joinedOngoing, setJoinedOngoing] = useState<Competition[]>([]);
  const [openNotJoined, setOpenNotJoined] = useState<Competition[]>([]);
  const [joinedTerminated, setJoinedTerminated] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

interface Competition {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
}

  const translations = {
    fr: {
      title: 'Mes Pronostics',
      betPlaced: 'Pronostic placé',
      noBetYet: 'Pas encore de pronostic',
      openForPredictions: 'Pronostics ouverts',
      closed: 'Fermé',
      yourPrediction: 'Votre Pronostic',
      betConfirmed: 'Pronostic confirmé',
      saving: 'Enregistrement...',
      updateBet: 'Modifier',
      placeBet: 'Placer un pronostic',
      allPredictions: 'Tous les Pronostics',
      otherPredictions: 'Autres Pronostics',
      noOtherPredictions: "Pas encore d'autres pronostics",
      betSaved: 'Pronostic enregistré !',
      loading: 'Chargement...',
      error: 'Erreur',
      betCount: {
        one: 'personne a placé un pronostic',
        other: 'personnes ont placé un pronostic'
      }
    },
    en: {
      title: 'My Predictions',
      betPlaced: 'Bet placed',
      noBetYet: 'No bet yet',
      openForPredictions: 'Open for predictions',
      closed: 'Closed',
      yourPrediction: 'Your Prediction',
      betConfirmed: 'Bet confirmed',
      saving: 'Saving...',
      updateBet: 'Update Bet',
      placeBet: 'Place Bet',
      allPredictions: 'All Predictions',
      otherPredictions: 'Other Predictions',
      noOtherPredictions: 'No other predictions yet',
      betSaved: 'Bet saved!',
      loading: 'Loading...',
      error: 'Error',
      betCount: {
        one: 'person has placed a bet',
        other: 'people have placed a bet'
      }
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    axios.get('/api/competitions/my').then((res: AxiosResponse<{ joinedOngoing: Competition[]; openNotJoined: Competition[]; joinedTerminated: Competition[] }>) => {
      setJoinedOngoing(res.data.joinedOngoing);
      setOpenNotJoined(res.data.openNotJoined);
      setJoinedTerminated(res.data.joinedTerminated);
      setLoading(false);
    });
  }, [session]);

  const handleJoin = async (competitionId: string) => {
    await axios.post(`/api/competitions/join`, { competitionId });
    // Refresh lists
    const res = await axios.get('/api/competitions/my');
    setJoinedOngoing(res.data.joinedOngoing);
    setOpenNotJoined(res.data.openNotJoined);
    setJoinedTerminated(res.data.joinedTerminated);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-800">{translations[language].loading}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">{translations[language].title}</h1>
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{language === 'fr' ? 'Compétitions en Cours' : 'Ongoing Competitions'}</h2>
        {joinedOngoing.length === 0 ? <p>{language === 'fr' ? 'Aucune compétition en cours.' : 'No ongoing competitions.'}</p> : (
          <ul>
            {joinedOngoing.map((comp: Competition) => (
              <li key={comp.id} className="mb-2">
                <Link href={`/competitions/${comp.id}`} className="text-blue-600 underline">{comp.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{language === 'fr' ? 'Compétitions Ouvertes' : 'Open Competitions'}</h2>
        {openNotJoined.length === 0 ? <p>{language === 'fr' ? 'Aucune compétition ouverte à rejoindre.' : 'No open competitions to join.'}</p> : (
          <ul>
            {openNotJoined.map((comp: Competition) => (
              <li key={comp.id} className="mb-2 flex items-center gap-2">
                <span>{comp.name}</span>
                <button className="ml-2 px-2 py-1 bg-green-600 text-white rounded" onClick={() => handleJoin(comp.id)}>
                  {language === 'fr' ? 'Rejoindre' : 'Join'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">{language === 'fr' ? 'Compétitions Terminées' : 'Terminated Competitions'}</h2>
        {joinedTerminated.length === 0 ? <p>{language === 'fr' ? 'Aucune compétition terminée.' : 'No terminated competitions.'}</p> : (
          <ul>
            {joinedTerminated.map((comp: Competition) => (
              <li key={comp.id} className="mb-2">
                <Link href={`/competitions/${comp.id}`} className="text-blue-600 underline">{comp.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
} 
