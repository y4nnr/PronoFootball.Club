const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find any Atletico Madrid vs Bodo/Glimt game (past or future), then
    // prefer an upcoming one if it exists, otherwise take the most recent one.
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          name: { contains: 'atl', mode: 'insensitive' }, // matches Atletico, Atlético, etc.
        },
        awayTeam: {
          OR: [
            { name: { contains: 'bodo', mode: 'insensitive' } },
            { name: { contains: 'bodø', mode: 'insensitive' } },
            { name: { contains: 'glimt', mode: 'insensitive' } },
          ],
        },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    console.log(`Found ${games.length} game(s) for Atletico vs Bodo/Glimt (any date)`);
    games.forEach(g => {
      console.log(
        ` - ${g.id} | ${g.date.toISOString()} | status=${g.status} | ${g.homeTeam.name} vs ${g.awayTeam.name}`
      );
    });

    if (!games.length) {
      console.log('No matching game found. Nothing to update.');
      return;
    }

    // Prefer an UPCOMING game if available, otherwise take the last one
    const upcoming = games.find(g => g.status === 'UPCOMING');
    const game = upcoming || games[games.length - 1];

    console.log(
      `Updating game ${game.id}: ${game.homeTeam.name} vs ${game.awayTeam.name} in competition ${game.competition?.name} on ${game.date.toISOString()}`
    );

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: {
        status: 'LIVE',
        liveHomeScore: 2,
        liveAwayScore: 1,
        elapsedMinute: 54,
      },
    });

    console.log(
      `Game updated to LIVE with fake score: ${updated.liveHomeScore} - ${updated.liveAwayScore} (minute ${updated.elapsedMinute})`
    );
  } catch (err) {
    console.error('Error while setting fake LIVE score for Atletico vs Bodo:', err);
  } finally {
    await prisma.$disconnect();
  }
})();


