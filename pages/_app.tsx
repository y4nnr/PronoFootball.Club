import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from '../contexts/LanguageContext';
import type { AppProps } from "next/app";
import "../styles/globals.css";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { appWithTranslation } from 'next-i18next';

function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <LanguageProvider>
        <div className="bg-white min-h-screen antialiased text-gray-900 flex flex-col">
          <Navbar />
          <main className="pt-24 flex-1">
            <Component {...pageProps} />
          </main>
          <Footer />
        </div>
      </LanguageProvider>
    </SessionProvider>
  );
}

export default appWithTranslation(App);
