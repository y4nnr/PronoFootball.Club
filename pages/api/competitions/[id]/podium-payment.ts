import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id: competitionId } = req.query;
  if (!competitionId || typeof competitionId !== 'string') {
    return res.status(400).json({ error: 'Invalid competition ID' });
  }

  const cu = await prisma.competitionUser.findUnique({
    where: { competitionId_userId: { competitionId, userId: session.user.id } },
    select: { id: true, podiumPaidAt: true },
  });
  if (!cu) {
    return res.status(404).json({ error: 'Not a participant of this competition' });
  }

  const nextPaidAt = cu.podiumPaidAt ? null : new Date();
  await prisma.competitionUser.update({
    where: { id: cu.id },
    data: { podiumPaidAt: nextPaidAt },
  });

  return res.json({ paidAt: nextPaidAt });
}
