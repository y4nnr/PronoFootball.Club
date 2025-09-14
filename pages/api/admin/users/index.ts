import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

// Function to generate a temporary password
function generateTemporaryPassword() {
  return crypto.randomBytes(4).toString('hex');
}

// Placeholder email function - implement actual email sending later
async function sendWelcomeEmail(params: { to: string; name: string; temporaryPassword: string }) {
  console.log('Welcome email would be sent to:', params.to, 'with temp password:', params.temporaryPassword);
  return true; // Return true for now
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role.toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          profilePictureUrl: true,
          needsPasswordChange: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  if (req.method === 'POST') {
    const { name, email, role, profilePictureUrl, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    try {
      let hashedPassword: string;
      let needsPasswordChange = false;
      let temporaryPassword: string | undefined;

      if (password) {
        // If password is provided, use it directly
        hashedPassword = await bcrypt.hash(password, 10);
      } else {
        // Generate temporary password if none provided
        temporaryPassword = generateTemporaryPassword();
        hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        needsPasswordChange = true;
      }
      
      const user = await prisma.user.create({
        data: {
          name,
          email,
          hashedPassword,
          role,
          profilePictureUrl,
          needsPasswordChange,
        },
      });

      // Only send welcome email if no password was provided
      if (!password) {
        const emailSent = await sendWelcomeEmail({
          to: email,
          name,
          temporaryPassword: temporaryPassword!,
        });

        if (!emailSent) {
          console.error('Failed to send welcome email to:', email);
          return res.status(201).json({ 
            id: user.id,
            temporaryPassword,
            message: 'User created successfully, but failed to send welcome email. Please manually share the temporary password with the user.'
          });
        }

        return res.status(201).json({ 
          id: user.id,
          message: 'User created successfully. A welcome email has been sent with login instructions.'
        });
      }

      return res.status(201).json({ 
        id: user.id,
        message: 'User created successfully with provided password.'
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    const { name, email, role, profilePictureUrl, password } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'User id is required' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    try {
      const data: Record<string, unknown> = { name, email, role, profilePictureUrl };
      
      // Only update password if it's provided and it's not already a hash
      if (password && password.trim() !== '') {
        // Check if the password looks like a bcrypt hash (starts with $2a$, $2b$, or $2y$)
        const isBcryptHash = /^\$2[aby]\$/.test(password);
        
        if (!isBcryptHash) {
          // It's a plain text password, hash it
          data.hashedPassword = await bcrypt.hash(password, 10);
          console.log('Password updated for user:', id);
        } else {
          // It's already a hash, don't update the password
          console.log('Skipping password update - hash detected for user:', id);
        }
      }
      
      const user = await prisma.user.update({
        where: { id },
        data,
      });
      return res.status(200).json({ id: user.id, message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'User id is required' });
    }
    try {
      // Delete related records first to avoid foreign key constraint violations
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete user stats
        await tx.userStats.deleteMany({
          where: { userId: id }
        });
        
        // Delete user bets (not predictions)
        await tx.bet.deleteMany({
          where: { userId: id }
        });
        
        // Delete user competition memberships
        await tx.competitionUser.deleteMany({
          where: { userId: id }
        });
        
        // Finally delete the user
        await tx.user.delete({ 
          where: { id } 
        });
      });
      
      console.log('User and related records deleted successfully:', id);
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 