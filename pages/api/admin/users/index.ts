import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';
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

  console.log('Admin users API - Session:', session ? { email: session.user?.email, role: session.user?.role } : 'No session');

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized - No session' });
  }

  const userRole = session.user.role?.toLowerCase();
  if (userRole !== 'admin') {
    console.error('Unauthorized access attempt - Role:', session.user.role, 'Expected: admin');
    return res.status(401).json({ error: 'Unauthorized - Admin access required' });
  }

  if (req.method === 'GET') {
    try {
      console.log('[ADMIN USERS] Starting to fetch users...');
      console.log('[ADMIN USERS] Prisma client initialized:', !!prisma);
      console.log('[ADMIN USERS] DATABASE_URL exists:', !!process.env.DATABASE_URL);
      
      // Test connection first
      await prisma.$connect();
      console.log('[ADMIN USERS] Database connection successful');
      
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          profilePictureUrl: true,
          needsPasswordChange: true,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      console.log('[ADMIN USERS] Successfully fetched', users.length, 'users');
      return res.status(200).json(users);
    } catch (error) {
      console.error('[ADMIN USERS] Error fetching users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'Unknown';
      
      console.error('[ADMIN USERS] Error details:', { 
        name: errorName,
        message: errorMessage, 
        stack: errorStack,
        code: (error as any)?.code,
        meta: (error as any)?.meta,
      });
      
      return res.status(500).json({ 
        error: 'Failed to fetch users',
        message: errorMessage,
        name: errorName,
        // Include error code if available (e.g., Prisma error codes)
        code: (error as any)?.code || undefined,
      });
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
    const { name, email, role, profilePictureUrl, password, isActive } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'User id is required' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    try {
      const data: Record<string, unknown> = { name, email, role, profilePictureUrl };
      
      // Update isActive if provided
      if (typeof isActive === 'boolean') {
        data.isActive = isActive;
      }
      
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

  if (req.method === 'PATCH') {
    const { id } = req.query;
    const { isActive } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'User id is required' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }
    try {
      console.log('[ADMIN] Updating user activation status:', { id, isActive });
      const user = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          isActive: true,
          role: true
        }
      });
      console.log('[ADMIN] User updated successfully:', user);
      return res.status(200).json({ id: user.id, isActive: user.isActive, message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
    } catch (error) {
      console.error('[ADMIN] Error updating user activation status:', error);
      return res.status(500).json({ error: 'Failed to update user activation status' });
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