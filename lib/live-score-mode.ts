import { prisma } from './prisma';

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
 * We use `game.lastSyncAt` as a cheap "did we poll already in this window?" marker.
 * Windows are open-ended on the right (once T1 passes, we keep trying until a tick picks it up)
 * but we rate-limit per game to one poll every 5 min to avoid wasting calls when the cron fires
 * every 20s.
 */
export function shouldPollForFinalScore(
  game: { date: Date; status: string; lastSyncAt: Date | null },
  sportType: 'FOOTBALL' | 'RUGBY',
  now: Date = new Date()
): boolean {
  // Only check UPCOMING / LIVE games — once FINISHED we never poll again.
  if (game.status !== 'UPCOMING' && game.status !== 'LIVE') return false;

  const minutesSinceKickoff = (now.getTime() - game.date.getTime()) / 60_000;
  const T1 = sportType === 'RUGBY' ? 100 : 110;
  const T2 = sportType === 'RUGBY' ? 120 : 150;
  // Hard cap: if we're beyond kickoff + 240 min and still haven't got a FINISHED, stop trying.
  const HARD_CAP = 240;

  if (minutesSinceKickoff < T1) return false;
  if (minutesSinceKickoff > HARD_CAP) return false;

  // Rate-limit: don't poll the same game more than once every 5 minutes.
  if (game.lastSyncAt) {
    const minutesSinceLastSync = (now.getTime() - game.lastSyncAt.getTime()) / 60_000;
    if (minutesSinceLastSync < 5) return false;
  }

  // In the T1 window (T1 ≤ x < T2): poll on the first tick that enters the window, then wait.
  // In the T2 window (x ≥ T2): poll until FINISHED or HARD_CAP.
  // The 5-min rate-limit covers both cases; just return true if we've reached T1.
  return minutesSinceKickoff >= T1;
}
