import { NextApiRequest, NextApiResponse } from 'next';

// Simple global connections tracking
if (!(global as any).testConnections) {
  (global as any).testConnections = new Set();
}

const connections = (global as any).testConnections;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔌 Test SSE connection attempt');
  console.log('🔌 Current connections before adding:', connections.size);

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
  console.log('🔌 Test SSE connection added. Total connections:', connections.size);

  // Handle client disconnect
  req.on('close', () => {
    connections.delete(res);
    console.log('🔌 Test SSE connection closed. Total connections:', connections.size);
  });

  // Handle connection errors
  req.on('error', (error) => {
    console.error('❌ Test SSE connection error:', error);
    connections.delete(res);
  });

  // Send an initial message
  res.write('data: {"type": "connected", "timestamp": "' + new Date().toISOString() + '"}\n\n');

  // Send a test message every 5 seconds
  const interval = setInterval(() => {
    if (res.destroyed) {
      clearInterval(interval);
      return;
    }
    
    const message = {
      type: 'test',
      timestamp: new Date().toISOString(),
      connections: connections.size
    };
    
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }, 5000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(interval);
    connections.delete(res);
    console.log('🔌 Test SSE connection closed. Total connections:', connections.size);
  });
}
