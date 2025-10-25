import { useEffect, useState } from 'react';

export default function TestSSE() {
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');

  useEffect(() => {
    console.log('🔌 Starting SSE connection to /api/test-sse');
    
    const eventSource = new EventSource('/api/test-sse');
    
    eventSource.onopen = () => {
      console.log('✅ Test SSE connection opened');
      setConnectionStatus('Connected');
    };
    
    eventSource.onmessage = (event) => {
      console.log('📨 Test SSE message received:', event.data);
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, `${data.timestamp}: ${data.type} (${data.connections} connections)`]);
    };

    eventSource.onerror = (error) => {
      console.error('❌ Test SSE error:', error);
      setConnectionStatus('Error');
    };

    return () => {
      console.log('🔌 Closing test SSE connection');
      eventSource.close();
    };
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SSE Test Page</h1>
      <div className="mb-4">
        <strong>Status:</strong> {connectionStatus}
      </div>
      <div className="mb-4">
        <strong>Messages:</strong>
        <ul className="list-disc list-inside">
          {messages.map((msg, index) => (
            <li key={index} className="text-sm">{msg}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
