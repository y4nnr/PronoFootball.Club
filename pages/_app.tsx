import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from '../contexts/LanguageContext';
import type { AppProps } from "next/app";
import { useRouter } from 'next/router';
import "../styles/globals.css";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { appWithTranslation } from 'next-i18next';

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLoginPage = router.pathname === '/' || router.pathname === '/login';
  const isAboutPage = router.pathname === '/about';
  const isBettingPage = router.pathname.startsWith('/betting');
  
  return (
    <SessionProvider session={pageProps.session}>
      <LanguageProvider>
        <div className={`min-h-screen antialiased text-gray-900 flex flex-col ${isLoginPage || isAboutPage ? 'bg-neutral-900' : 'bg-white'}`}>
          <Navbar />
          <main className={`${isLoginPage || isAboutPage ? '' : isBettingPage ? 'pt-24 pb-16 md:pb-0' : 'pt-16 pb-16 md:pt-24 md:pb-0'} flex-1`}>
            <Component {...pageProps} />
          </main>
          {!isLoginPage && !isAboutPage && <div className="hidden md:block"><Footer /></div>}
        </div>
      </LanguageProvider>
    </SessionProvider>
  );
}

export default appWithTranslation(App);
