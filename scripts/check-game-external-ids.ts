import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const games = await prisma.game.findMany({
    where: { 
      id: { in: ['cmjwpq6vl005lhuj64b5kodnb', 'cmjwpq6vm005phuj6q59difj7'] } 
    },
    select: {
      id: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      status: true,
      externalStatus: true,
      externalId: true,
      date: true
    }
  });
  
  for (const g of games) {
    console.log(`${g.homeTeam.name} vs ${g.awayTeam.name}:`);
    console.log(`  Status: ${g.status}`);
    console.log(`  External Status: ${g.externalStatus ?? 'null'}`);
    console.log(`  External ID: ${g.externalId ?? 'null'}`);
    console.log(`  Date: ${g.date.toISOString()}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

