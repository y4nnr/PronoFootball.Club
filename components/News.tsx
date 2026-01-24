import React, { useEffect, useState } from 'react';
import { MegaphoneIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

type NewsItem = {
  date: string;
  competition: string;
  logo: string;
  summary: string;
};

// Abbreviate competition names for mobile display
function abbreviateCompetitionName(competitionName: string): string {
  const name = competitionName.trim();
  const lowerName = name.toLowerCase();
  
  // Remove year patterns (e.g., "2025/26", "2025-26", "2025", "25/26")
  const nameWithoutYear = name.replace(/\s*\d{4}(?:\/\d{2}|-\d{2})?\s*/g, '').replace(/\s*\d{2}\/\d{2}\s*/g, '').trim();
  
  // Champions League variations
  if (lowerName.includes('champions league')) {
    return 'Champions League';
  }
  
  // Ligue 1
  if (lowerName.includes('ligue 1')) {
    return 'Ligue 1';
  }
  
  // Top 14
  if (lowerName.includes('top 14')) {
    return 'Top 14';
  }
  
  // 6 Nations
  if (lowerName.includes('6 nations') || lowerName.includes('six nations')) {
    return '6 Nations';
  }
  
  // For other competitions, return name without year
  return nameWithoutYear || name;
}

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
      className="bg-white dark:bg-[rgb(38,38,38)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-700 p-5"
      style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
            <MegaphoneIcon className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-gray-100">News</h2>
        </div>
        {!showSkeleton && !error && items && items.length > 0 && (
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-primary-600 dark:bg-accent-dark-600 hover:bg-primary-700 dark:hover:bg-accent-dark-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
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
              className="relative bg-white dark:bg-[rgb(38,38,38)] rounded-xl border-2 border-gray-300 dark:border-gray-700 shadow-lg overflow-hidden animate-pulse"
            >
              {/* Header skeleton */}
              <div className="flex items-center gap-2 px-3 md:px-4 pt-3 md:pt-4 pb-2.5 md:pb-3 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500">
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-gray-300 dark:bg-gray-600" />
                  <div className="w-24 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
                </div>
              </div>
              {/* Content skeleton */}
              <div className="px-3 md:px-4 py-3 md:py-4 space-y-2">
                <div className="w-full h-3 bg-gray-200 dark:bg-[rgb(40,40,40)] rounded" />
                <div className="w-5/6 h-3 bg-gray-200 dark:bg-[rgb(40,40,40)] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!showSkeleton && error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {!showSkeleton && !error && items && items.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-gray-400">
          Pas encore de news disponibles pour les dernières journées.
        </p>
      )}

      {!showSkeleton && !error && items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.date}-${index}`}
              className="relative bg-white dark:bg-[rgb(38,38,38)] rounded-xl border-2 border-gray-300 dark:border-gray-700 shadow-lg dark:shadow-dark-modern-lg overflow-hidden transition-all duration-300 hover:shadow-xl dark:hover:shadow-dark-xl hover:border-gray-400 dark:hover:border-gray-600"
            >
              {/* Header Section - Date & Competition (similar to GameCard) */}
              <div className="flex items-center gap-2 px-3 md:px-4 pt-3 md:pt-4 pb-2.5 md:pb-3 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500">
                {/* Date */}
                <div className="flex items-center gap-2 flex-shrink-0 bg-white dark:bg-[rgb(38,38,38)] px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 shadow-sm">
                  <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-900 dark:text-gray-100 font-bold">
                    {item.date}
                  </span>
                </div>
                {/* Competition - aligned right after date */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Competition logo */}
                  <img
                    src={item.logo}
                    alt={item.competition}
                    className="w-6 h-6 md:w-7 md:h-7 dark:w-7 dark:h-7 dark:md:w-8 dark:md:h-8 rounded object-cover border border-gray-300 dark:border-gray-600 flex-shrink-0 shadow-sm dark:bg-white dark:p-0.5"
                  />
                  {/* Competition name */}
                  <span className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold truncate">
                    {abbreviateCompetitionName(item.competition)}
                  </span>
                </div>
              </div>
              {/* Content Section */}
              <div className="px-3 md:px-4 py-3 md:py-4">
                <div className="text-sm md:text-[15px] text-neutral-900 dark:text-gray-200 leading-snug">
                  {item.summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


