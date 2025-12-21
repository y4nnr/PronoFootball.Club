import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Find all users without a profile picture
    const usersWithoutPicture = await prisma.user.findMany({
      where: {
        OR: [
          { profilePictureUrl: null },
          { profilePictureUrl: '' }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    console.log(`Found ${usersWithoutPicture.length} users without profile pictures`);

    // Update each user with a generated profile picture
    for (const user of usersWithoutPicture) {
      const profilePictureUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(user.email)}`;
      
      await prisma.user.update({
        where: { id: user.id },
        data: { profilePictureUrl }
      });

      console.log(`Updated profile picture for ${user.email} (${user.name}): ${profilePictureUrl}`);
    }

    console.log(`\nSuccessfully updated ${usersWithoutPicture.length} users with profile pictures`);
  } catch (e) {
    console.error('Error updating profile pictures:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

