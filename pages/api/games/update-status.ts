import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

/**
 * DEPRECATED: This API endpoint is disabled.
 * Game status updates should ONLY be handled by the dedicated game-status-worker.js script.
 * This endpoint had no authentication and could cause incorrect status updates.
 * 
 * If you need to manually update game statuses, use /api/admin/update-game-statuses (requires admin auth)
 * or let the game-status-worker.js handle it automatically.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Disable this endpoint to prevent unauthorized status updates
  return res.status(410).json({ 
    error: 'This endpoint has been disabled. Game status updates are handled by game-status-worker.js only.',
    message: 'If you need to update game statuses, use /api/admin/update-game-statuses (admin access required)'
  });
} 