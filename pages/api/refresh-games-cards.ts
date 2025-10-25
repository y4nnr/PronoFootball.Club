import { NextApiRequest, NextApiResponse } from 'next';

// Store active connections for game card refresh
// Use a more reliable global state approach
if (!(global as any).sseConnections) {
  (global as any).sseConnections = new Set<NextApiResponse>();
}

const connections = (global as any).sseConnections;

// Clean up dead connections periodically
setInterval(() => {
  const deadConnections: NextApiResponse[] = [];
  connections.forEach((res) => {
    if (res.destroyed) {
      deadConnections.push(res);
    }
  });
  deadConnections.forEach((res) => connections.delete(res));
  if (deadConnections.length > 0) {
    console.log(`🧹 Cleaned up ${deadConnections.length} dead connections`);
  }
}, 30000); // Clean up every 30 seconds

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Add client to connections set
  connections.add(res);
  console.log(`🔌 New SSE connection established. Total connections: ${connections.size}`);
  console.log(`🔌 Connection details:`, { 
    method: req.method, 
    url: req.url, 
    headers: req.headers,
    connectionId: res.socket?.remoteAddress 
  });

  // Handle client disconnect
  req.on('close', () => {
    connections.delete(res);
    console.log(`🔌 SSE connection closed. Total connections: ${connections.size}`);
  });

  // Handle connection errors
  req.on('error', (error) => {
    console.error(`❌ SSE connection error:`, error);
    connections.delete(res);
  });

  // Send an initial empty message to establish connection
  res.write(':ok\n\n');

  // Keep the connection alive
  const keepAliveInterval = setInterval(() => {
    if (res.destroyed) {
      clearInterval(keepAliveInterval);
      return;
    }
    res.write(':keep-alive\n\n');
  }, 20000); // Send a keep-alive message every 20 seconds
}

export function broadcastGameCardsRefresh() {
  const message = {
    type: 'refresh_games',
    timestamp: new Date().toISOString(),
    signalId: Math.random().toString(36).substr(2, 9) // Add unique signal ID
  };

  const data = `data: ${JSON.stringify(message)}\n\n`;

  let connectedClients = 0;
  const deadConnections: NextApiResponse[] = [];
  
  connections.forEach((clientRes) => {
    try {
      if (clientRes.destroyed) {
        deadConnections.push(clientRes);
        return;
      }
      clientRes.write(data);
      connectedClients++;
    } catch (error) {
      console.error('❌ Error sending refresh to client:', error);
      deadConnections.push(clientRes);
    }
  });
  
  // Remove dead connections
  deadConnections.forEach((res) => connections.delete(res));

  console.log(`📡 Game cards refresh signal sent to ${connectedClients} connected clients (Signal ID: ${message.signalId})`);
  return { connectedClients, signalId: message.signalId };
}
