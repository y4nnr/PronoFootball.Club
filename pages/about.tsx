import Link from 'next/link';
import Image from 'next/image';
import Footer from '../components/Footer';
import logoPng from '../logo.png';

export default function About() {
  return (
    <div className="text-white relative flex flex-col" style={{ minHeight: '100vh', height: '100vh' }}>
      {/* Background image for both mobile and desktop */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/bck-mob.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          willChange: 'auto',
        }}
      >
        {/* Gradient overlay for better text readability - consistent across all screen sizes */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-gray-900/70 via-gray-900/60 to-gray-900/70"
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
          }}
        />
        {/* Static gradient overlay - no animation to prevent re-renders */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20"
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
          }}
        />
      </div>
      
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Top banner */}
        <header
          className="fixed top-0 left-0 w-full bg-gray-800 backdrop-blur-lg shadow-2xl border-b-2 border-white z-40"
          style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center text-white hover:text-white transition-colors select-none flex-shrink-0">
              <div className="flex items-center justify-center mt-2 tablet:mt-3 xl:mt-4 -ml-6 tablet:-ml-8 xl:-ml-20 2xl:-ml-24">
                <Image
                  src={logoPng}
                  alt="Toopil"
                  width={300}
                  height={300}
                  priority
                  className="w-48 h-48 tablet:w-60 tablet:h-60 xl:w-[336px] xl:h-[336px] 2xl:w-96 2xl:h-96 object-contain transition-transform duration-200 hover:scale-105"
                />
              </div>
            </Link>
            <Link href="/" className="text-white hover:text-gray-200 text-sm sm:text-base font-medium transition-colors">
              Accueil
            </Link>
          </div>
        </header>
        
        {/* Main content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex-1 flex items-start justify-center overflow-y-auto" style={{ paddingTop: 'clamp(5rem, 12vh, 10rem)', paddingBottom: '2rem' }}>
          <div className="relative max-w-3xl w-full px-3" style={{ marginTop: 'clamp(1rem, 3vh, 3rem)' }}>
            {/* About Card */}
            <div 
              className="bg-gradient-to-br from-gray-900/60 via-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-2xl border border-white/20"
              style={{ 
                padding: 'clamp(1.5rem, 4vh, 2.5rem)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
                  À propos de Toopil
                </h1>
              </div>
              
              <div className="space-y-6 text-gray-200">
                <section>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">Notre mission</h2>
                  <p className="text-sm sm:text-base leading-relaxed">
                    Toopil est une plateforme de pronostics football et rugby qui permet aux passionnés de sport de créer des compétitions privées entre amis, de placer des pronostics sur les matchs et de suivre leurs performances en temps réel. Notre objectif est de rendre l'expérience des pronostics football et rugby amusante, compétitive et accessible à tous.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">Ce que nous proposons</h2>
                  <ul className="space-y-3 text-sm sm:text-base">
                    <li className="flex items-start">
                      <span className="text-primary-400 mr-2">⚽</span>
                      <span><strong className="text-white">Pronostics de matchs</strong> - Prédisez les scores des matchs avant le coup d'envoi et suivez les résultats en direct</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary-400 mr-2">🏆</span>
                      <span><strong className="text-white">Compétitions privées</strong> - Créez et gérez vos propres ligues entre amis avec plusieurs compétitions simultanées</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary-400 mr-2">📊</span>
                      <span><strong className="text-white">Classements et statistiques</strong> - Suivez votre progression avec des classements en temps réel et des statistiques détaillées</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary-400 mr-2">⚡</span>
                      <span><strong className="text-white">Scores en direct</strong> - Recevez des mises à jour automatiques pendant les matchs pour suivre l'évolution en temps réel</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary-400 mr-2">👥</span>
                      <span><strong className="text-white">Gestion simple</strong> - Interface intuitive pour créer des compétitions, inviter des joueurs et gérer vos ligues</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">Comment utiliser Toopil</h2>
                  <div className="space-y-4 text-sm sm:text-base">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">1. Créez votre compte</h3>
                      <p className="leading-relaxed">Inscrivez-vous gratuitement en quelques clics. Votre compte sera activé par un administrateur pour garantir la qualité de notre communauté.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">2. Rejoignez ou créez une compétition</h3>
                      <p className="leading-relaxed">Participez à des compétitions existantes ou créez votre propre ligue privée et invitez vos amis à vous rejoindre.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">3. Placez vos pronostics</h3>
                      <p className="leading-relaxed">Avant chaque match, prédisez le score final. Plus votre pronostic est précis, plus vous gagnez de points !</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">4. Suivez votre classement</h3>
                      <p className="leading-relaxed">Consultez en temps réel votre position dans le classement, vos statistiques et votre progression au fil des matchs.</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">Système de points</h2>
                  <div className="space-y-2 text-sm sm:text-base">
                    <p className="leading-relaxed">
                      <strong className="text-white">Score exact</strong> - Gagnez le maximum de points lorsque vous prédisez le score exact du match
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-white">Bon résultat</strong> - Obtenez des points si vous avez prédit la bonne tendance (victoire de l'équipe à domicile, match nul, ou victoire de l'équipe à l'extérieur)
                    </p>
                    <p className="leading-relaxed">
                      <strong className="text-white">Aucun point</strong> - Si votre pronostic ne correspond pas au résultat final, vous n'obtenez pas de points
                    </p>
                  </div>
                </section>
              </div>

              <div className="mt-8 pt-6 border-t border-white/20 text-center">
                <Link 
                  href="/"
                  className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Retour à l'accueil
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-auto">
        <Footer />
      </div>
    </div>
  );
}

