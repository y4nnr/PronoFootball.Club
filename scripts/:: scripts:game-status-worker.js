// scripts/game-status-worker.js
// Node worker that flips UPCOMING games to LIVE exactly at kickoff (UTC),
// with a 60s safety sweep and single-leader coordination via advisory locks.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Leader lock (avoid two workers doing the same work) -------------------

const LOCK_NS = 'pfb:game-status-worker'; // any stable string

async function tryBecomeLeader() {
  // Use the (int,int) variant to avoid bigint casting issues
  const [{ got_lock }] = await prisma.$queryRaw`
    SELECT pg_try_advisory_lock(hashtext(${LOCK_NS})::int, 1::int) AS got_lock
  `;
  return !!got_lock;
}

async function releaseLeader() {
  try {
    await prisma.$queryRaw`
      SELECT pg_advisory_unlock(hashtext(${LOCK_NS})::int, 1::int)
    `;
  } catch {}
}

// ---- Core flipping logic ----------------------------------------------------

/**
 * Flip all UPCOMING games whose UTC start time has passed.
 * Uses DB-side NOW() (UTC on the timestamp-with-time-zone column).
 */
async function flipDueGames() {
  const updated = await prisma.$executeRaw`
    UPDATE "Game"
    SET "status" = 'LIVE'
    WHERE "status" = 'UPCOMING'
      AND "date" <= NOW()
  `;
  if (updated > 0) {
    console.log(`✅ Flipped ${updated} game(s) to LIVE at ${new Date().toISOString()}`);
  } else {
    console.log('✅ No games need status updates');
  }
  return updated;
}

/**
 * Get the next UPCOMING kickoff strictly after NOW() (UTC).
 */
async function getNextKickoff() {
  const rows = await prisma.$queryRaw`
    SELECT MIN("date") AS next_date
    FROM "Game"
    WHERE "status" = 'UPCOMING'
      AND "date" > NOW()
  `;
  const next = rows?.[0]?.next_date;
  return next ? new Date(next) : null;
}

// ---- Main loop --------------------------------------------------------------

async function loop() {
  console.log('🚀 game-status-worker starting…');
  console.log(
    `🕒 Node now: ${new Date().toISOString()} (server TZ: ${
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
    })`
  );

  // Catch-up immediately at boot
  await flipDueGames();

  // Main scheduler: sleep until next kickoff, but wake at least every 60s
  const SAFETY_SWEEP_MS = 60_000; // every minute
  const MAX_SLEEP_MS = 60 * 60 * 1000; // never sleep more than 1h

  while (true) {
    const nextKickoff = await getNextKickoff();

    if (!nextKickoff) {
      // Nothing scheduled: do a safety sweep once per minute
      await sleep(SAFETY_SWEEP_MS);
      await flipDueGames();
      continue;
    }

    const now = Date.now();
    let delay = nextKickoff.getTime() - now;

    // If already due (or within small jitter), flip now and continue
    if (delay <= 250) {
      await flipDueGames();
      // If multiple games share the same timestamp, avoid tight spin
      await sleep(500);
      continue;
    }

    // Bound the sleep; also enforce the 60s safety wake
    delay = Math.max(0, Math.min(delay, MAX_SLEEP_MS));
    const nap = Math.min(delay, SAFETY_SWEEP_MS);

    console.log(
      `⏳ Next kickoff: ${nextKickoff.toISOString()} (in ${(delay / 1000).toFixed(1)}s, napping ${(
        nap / 1000
      ).toFixed(0)}s)`
    );

    await sleep(nap);

    // On every wake, flip anything due (covers late inserts/edits & clock drift)
    await flipDueGames();
  }
}

// ---- Bootstrap / signals ----------------------------------------------------

async function main() {
  const leader = await tryBecomeLeader();
  if (!leader) {
    console.log('🟡 Another worker holds the advisory lock. Exiting.');
    await prisma.$disconnect();
    process.exit(0);
  }

  const cleanExit = async () => {
    await releaseLeader();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);

  try {
    await loop();
  } catch (err) {
    console.error('❌ Worker crashed:', err);
    await releaseLeader();
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();