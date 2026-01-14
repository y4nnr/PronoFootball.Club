import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const games = await prisma.game.findMany({
    where: { id: { in: ['cmjwpq6vl005lhuj64b5kodnb', 'cmjwpq6vm005phuj6q59difj7'] } },
    include: { homeTeam: true, awayTeam: true, competition: true }
  });
  
  for (const g of games) {
    console.log(`${g.homeTeam.name} vs ${g.awayTeam.name}:`);
    console.log(`  Status: ${g.status}`);
    console.log(`  External Status: ${g.externalStatus ?? 'null'}`);
    console.log(`  Scores: ${g.homeScore ?? g.liveHomeScore ?? 'null'}-${g.awayScore ?? g.liveAwayScore ?? 'null'}`);
    console.log(`  Elapsed: ${g.elapsedMinute ?? 'null'}`);
    console.log(`  Last Sync: ${g.lastSyncAt?.toISOString() ?? 'null'}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

