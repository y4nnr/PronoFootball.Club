import { useState, useEffect, useCallback } from 'react';

interface GameData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  liveHomeScore: number | null;
  liveAwayScore: number | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  lastSyncAt: string | null;
}

interface GameHighlight {
  id: string;
  type: 'score' | 'status' | 'both';
}

export function useLiveScores() {
  const [highlightedGames, setHighlightedGames] = useState<Map<string, 'score' | 'status' | 'both'>>(new Map());
  const [previousGames, setPreviousGames] = useState<Map<string, GameData>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [signalCount, setSignalCount] = useState(0);
  const [lastSignalId, setLastSignalId] = useState<string | null>(null);
  const [refreshGameData, setRefreshGameData] = useState<(() => Promise<void>) | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  // Function to check for game updates and highlight changes
  const checkLiveScores = useCallback(async () => {
    try {
      console.log('🔍 Checking for game updates...');
      
      // If we have a refresh function from the dashboard, use it
      if (refreshGameData) {
        console.log('🔄 Using dashboard refresh function...');
        await refreshGameData();
        setLastUpdate(new Date());
        return;
      }
      
      // Fallback: fetch games of day and do change detection
      const response = await fetch('/api/user/games-of-day', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch games of day');
      }

      const data = await response.json();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('ℹ️ No games found in Matchs du jour');
        setLastUpdate(new Date());
        return;
      }
      
      console.log('✅ Games data refreshed');
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Error checking live scores:', error);
    }
  }, [refreshGameData]);

  // Listen for refresh signals from your scheduler
  useEffect(() => {
    console.log('🔌 Establishing SSE connection to /api/refresh-games-cards');
    setConnectionStatus('connecting');
    const eventSource = new EventSource('/api/refresh-games-cards');
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened successfully');
      setConnectionStatus('connected');
    };
    
    eventSource.onmessage = (event) => {
      // Verify connection is still open when receiving messages
      if (eventSource.readyState === EventSource.OPEN) {
        setConnectionStatus('connected');
      }
      
      console.log('📨 SSE message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'refresh_games') {
          console.log(`🔔 Received games refresh signal from scheduler (Signal ID: ${data.signalId})`);
          setSignalCount(prev => prev + 1);
          setLastSignalId(data.signalId);
          checkLiveScores();
        }
      } catch (error) {
        console.error('❌ Error parsing refresh signal:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ Games refresh stream error:', error);
      console.error('❌ EventSource readyState:', eventSource.readyState);
      
      // Check readyState to determine connection status accurately
      // EventSource.CONNECTING = 0, EventSource.OPEN = 1, EventSource.CLOSED = 2
      if (eventSource.readyState === EventSource.CLOSED) {
        // Connection is permanently closed, not reconnecting
        setConnectionStatus('disconnected');
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // EventSource is trying to reconnect automatically
        setConnectionStatus('connecting');
      } else {
        // Other error state
        setConnectionStatus('error');
      }
    };

    return () => {
      console.log('🔌 Closing SSE connection');
      setConnectionStatus('disconnected');
      eventSource.close();
    };
  }, [checkLiveScores]);

  // Function to register the dashboard's refresh function
  const registerRefreshFunction = useCallback((fn: () => Promise<void>) => {
    setRefreshGameData(() => fn);
  }, []);

  return {
    checkLiveScores,
    highlightedGames,
    hasChanges,
    lastUpdate,
    signalCount,
    lastSignalId,
    registerRefreshFunction,
    connectionStatus,
  };
}
