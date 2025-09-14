import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from '../contexts/LanguageContext';
import type { AppProps } from "next/app";
import "../styles/globals.css";
import Navbar from '../components/Navbar';
import { appWithTranslation } from 'next-i18next';

function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <LanguageProvider>
        <div className="bg-white min-h-screen antialiased text-gray-900">
          <Navbar />
          <main className="pt-24">
            <Component {...pageProps} />
          </main>
        </div>
      </LanguageProvider>
    </SessionProvider>
  );
}

export default appWithTranslation(App);
