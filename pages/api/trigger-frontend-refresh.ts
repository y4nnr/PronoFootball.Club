import { NextApiRequest, NextApiResponse } from 'next';
import { broadcastGameCardsRefresh } from './refresh-games-cards';

// Get the shared connections
const connections = (global as any).sseConnections || new Set();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Triggering frontend refresh...');
    console.log('🔍 Current connections before broadcast:', connections.size);
    
    // Broadcast refresh signal to all connected clients
    const { connectedClients, signalId } = broadcastGameCardsRefresh();
    
    return res.status(200).json({
      success: true,
      message: `Frontend refresh signal sent to ${connectedClients} connected clients`,
      connectedClients,
      signalId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error triggering frontend refresh:', error);
    return res.status(500).json({
      error: 'Failed to trigger frontend refresh',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
