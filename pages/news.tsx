import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { MegaphoneIcon } from '@heroicons/react/24/outline';

type NewsItem = {
  date: string;
  competition: string;
  logo: string;
  summary: string;
  matchDayDate: string;
};

// Abbreviate competition names for display (same logic as dashboard News widget)
function abbreviateCompetitionName(competitionName: string): string {
  const name = competitionName.trim();
  const lowerName = name.toLowerCase();
  
  // Remove year patterns (e.g., "2025/26", "2025-26", "2025", "25/26")
  const nameWithoutYear = name
    .replace(/\s*\d{4}(?:\/\d{2}|-\d{2})?\s*/g, '')
    .replace(/\s*\d{2}\/\d{2}\s*/g, '')
    .trim();
  
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

export default function NewsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAllNews() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/news/all', {
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

    fetchAllNews();

    return () => {
      isMounted = false;
    };
  }, []);

  // Group news by date for better organization
  const groupedNews = items
    ? items.reduce((acc, item) => {
        const dateKey = item.date;
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(item);
        return acc;
      }, {} as Record<string, NewsItem[]>)
    : {};

  const sortedDates = Object.keys(groupedNews).sort((a, b) => {
    // Sort dates in descending order (newest first)
    const [dayA, monthA, yearA] = a.split('/').map(Number);
    const [dayB, monthB, yearB] = b.split('/').map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-[rgb(20,20,20)] dark:to-[rgb(24,24,24)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <div className="p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
              <MegaphoneIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-gray-100">Toutes les News</h1>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[rgb(58,58,58)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-600 p-5 animate-pulse"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-md bg-neutral-200 dark:bg-gray-600" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-3 bg-neutral-200 dark:bg-gray-600 rounded" />
                    <div className="w-full h-3 bg-neutral-200 dark:bg-gray-600 rounded" />
                    <div className="w-3/4 h-3 bg-neutral-200 dark:bg-gray-600 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items && items.length === 0 && (
          <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-600 p-8 text-center">
            <MegaphoneIcon className="h-12 w-12 text-neutral-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-gray-400">
              Pas encore de news disponibles.
            </p>
          </div>
        )}

        {/* News Items */}
        {!loading && !error && items && items.length > 0 && (
          <div className="space-y-8">
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <h2 className="text-xl font-semibold text-neutral-700 dark:text-gray-300 mb-4 pb-2 border-b border-neutral-200 dark:border-gray-600">
                  {dateKey}
                </h2>
                <div className="space-y-3">
                  {groupedNews[dateKey].map((item, index) => (
                    <div
                      key={`${item.date}-${item.competition}-${index}`}
                      className="relative bg-white dark:bg-[rgb(58,58,58)] rounded-xl border-2 border-gray-300 dark:border-gray-600 shadow-lg dark:shadow-dark-modern-lg overflow-hidden transition-all duration-300 hover:shadow-xl dark:hover:shadow-dark-xl hover:border-gray-400 dark:hover:border-gray-600"
                    >
                      {/* Header Section - Date & Competition (reuse dashboard News template) */}
                      <div className="flex items-center gap-2 px-3 md:px-4 pt-3 md:pt-4 pb-2.5 md:pb-3 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-[rgb(40,40,40)] dark:to-[rgb(40,40,40)] border-b border-gray-300 dark:border-accent-dark-500">
                        {/* Date pill */}
                        <div className="flex items-center gap-2 flex-shrink-0 bg-white dark:bg-[rgb(38,38,38)] px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 shadow-sm">
                          <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-bold">
                            {item.date}
                          </span>
                        </div>
                        {/* Competition */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <img
                            src={item.logo}
                            alt={item.competition}
                            className="w-6 h-6 md:w-7 md:h-7 dark:w-7 dark:h-7 dark:md:w-8 dark:md:h-8 rounded object-cover border border-gray-300 dark:border-gray-600 flex-shrink-0 shadow-sm dark:bg-white dark:p-0.5"
                          />
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

