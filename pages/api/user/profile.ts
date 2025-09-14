import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@lib/prisma';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          profilePictureUrl: true,
          role: true, // Include role for display but not editing
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    const { name, email, password, profilePictureUrl } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    try {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: session.user.id }
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email is already taken' });
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {
        name,
        email,
        profilePictureUrl: profilePictureUrl || null
      };

      // Only update password if provided and not empty
      if (password && password.trim() !== '') {
        // Check if password is already a bcrypt hash
        const isBcryptHash = /^\$2[aby]\$/.test(password);
        
        if (!isBcryptHash) {
          // Hash the new password
          updateData.hashedPassword = await bcrypt.hash(password, 12);
        } else {
          // Password is already hashed, use as is
          updateData.hashedPassword = password;
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          profilePictureUrl: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user profile:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 
