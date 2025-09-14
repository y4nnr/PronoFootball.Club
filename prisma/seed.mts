import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create users with simple credentials
  const hashedAdminPw = await bcrypt.hash('admin', 10)
  const hashedUserPw = await bcrypt.hash('user', 10)

  const admin = await prisma.user.create({
    data: {
      email: 'admin@admin',
      name: 'admin',
      hashedPassword: hashedAdminPw,
      profilePictureUrl: 'https://i.pravatar.cc/150?u=admin',
      role: 'ADMIN',
      stats: {
        create: {
          totalPredictions: 0,
          totalPoints: 0,
          accuracy: 0,
          wins: 0,
          longestStreak: 0,
          exactScoreStreak: 0
        }
      }
    }
  })

  const user = await prisma.user.create({
    data: {
      email: 'user@user',
      name: 'Test User',
      hashedPassword: hashedUserPw,
      profilePictureUrl: 'https://i.pravatar.cc/150?u=user',
      stats: {
        create: {
          totalPredictions: 0,
          totalPoints: 0,
          accuracy: 0,
          wins: 0,
          longestStreak: 0,
          exactScoreStreak: 0
        }
      }
    }
  })

  // Create teams
  const teams = await Promise.all([
    prisma.team.create({ data: { name: 'Germany', shortName: 'GER', category: 'NATIONAL' } }),
    prisma.team.create({ data: { name: 'Scotland', shortName: 'SCO', category: 'NATIONAL' } }),
    prisma.team.create({ data: { name: 'Spain', shortName: 'ESP', category: 'NATIONAL' } }),
    prisma.team.create({ data: { name: 'Croatia', shortName: 'CRO', category: 'NATIONAL' } }),
    prisma.team.create({ data: { name: 'Italy', shortName: 'ITA', category: 'NATIONAL' } }),
    prisma.team.create({ data: { name: 'Albania', shortName: 'ALB', category: 'NATIONAL' } })
  ])

  // Create a competition
  const euro2024 = await prisma.competition.create({
    data: {
      name: 'Euro 2024',
      description: 'UEFA European Championship 2024',
      startDate: new Date('2024-06-14'),
      endDate: new Date('2024-07-14'),
      status: 'UPCOMING',
      users: {
        create: [
          { userId: admin.id },
          { userId: user.id }
        ]
      }
    }
  })

  // Create some games
  const games = await Promise.all([
    prisma.game.create({
      data: {
        competitionId: euro2024.id,
        homeTeamId: teams[0].id, // Germany
        awayTeamId: teams[1].id, // Scotland
        date: new Date('2024-06-14T20:00:00Z'),
        status: 'UPCOMING'
      }
    }),
    prisma.game.create({
      data: {
        competitionId: euro2024.id,
        homeTeamId: teams[2].id, // Spain
        awayTeamId: teams[3].id, // Croatia
        date: new Date('2024-06-15T14:00:00Z'),
        status: 'UPCOMING'
      }
    }),
    prisma.game.create({
      data: {
        competitionId: euro2024.id,
        homeTeamId: teams[4].id, // Italy
        awayTeamId: teams[5].id, // Albania
        date: new Date('2024-06-15T17:00:00Z'),
        status: 'UPCOMING'
      }
    })
  ])

  console.log('✅ Seeded database with test data')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

