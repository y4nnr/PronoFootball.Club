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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <div className="p-3 bg-primary-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
              <MegaphoneIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900">Toutes les News</h1>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-5 animate-pulse"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-md bg-neutral-200" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-3 bg-neutral-200 rounded" />
                    <div className="w-full h-3 bg-neutral-200 rounded" />
                    <div className="w-3/4 h-3 bg-neutral-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items && items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200/50 p-8 text-center">
            <MegaphoneIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-500">
              Pas encore de news disponibles.
            </p>
          </div>
        )}

        {/* News Items */}
        {!loading && !error && items && items.length > 0 && (
          <div className="space-y-8">
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <h2 className="text-xl font-semibold text-neutral-700 mb-4 pb-2 border-b border-neutral-200">
                  {dateKey}
                </h2>
                <div className="space-y-3">
                  {groupedNews[dateKey].map((item, index) => (
                    <div
                      key={`${item.date}-${item.competition}-${index}`}
                      className="relative bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl p-4 md:p-5 border border-primary-300/60 shadow-modern hover:shadow-modern-lg transition-all duration-300 flex items-start space-x-3"
                    >
                      <div className="flex-shrink-0">
                        {/* Competition logo */}
                        <img
                          src={item.logo}
                          alt={item.competition}
                          className="w-8 h-8 rounded-md object-contain bg-white border border-white/60 shadow-sm"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs md:text-sm text-neutral-600 mb-1 font-medium">
                          {item.competition}
                        </div>
                        <div className="text-sm md:text-base text-neutral-900 leading-relaxed">
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

