import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role.toLowerCase() !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const teams = await prisma.team.findMany({
        orderBy: {
          name: 'asc',
        },
      });
      return res.status(200).json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      return res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }

  if (req.method === 'POST') {
    const { name, shortName, logo, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (!category || !['NATIONAL', 'CLUB'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required (NATIONAL or CLUB)' });
    }

    try {
      const team = await prisma.team.create({
        data: {
          name,
          shortName,
          logo,
          category,
        },
      });
      return res.status(201).json(team);
    } catch (error) {
      console.error('Error creating team:', error);
      return res.status(500).json({ error: 'Failed to create team' });
    }
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    const { name, shortName, logo, category } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Team id is required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    if (!category || !['NATIONAL', 'CLUB'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required (NATIONAL or CLUB)' });
    }
    try {
      const team = await prisma.team.update({
        where: { id },
        data: { name, shortName, logo, category },
      });
      return res.status(200).json(team);
    } catch (error) {
      console.error('Error updating team:', error);
      return res.status(500).json({ error: 'Failed to update team' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Team id is required' });
    }
    try {
      await prisma.team.delete({ where: { id } });
      return res.status(200).json({ message: 'Team deleted' });
    } catch (error) {
      console.error('Error deleting team:', error);
      return res.status(500).json({ error: 'Failed to delete team' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 