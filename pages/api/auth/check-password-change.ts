import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './[...nextauth]';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { needsPasswordChange: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ needsPasswordChange: user.needsPasswordChange });
  } catch (error) {
    console.error('Error checking password change status:', error);
    return res.status(500).json({ error: 'Failed to check password change status' });
  }
} 