import { prisma } from './prisma';

/**
 * Normalize a team name for fuzzy matching against the external API.
 * Handles diacritics, Nordic letters (ø, å, æ) that NFD doesn't decompose,
 * and strips non-alphanumeric so "Bodø/Glimt" and "Bodo/Glimt" collapse to "bodoglimt".
 */
export function normalizeTeamName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o').replace(/å/g, 'a').replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Live-score polling mode.
 *
 *   LIVE        — poll every 20s (as fast as the cron fires). Updates scores, elapsed minute,
 *                 status transitions in real time. Expensive on the external API quota.
 *   FINAL_ONLY  — poll each game only around its scheduled end so we catch the FINAL score with
 *                 the minimum number of API calls. Two-tier schedule:
 *                   • T1 = kickoff + 110 min  → catches FT and most ET endings
 *                   • T2 = kickoff + 150 min  → catches penalties and late ET
 *                 Rugby (no live elapsed minute from the feed) uses T1=100 / T2=120.
 */
export type LiveScoreMode = 'LIVE' | 'FINAL_ONLY';

export const LIVE_SCORE_MODE_KEY = 'liveScoreMode';

/** Read the current mode. Defaults to FINAL_ONLY if nothing is set. */
export async function getLiveScoreMode(): Promise<LiveScoreMode> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: LIVE_SCORE_MODE_KEY } });
    if (row?.value === 'LIVE') return 'LIVE';
    return 'FINAL_ONLY';
  } catch (e) {
    // If the AppSetting table doesn't exist yet (first deploy race), default conservative.
    console.warn('[live-score-mode] fallback to FINAL_ONLY due to error:', e);
    return 'FINAL_ONLY';
  }
}

export async function setLiveScoreMode(mode: LiveScoreMode): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: LIVE_SCORE_MODE_KEY },
    create: { key: LIVE_SCORE_MODE_KEY, value: mode },
    update: { value: mode },
  });
}

/**
 * In FINAL_ONLY mode, decide whether this game is in a polling window right now.
 * Returns `true` if the external API should be queried for this game on the current tick,
 * `false` to skip.
 *
 * We use `game.lastSyncAt` as a cheap "did we poll already in this window?" marker, combined
 * with the current time to determine which of the 4 scheduled polls (football) or 2 (rugby)
 * windows we're in. Each window opens once and the per-game rate-limit prevents repeat polls
 * within the same window.
 *
 * Football cadence (per game, 4 polls total):
 *   P1 kickoff + 95 min  — catches most FT finishes
 *   P2 kickoff + 105 min — late FT + games entering ET
 *   P3 kickoff + 125 min — ET winners
 *   P4 kickoff + 140 min — penalty shootouts
 *
 * Rugby cadence (per game, 2 polls total):
 *   P1 kickoff + 100 min
 *   P2 kickoff + 120 min
 *
 * Hard cap: if a game is still LIVE at kickoff + 240 min we stop polling (abandoned / data error).
 */
const FOOTBALL_POLL_MINUTES = [95, 105, 125, 140] as const;
const RUGBY_POLL_MINUTES = [100, 120] as const;
const HARD_CAP_MINUTES = 240;
const MIN_POLL_SPACING_MINUTES = 8; // between polls on the same game

export function shouldPollForFinalScore(
  game: { date: Date; status: string; lastSyncAt: Date | null },
  sportType: 'FOOTBALL' | 'RUGBY',
  now: Date = new Date()
): boolean {
  if (game.status !== 'UPCOMING' && game.status !== 'LIVE') return false;

  const minutesSinceKickoff = (now.getTime() - game.date.getTime()) / 60_000;
  if (minutesSinceKickoff < 0) return false;
  if (minutesSinceKickoff > HARD_CAP_MINUTES) return false;

  const windows = sportType === 'RUGBY' ? RUGBY_POLL_MINUTES : FOOTBALL_POLL_MINUTES;

  // Find the latest poll window we've crossed; return true only if that window hasn't been
  // polled yet (based on lastSyncAt being older than the window's open time).
  let activeWindow: number | null = null;
  for (const w of windows) {
    if (minutesSinceKickoff >= w) activeWindow = w;
  }
  if (activeWindow === null) return false;

  const windowOpenTime = new Date(game.date.getTime() + activeWindow * 60_000);
  // Already polled during this window → skip.
  if (game.lastSyncAt && game.lastSyncAt >= windowOpenTime) return false;

  // Minimum spacing between any two polls on the same game.
  if (game.lastSyncAt) {
    const minutesSinceLastSync = (now.getTime() - game.lastSyncAt.getTime()) / 60_000;
    if (minutesSinceLastSync < MIN_POLL_SPACING_MINUTES) return false;
  }

  return true;
}
