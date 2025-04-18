import React, { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../game/gameStore';
import './PlayersOnline.css';

// Add reference to window global event listener for stable player tracking
declare global {
  interface WindowEventMap {
    'player_joined': CustomEvent<{ playerId: string }>;
    'player_left': CustomEvent<{ playerId: string }>;
  }
}

// Check for any existing players in localStorage
const getInitialPlayerCount = (): number => {
  try {
    // Try to count existing sessions as a fallback
    const existingSessions = localStorage.getItem('tron_game_player_session') ? 1 : 0;
    
    // If there's an active game session, there's at least one player
    return Math.max(1, existingSessions);
  } catch (e) {
    // Default to 1 if we can't access localStorage
    return 1;
  }
};

const PlayersOnline: React.FC = () => {
  const { gameState } = useGameStore();
  const [playerCount, setPlayerCount] = useState<number>(getInitialPlayerCount());
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const retryCount = useRef<number>(0);
  const MAX_RETRIES = 3;
  const POLL_INTERVAL = 5000; // More frequent polling (1 second)
  const RETRY_INTERVAL = 6000; // Retry faster after failures (3 seconds)
  const countRef = useRef<number>(playerCount); // Initialize ref with initial count

  // Update countRef whenever playerCount changes
  useEffect(() => {
    countRef.current = playerCount;
  }, [playerCount]);

  useEffect(() => {
    // Update from gameState when available
    if (gameState && gameState.player_count !== undefined) {
      // Always update from game state as it's the most reliable source
      setPlayerCount(gameState.player_count);
    }

    // Custom event listeners for real-time player tracking
    const handlePlayerJoined = (e: CustomEvent<{ playerId: string }>) => {
      // console.log(`Player joined: ${e.detail.playerId}`);
      setPlayerCount(prev => prev + 1);
    };

    const handlePlayerLeft = (e: CustomEvent<{ playerId: string }>) => {
      // console.log(`Player left: ${e.detail.playerId}`);
      setPlayerCount(prev => Math.max(1, prev - 1)); // Always keep at least 1 player
    };

    // Add event listeners for direct player tracking
    window.addEventListener('player_joined', handlePlayerJoined);
    window.addEventListener('player_left', handlePlayerLeft);

    // Only set up API polling without other conflicting sources
    const fetchPlayerCount = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        // Enhanced URL handling logic
        let apiUrl;
        const isLocalhost = window.location.hostname === 'localhost';
        
        if (import.meta.env.VITE_API_URL) {
          // Use explicit API URL if provided
          apiUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
        } else if (import.meta.env.VITE_WS_URL) {
          // Convert WebSocket URL to HTTP/HTTPS
          const wsUrl = import.meta.env.VITE_WS_URL;
          apiUrl = wsUrl
            .replace(/^wss:/, 'https:')
            .replace(/^ws:/, 'http:')
            .replace(/\/$/, '');
        } else {
          // Default URLs based on environment
          apiUrl = isLocalhost 
            ? 'http://localhost:8000'  // Local development port
            : 'https://tron-backend-production.up.railway.app:8080'; // Production with port 8080
        }
        
        // console.log(`[PlayersOnline] Environment: ${isLocalhost ? 'local' : 'production'}`);
        // console.log(`[PlayersOnline] Using API URL: ${apiUrl}/api/player-count`);
        
        const response = await fetch(
          `${apiUrl}/api/player-count`, 
          { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          }
        );
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // console.log(`[PlayersOnline] API response: ${JSON.stringify(data)}`);
          
          if (data.count !== countRef.current) {
            setPlayerCount(Math.max(1, data.count));
          }
          
          setIsConnected(true);
          retryCount.current = 0;
        } else {
          console.error(`[PlayersOnline] HTTP Error: ${response.status} ${response.statusText}`);
          handleFetchError();
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            console.warn('[PlayersOnline] Request timed out');
          } else {
            console.error('[PlayersOnline] Fetch error:', err);
          }
        } else {
          console.error('[PlayersOnline] Unknown error:', err);
        }
        handleFetchError();
      }
    };

    const handleFetchError = () => {
      retryCount.current += 1;
      if (retryCount.current >= MAX_RETRIES) {
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchPlayerCount();

    // Set up polling interval - make it more frequent to catch changes
    const interval = setInterval(fetchPlayerCount, isConnected ? POLL_INTERVAL : RETRY_INTERVAL);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('player_joined', handlePlayerJoined);
      window.removeEventListener('player_left', handlePlayerLeft);
    };
  }, [gameState, isConnected, POLL_INTERVAL, RETRY_INTERVAL]);

  return (
    <div className="players-online">
      <div className={`players-online-content ${!isConnected ? 'disconnected' : ''}`}>
        Players Online: {playerCount}
      </div>
    </div>
  );
};

export default PlayersOnline; 