import React, { useEffect, useState } from 'react';
import { MegaphoneIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

type NewsItem = {
  date: string;
  competition: string;
  logo: string;
  summary: string;
};

export default function News() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchNews() {
      try {
        setLoading(true);
        setError(null);

        // Fetch stored news from database (no generation, just read)
        const res = await fetch('/api/generate-news', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch news: ${res.status}`);
        }

        const data: NewsItem[] = await res.json();
        if (isMounted) {
          setItems(data);
        }
      } catch (err) {
        console.error('Error fetching news:', err);
        if (isMounted) {
          setError('Impossible de charger les news pour le moment.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchNews(); // Fetch stored news from database

    return () => {
      isMounted = false;
    };
  }, []);

  const showSkeleton = loading && !items;

  return (
    <section
      className="bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-5"
      style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <MegaphoneIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-neutral-900">News</h2>
        </div>
        {!showSkeleton && !error && items && items.length > 0 && (
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Voir plus
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
      </div>

      {showSkeleton && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
            <div
              key={idx}
              className="relative bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl p-3 md:p-4 border border-primary-300/60 shadow-modern hover:shadow-modern-lg transition-all duration-300 flex items-start space-x-3 animate-pulse"
            >
              <div className="w-7 h-7 rounded-md bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <div className="w-24 h-3 bg-neutral-200 rounded" />
                <div className="w-full h-3 bg-neutral-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!showSkeleton && error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!showSkeleton && !error && items && items.length === 0 && (
        <p className="text-sm text-neutral-500">
          Pas encore de news disponibles pour les dernières journées.
        </p>
      )}

      {!showSkeleton && !error && items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.date}-${index}`}
              className="relative bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl p-3 md:p-4 border border-primary-300/60 shadow-modern hover:shadow-modern-lg transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-1.5">
                {/* Date */}
                <span className="text-xs md:text-sm font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                  {item.date}
                </span>
                {/* Competition logo */}
                <img
                  src={item.logo}
                  alt={item.competition}
                  className="w-7 h-7 rounded-md object-contain bg-white border border-white/60 shadow-sm"
                />
                {/* Competition name */}
                <span className="text-[11px] md:text-xs font-bold text-neutral-700">
                  {item.competition}
                </span>
              </div>
              <div className="text-sm md:text-[15px] text-neutral-900 leading-snug">
                {item.summary}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


