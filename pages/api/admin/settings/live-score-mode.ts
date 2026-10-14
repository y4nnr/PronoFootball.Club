import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getLiveScoreMode, setLiveScoreMode, LiveScoreMode } from '../../../../lib/live-score-mode';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role;
  if (!session || typeof role !== 'string' || role.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    const mode = await getLiveScoreMode();
    return res.status(200).json({ mode });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const { mode } = req.body ?? {};
    if (mode !== 'LIVE' && mode !== 'FINAL_ONLY') {
      return res.status(400).json({ error: 'mode must be LIVE or FINAL_ONLY' });
    }
    await setLiveScoreMode(mode as LiveScoreMode);
    return res.status(200).json({ mode });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
