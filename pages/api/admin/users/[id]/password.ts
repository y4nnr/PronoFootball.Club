import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]';
import { prisma } from '../../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role.toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'User id is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { hashedPassword: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the hashed password
    return res.status(200).json({ hashedPassword: user.hashedPassword });
  } catch (error) {
    console.error('Error fetching user password:', error);
    return res.status(500).json({ error: 'Failed to fetch user password' });
  }
} 