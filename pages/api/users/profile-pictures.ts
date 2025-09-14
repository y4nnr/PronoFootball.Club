import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { prisma } from '../../../lib/prisma';

interface UserWithImage {
  name: string | null;
  profilePictureUrl: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Fetch all users with their profile pictures (excluding admin users)
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: 'admin'
        }
      },
      select: {
        name: true,
        profilePictureUrl: true
      }
    });

    // Create a mapping of user names to profile pictures
    const profilePictures: { [key: string]: string } = {};
    
    users.forEach((user: UserWithImage) => {
      if (user.name && user.profilePictureUrl) {
        profilePictures[user.name] = user.profilePictureUrl;
      }
    });

    res.status(200).json(profilePictures);
  } catch (error) {
    console.error('Error fetching user profile pictures:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 