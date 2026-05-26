import React, { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { MegaphoneIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, XMarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

type NewsItem = {
  date: string;
  competition: string;
  logo: string;
  summary: string;
  matchDayDate: string;
  sportType: string; // FOOTBALL | RUGBY
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

const PAGE_SIZE = 6;

// Format ISO YYYY-MM-DD as DD/MM/YYYY for display
function formatIsoForDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Inline calendar used inside the mobile filter popover (no native picker)
function MiniCalendar({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (iso: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const initial = value
    ? new Date(value + 'T00:00:00')
    : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: Array<{ day: number; iso: string; disabled: boolean; selected: boolean } | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const disabled = (!!minDate && iso < minDate) || (!!maxDate && iso > maxDate);
    cells.push({ day: d, iso, disabled, selected: iso === value });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else { setViewMonth(m => m - 1); }
  };
  const next = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else { setViewMonth(m => m + 1); }
  };

  return (
    <div className="mt-1 p-2 bg-gray-50 dark:bg-[rgb(48,48,48)] rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prev}
          aria-label="Mois précédent"
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[rgb(38,38,38)]"
        >
          <ChevronLeftIcon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={next}
          aria-label="Mois suivant"
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[rgb(38,38,38)]"
        >
          <ChevronRightIcon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => cell ? (
          <button
            key={i}
            type="button"
            disabled={cell.disabled}
            onClick={() => onChange(cell.iso)}
            className={`aspect-square text-xs rounded transition-colors ${
              cell.selected
                ? 'bg-primary-600 dark:bg-accent-dark-600 text-white font-semibold'
                : cell.disabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[rgb(38,38,38)]'
            }`}
          >
            {cell.day}
          </button>
        ) : (
          <div key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<'ALL' | 'FOOTBALL' | 'RUGBY'>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sportFilter, dateFrom, dateTo]);

  const hasActiveFilters = sportFilter !== 'ALL' || dateFrom !== '' || dateTo !== '';
  const activeFilterCount =
    (sportFilter !== 'ALL' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const resetFilters = () => {
    setSportFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  // Mobile filter popover open/close + click-outside dismiss
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [activeMobilePicker, setActiveMobilePicker] = useState<'from' | 'to' | null>(null);
  // Reset the active inline calendar whenever the popover closes
  useEffect(() => {
    if (!mobileFiltersOpen) setActiveMobilePicker(null);
  }, [mobileFiltersOpen]);
  const mobileFiltersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (
        mobileFiltersRef.current &&
        !mobileFiltersRef.current.contains(e.target as Node)
      ) {
        setMobileFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [mobileFiltersOpen]);

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

  // Filter by sport + date range (matchDayDate is ISO; compare YYYY-MM-DD portion)
  const filteredItems = items
    ? items.filter(item => {
        if (sportFilter !== 'ALL' && item.sportType !== sportFilter) return false;
        const isoDay = item.matchDayDate.slice(0, 10);
        if (dateFrom && isoDay < dateFrom) return false;
        if (dateTo && isoDay > dateTo) return false;
        return true;
      })
    : null;

  // Paginate: take only items for current page
  const totalFiltered = filteredItems?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems
    ? filteredItems.slice(startIndex, startIndex + PAGE_SIZE)
    : [];

  // Group paginated news by date
  const groupedNews = paginatedItems.length > 0
    ? paginatedItems.reduce((acc, item) => {
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
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-primary-600 dark:bg-accent-dark-600 rounded-full shadow-lg mr-3 flex items-center justify-center">
                <MegaphoneIcon className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-gray-100">Toutes les News</h1>
            </div>
            {/* Filters - only show when we have items */}
            {!loading && items && items.length > 0 && (
              <>
                {/* Mobile: single compact trigger -> popover */}
                <div ref={mobileFiltersRef} className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(o => !o)}
                    aria-expanded={mobileFiltersOpen}
                    aria-haspopup="dialog"
                    className="inline-flex items-center gap-1.5 bg-white dark:bg-[rgb(58,58,58)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-[rgb(48,48,48)]"
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    Filtres
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold text-white bg-primary-600 dark:bg-accent-dark-600 rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {mobileFiltersOpen && (
                    <div
                      role="dialog"
                      aria-label="Filtres"
                      className="absolute left-0 top-full mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-[rgb(58,58,58)] border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl p-3 space-y-2"
                    >
                      {/* Sport */}
                      <div className="relative">
                        <select
                          aria-label="Filtrer par sport"
                          value={sportFilter}
                          onChange={(e) => setSportFilter(e.target.value as 'ALL' | 'FOOTBALL' | 'RUGBY')}
                          className="appearance-none w-full bg-white dark:bg-[rgb(48,48,48)] border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-10 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-accent-dark-500 dark:focus:border-accent-dark-500"
                        >
                          <option value="ALL">Tous les sports</option>
                          <option value="FOOTBALL">Football</option>
                          <option value="RUGBY">Rugby</option>
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400 pointer-events-none" />
                      </div>

                      {/* Date from - inline (custom calendar, no native picker) */}
                      <button
                        type="button"
                        onClick={() => setActiveMobilePicker(p => p === 'from' ? null : 'from')}
                        aria-expanded={activeMobilePicker === 'from'}
                        className={`relative w-full text-left bg-white dark:bg-[rgb(48,48,48)] border rounded-lg pl-9 pr-9 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                          activeMobilePicker === 'from'
                            ? 'border-primary-500 dark:border-accent-dark-500 ring-2 ring-primary-500 dark:ring-accent-dark-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Du
                        </span>
                        <span className={dateFrom ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                          {dateFrom ? formatIsoForDisplay(dateFrom) : 'jj/mm/aaaa'}
                        </span>
                        <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </button>
                      {activeMobilePicker === 'from' && (
                        <MiniCalendar
                          value={dateFrom}
                          maxDate={dateTo || undefined}
                          onChange={(iso) => {
                            setDateFrom(iso);
                            setActiveMobilePicker(dateTo ? null : 'to');
                          }}
                        />
                      )}

                      {/* Date to - inline */}
                      <button
                        type="button"
                        onClick={() => setActiveMobilePicker(p => p === 'to' ? null : 'to')}
                        aria-expanded={activeMobilePicker === 'to'}
                        className={`relative w-full text-left bg-white dark:bg-[rgb(48,48,48)] border rounded-lg pl-9 pr-9 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                          activeMobilePicker === 'to'
                            ? 'border-primary-500 dark:border-accent-dark-500 ring-2 ring-primary-500 dark:ring-accent-dark-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Au
                        </span>
                        <span className={dateTo ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                          {dateTo ? formatIsoForDisplay(dateTo) : 'jj/mm/aaaa'}
                        </span>
                        <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </button>
                      {activeMobilePicker === 'to' && (
                        <MiniCalendar
                          value={dateTo}
                          minDate={dateFrom || undefined}
                          onChange={(iso) => {
                            setDateTo(iso);
                            setActiveMobilePicker(null);
                          }}
                        />
                      )}

                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 py-1.5 mt-1"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Desktop: row of standalone controls */}
                <div className="hidden sm:flex flex-wrap items-center gap-2">
                {/* Sport */}
                <div className="relative">
                  <label htmlFor="sport-filter" className="sr-only">
                    Filtrer par sport
                  </label>
                  <select
                    id="sport-filter"
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value as 'ALL' | 'FOOTBALL' | 'RUGBY')}
                    className="appearance-none bg-white dark:bg-[rgb(58,58,58)] border border-gray-300 dark:border-gray-600 rounded-lg pl-4 pr-10 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-accent-dark-500 dark:focus:border-accent-dark-500"
                  >
                    <option value="ALL">Tous les sports</option>
                    <option value="FOOTBALL">Football</option>
                    <option value="RUGBY">Rugby</option>
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400 pointer-events-none" />
                </div>

                {/* Date from */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-gray-400 pointer-events-none select-none">
                    Du
                  </span>
                  <input
                    id="date-from"
                    type="date"
                    aria-label="Date de début"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="news-date-input appearance-none bg-white dark:bg-[rgb(58,58,58)] border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-9 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-accent-dark-500 dark:focus:border-accent-dark-500"
                  />
                  <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                </div>

                {/* Date to */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-gray-400 pointer-events-none select-none">
                    Au
                  </span>
                  <input
                    id="date-to"
                    type="date"
                    aria-label="Date de fin"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="news-date-input appearance-none bg-white dark:bg-[rgb(58,58,58)] border border-gray-300 dark:border-gray-600 rounded-lg pl-9 pr-9 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-accent-dark-500 dark:focus:border-accent-dark-500"
                  />
                  <CalendarDaysIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                </div>

                {/* Reset all filters */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    aria-label="Réinitialiser les filtres"
                    className="inline-flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 bg-white dark:bg-[rgb(58,58,58)] border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-[rgb(48,48,48)] dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
                </div>
              </>
            )}
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

        {/* Empty state when sport filter has no results */}
        {!loading && !error && items && items.length > 0 && filteredItems && filteredItems.length === 0 && (
          <div className="bg-white dark:bg-[rgb(58,58,58)] rounded-2xl shadow-2xl border border-neutral-200/50 dark:border-gray-600 p-8 text-center">
            <MegaphoneIcon className="h-12 w-12 text-neutral-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-gray-400">
              Aucune news ne correspond aux filtres sélectionnés.
            </p>
          </div>
        )}

        {/* News Items */}
        {!loading && !error && items && items.length > 0 && filteredItems && filteredItems.length > 0 && (
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

        {/* Pagination - show when more than one page */}
        {!loading && !error && items && items.length > 0 && filteredItems && filteredItems.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[rgb(58,58,58)] text-gray-700 dark:text-gray-200 text-sm font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-[rgb(48,48,48)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-[rgb(58,58,58)]"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              Précédent
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} sur {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[rgb(58,58,58)] text-gray-700 dark:text-gray-200 text-sm font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-[rgb(48,48,48)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-[rgb(58,58,58)]"
            >
              Suivant
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

