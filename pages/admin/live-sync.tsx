import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import React from "react";

interface ExternalMatch {
  id: number | null;
  status: string | null;
  externalStatus: string | null;
  elapsedMinute: number | null;
  homeTeam: {
    id: number | null;
    name: string | null;
  };
  awayTeam: {
    id: number | null;
    name: string | null;
  };
  score: {
    home: number | null;
    away: number | null;
  };
  date: string | null;
  competition: {
    id: number | null;
    name: string | null;
  };
}

interface LiveSyncGame {
  id: string;
  date: string;
  status: string;
  externalStatus: string | null;
  elapsedMinute: number | null;
  externalId: string | null;
  lastSyncAt: string | null;
  liveHomeScore: number | null;
  liveAwayScore: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
  };
  competition: {
    id: string;
    name: string;
    sportType: string;
  };
  externalMatch?: ExternalMatch | null;
}

interface ApiResponse {
  games: LiveSyncGame[];
  error?: string;
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).toString().slice(-2);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export default function AdminLiveSync() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [games, setGames] = useState<LiveSyncGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [loadingExternal, setLoadingExternal] = useState<Set<string>>(new Set());
  const [resettingGame, setResettingGame] = useState<string | null>(null);

  const [sportType, setSportType] = useState<"ALL" | "FOOTBALL" | "RUGBY">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UPCOMING" | "LIVE" | "FINISHED" | "CANCELLED">("ALL");
  const [minutesBack, setMinutesBack] = useState<number>(180);
  const [limit, setLimit] = useState<number>(200);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (
      status === "authenticated" &&
      (session?.user as { role?: string })?.role?.toLowerCase() !== "admin"
    ) {
      router.push("/dashboard");
    }
  }, [status, router, session]);

  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (sportType !== "ALL") params.set("sportType", sportType);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("minutes", String(minutesBack));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/live-sync-games?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch live sync games");
      }
      const data: ApiResponse = await res.json();
      if ((data as any).error) {
        throw new Error((data as any).error);
      }
      setGames(data.games);
    } catch (err) {
      console.error("[ADMIN LIVE SYNC] Error fetching games:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch live sync games"
      );
    } finally {
      setLoading(false);
    }
  }, [sportType, statusFilter, minutesBack, limit]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchGames();
    }
  }, [status, fetchGames]);

  const fetchExternalMatch = async (game: LiveSyncGame) => {
    if (loadingExternal.has(game.id)) return;
    
    setLoadingExternal(prev => new Set(prev).add(game.id));
    
    try {
      const params = new URLSearchParams();
      if (game.externalId) {
        params.set('externalId', game.externalId);
        // Also pass gameId and sportType so endpoint can determine which API to use
        params.set('gameId', game.id);
        params.set('sportType', game.competition.sportType);
      } else {
        params.set('gameId', game.id);
        params.set('sportType', game.competition.sportType);
      }
      
      const res = await fetch(`/api/admin/live-sync-external-match?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch external match');
      }
      
      const data = await res.json();
      
      setGames(prevGames => 
        prevGames.map(g => 
          g.id === game.id 
            ? { ...g, externalMatch: data.externalMatch }
            : g
        )
      );
    } catch (err) {
      console.error('[ADMIN LIVE SYNC] Error fetching external match:', err);
      setGames(prevGames => 
        prevGames.map(g => 
          g.id === game.id 
            ? { ...g, externalMatch: null }
            : g
        )
      );
    } finally {
      setLoadingExternal(prev => {
        const next = new Set(prev);
        next.delete(game.id);
        return next;
      });
    }
  };

  const handleResetGame = async (gameId: string) => {
    if (!confirm('Reset this game? This will clear all scores, set status to UPCOMING, and clear external ID.')) {
      return;
    }
    
    setResettingGame(gameId);
    try {
      const game = games.find(g => g.id === gameId);
      if (!game) {
        throw new Error('Game not found');
      }
      
      const response = await fetch(`/api/admin/games/${gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeamId: game.homeTeam.id,
          awayTeamId: game.awayTeam.id,
          date: game.date,
          homeScore: null,
          awayScore: null,
          status: 'UPCOMING',
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset game');
      }
      
      // Refresh games list
      fetchGames();
    } catch (err) {
      console.error('[ADMIN LIVE SYNC] Error resetting game:', err);
      alert(err instanceof Error ? err.message : 'Failed to reset game');
    } finally {
      setResettingGame(null);
    }
  };

  const toggleExpand = (gameId: string, game: LiveSyncGame) => {
    if (expandedGames.has(gameId)) {
      setExpandedGames(prev => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    } else {
      setExpandedGames(prev => new Set(prev).add(gameId));
      if (!game.externalMatch && !loadingExternal.has(gameId)) {
        fetchExternalMatch(game);
      }
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900">
        <div className="text-white text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[rgb(20,20,20)] text-gray-900 dark:text-white">
      <header className="border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-[rgb(20,20,20)] px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Live Score Sync – Admin Monitor
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Surveillez la synchronisation des scores en direct</p>
          </div>
          <Link
            href="/admin/competitions"
            className="text-sm text-primary-600 dark:text-accent-dark-400 hover:text-primary-700 dark:hover:text-accent-dark-300 font-medium"
          >
            ← Retour Admin
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-6 bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-600">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm mb-2 font-medium text-gray-700 dark:text-gray-300">Sport</label>
              <select
                className="w-full bg-white dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                value={sportType}
                onChange={(e) =>
                  setSportType(e.target.value as "ALL" | "FOOTBALL" | "RUGBY")
                }
              >
                <option value="ALL">All</option>
                <option value="FOOTBALL">Football</option>
                <option value="RUGBY">Rugby</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Status</label>
              <select
                className="w-full bg-white dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as
                      | "ALL"
                      | "UPCOMING"
                      | "LIVE"
                      | "FINISHED"
                      | "CANCELLED"
                  )
                }
              >
                <option value="ALL">All</option>
                <option value="UPCOMING">UPCOMING</option>
                <option value="LIVE">LIVE</option>
                <option value="FINISHED">FINISHED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">
                Look-back window (minutes)
              </label>
              <input
                type="number"
                min={10}
                max={1440}
                className="w-full bg-white dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                value={minutesBack}
                onChange={(e) => setMinutesBack(Number(e.target.value) || 60)}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Max games</label>
              <input
                type="number"
                min={10}
                max={500}
                className="w-full bg-white dark:bg-[rgb(40,40,40)] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 200)}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={fetchGames}
              className="px-4 py-2 text-sm rounded-lg bg-primary-600 dark:bg-accent-dark-600 text-white hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition-colors font-medium"
            >
              Refresh
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400 self-center">
              Showing games with a non-null <code>lastSyncAt</code> ordered by
              most recent sync.
            </span>
          </div>
        </section>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm rounded-lg px-4 py-3 text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[rgb(20,20,20)]/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Live Sync Games</h2>
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              {loading ? "Loading…" : `${games.length} games`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[rgb(20,20,20)]/50 text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">Last Sync</th>
                  <th className="px-3 py-2 text-left">Kickoff</th>
                  <th className="px-3 py-2 text-left">Competition</th>
                  <th className="px-3 py-2 text-left">Teams</th>
                  <th className="px-3 py-2 text-left">Scores</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">External</th>
                  <th className="px-3 py-2 text-left">Game ID</th>
                </tr>
              </thead>
                  <tbody className="bg-white dark:bg-[rgb(38,38,38)] divide-y divide-gray-200 dark:divide-gray-600">
                {games.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-6 text-center text-gray-500 dark:text-gray-400"
                    >
                      No games found in the selected window.
                    </td>
                  </tr>
                )}
                {games.map((g) => {
                  const liveScore =
                    g.liveHomeScore !== null && g.liveAwayScore !== null
                      ? `${g.liveHomeScore}-${g.liveAwayScore}`
                      : "-";
                  const finalScore =
                    g.homeScore !== null && g.awayScore !== null
                      ? `${g.homeScore}-${g.awayScore}`
                      : "-";
                  const hasPotentialIssue =
                    g.status === "FINISHED" &&
                    g.externalStatus &&
                    (g.liveHomeScore === null ||
                      g.liveAwayScore === null ||
                      g.homeScore === null ||
                      g.awayScore === null);

                  const isExpanded = expandedGames.has(g.id);
                  const isLoadingExt = loadingExternal.has(g.id);
                  
                  return (
                    <React.Fragment key={g.id}>
                      <tr
                        className={`border-t border-gray-200 dark:border-gray-700 ${
                          hasPotentialIssue
                            ? "bg-red-50 dark:bg-red-900/20"
                            : g.status === "LIVE"
                            ? "bg-blue-50 dark:bg-blue-900/10"
                            : "bg-white dark:bg-[rgb(38,38,38)] hover:bg-gray-50 dark:hover:bg-[rgb(40,40,40)]"
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <button
                            onClick={() => toggleExpand(g.id, g)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            title={isExpanded ? "Hide external data" : "Show external API data"}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top text-gray-900 dark:text-gray-100">
                          {formatDateTime(g.lastSyncAt)}
                        </td>
                        <td className="px-3 py-2 align-top text-gray-900 dark:text-gray-100">
                          {formatDateTime(g.date)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {g.competition.name}
                          </div>
                          <div className="text-[10px] text-gray-600 dark:text-gray-400">
                            {g.competition.sportType}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-gray-900 dark:text-gray-100">
                          <div>
                            {g.homeTeam.name}
                            {g.homeTeam.shortName
                              ? ` (${g.homeTeam.shortName})`
                              : ""}
                          </div>
                          <div>
                            {g.awayTeam.name}
                            {g.awayTeam.shortName
                              ? ` (${g.awayTeam.shortName})`
                              : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-gray-900 dark:text-gray-100">
                            <span className="text-gray-600 dark:text-gray-400 mr-1">Live:</span>
                            {liveScore}
                          </div>
                          <div className="text-gray-900 dark:text-gray-100">
                            <span className="text-gray-600 dark:text-gray-400 mr-1">Final:</span>
                            {finalScore}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-white">{g.status}</span>
                            {hasPotentialIssue && (
                              <span className="ml-1 text-[10px] text-red-600 dark:text-red-400">
                                (incomplete scores)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-600 dark:text-gray-400">
                            elapsed:{" "}
                            {g.elapsedMinute !== null
                              ? `${g.elapsedMinute}'`
                              : "-"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-[11px] text-gray-900 dark:text-gray-100">
                            status: {g.externalStatus || "-"}
                          </div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-400">
                            extId: {g.externalId || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <code className="text-[10px] break-all text-gray-700 dark:text-gray-300">{g.id}</code>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 dark:bg-[rgb(20,20,20)]/50 border-t border-gray-200 dark:border-gray-600">
                          <td colSpan={9} className="px-3 py-4">
                            {isLoadingExt ? (
                              <div className="text-sm text-gray-600 dark:text-gray-400">Loading external match data...</div>
                            ) : g.externalMatch ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">External API Data Comparison</h3>
                                  <button
                                    onClick={() => handleResetGame(g.id)}
                                    disabled={resettingGame === g.id}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {resettingGame === g.id ? 'Resetting...' : 'Reset Game'}
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div className="bg-gray-100 dark:bg-[rgb(38,38,38)] rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Our Database</h4>
                                    <div className="space-y-1 text-gray-700 dark:text-gray-300">
                                      <div><span className="text-gray-600 dark:text-gray-400">Teams:</span> <span className="text-gray-900 dark:text-white">{g.homeTeam.name} vs {g.awayTeam.name}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Competition:</span> <span className="text-gray-900 dark:text-white">{g.competition.name}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Status:</span> <span className="text-gray-900 dark:text-white">{g.status}</span> {g.externalStatus && <span className="text-gray-600 dark:text-gray-400">({g.externalStatus})</span>}</div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Elapsed:</span> <span className="text-gray-900 dark:text-white">{g.elapsedMinute !== null ? `${g.elapsedMinute}'` : "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Live Score:</span> <span className="text-gray-900 dark:text-white">{g.liveHomeScore !== null && g.liveAwayScore !== null ? `${g.liveHomeScore}-${g.liveAwayScore}` : "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Final Score:</span> <span className="text-gray-900 dark:text-white">{g.homeScore !== null && g.awayScore !== null ? `${g.homeScore}-${g.awayScore}` : "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">External ID:</span> <span className="text-gray-900 dark:text-white">{g.externalId || "-"}</span></div>
                                    </div>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-[rgb(38,38,38)] rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">External API</h4>
                                    <div className="space-y-1 text-gray-700 dark:text-gray-300">
                                      <div><span className="text-gray-600 dark:text-gray-400">Teams:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.homeTeam.name || "-"} vs {g.externalMatch.awayTeam.name || "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Competition:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.competition.name || "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Status:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.status || "-"}</span> {g.externalMatch.externalStatus && <span className="text-gray-600 dark:text-gray-400">({g.externalMatch.externalStatus})</span>}</div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Elapsed:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.elapsedMinute !== null ? `${g.externalMatch.elapsedMinute}'` : "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Score:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.score.home !== null && g.externalMatch.score.away !== null ? `${g.externalMatch.score.home}-${g.externalMatch.score.away}` : "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">External ID:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.id || "-"}</span></div>
                                      <div><span className="text-gray-600 dark:text-gray-400">Date:</span> <span className="text-gray-900 dark:text-white">{g.externalMatch.date ? formatDateTime(g.externalMatch.date) : "-"}</span></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 text-xs">
                                  {g.externalMatch.id && g.externalId && g.externalMatch.id.toString() !== g.externalId ? (
                                    <div className="text-yellow-400 bg-yellow-900/20 border border-yellow-700 rounded p-2">
                                      ⚠️ External ID mismatch: Our DB has {g.externalId}, API has {g.externalMatch.id}
                                    </div>
                                  ) : g.externalMatch.id && !g.externalId ? (
                                    <div className="text-blue-400 bg-blue-900/20 border border-blue-700 rounded p-2">
                                      ℹ️ External ID found in API ({g.externalMatch.id}) but not stored in our DB
                                    </div>
                                  ) : null}
                                  {g.externalMatch.homeTeam.name && g.externalMatch.awayTeam.name && 
                                   (g.externalMatch.homeTeam.name.toLowerCase() !== g.homeTeam.name.toLowerCase() ||
                                    g.externalMatch.awayTeam.name.toLowerCase() !== g.awayTeam.name.toLowerCase()) ? (
                                    <div className="text-orange-400 bg-orange-900/20 border border-orange-700 rounded p-2 mt-2">
                                      ⚠️ <strong>Team name mismatch detected!</strong>
                                      <div className="mt-1 text-xs">
                                        Our DB: <span className="text-white">{g.homeTeam.name}</span> vs <span className="text-white">{g.awayTeam.name}</span>
                                        <br />
                                        External API: <span className="text-white">{g.externalMatch.homeTeam.name}</span> vs <span className="text-white">{g.externalMatch.awayTeam.name}</span>
                                      </div>
                                    </div>
                                  ) : null}
                                  {g.externalMatch.score.home !== null && g.externalMatch.score.away !== null &&
                                   g.liveHomeScore !== null && g.liveAwayScore !== null &&
                                   (g.externalMatch.score.home !== g.liveHomeScore || g.externalMatch.score.away !== g.liveAwayScore) ? (
                                    <div className="text-red-400 bg-red-900/20 border border-red-700 rounded p-2 mt-2">
                                      ⚠️ Score mismatch: Our DB {g.liveHomeScore}-{g.liveAwayScore} vs API {g.externalMatch.score.home}-{g.externalMatch.score.away}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-neutral-400">External match data not found</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

