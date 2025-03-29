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
  const POLL_INTERVAL = 2000; // More frequent polling (2 seconds)
  const RETRY_INTERVAL = 5000; // Retry every 5 seconds after failures
  const countRef = useRef<number>(playerCount); // Initialize ref with initial count

  // Update countRef whenever playerCount changes
  useEffect(() => {
    countRef.current = playerCount;
  }, [playerCount]);

  useEffect(() => {
    // Update from gameState when available
    if (gameState && gameState.player_count !== undefined) {
      // Only update if game state count is higher or significantly different
      if (gameState.player_count > countRef.current || 
          Math.abs(gameState.player_count - countRef.current) > 1) {
        setPlayerCount(gameState.player_count);
      }
    }

    // Custom event listeners for real-time player tracking
    const handlePlayerJoined = () => {
      setPlayerCount(prev => prev + 1);
    };

    const handlePlayerLeft = () => {
      setPlayerCount(prev => Math.max(1, prev - 1)); // Always keep at least 1 player
    };

    // Add event listeners for direct player tracking
    window.addEventListener('player_joined', handlePlayerJoined);
    window.addEventListener('player_left', handlePlayerLeft);

    // Set up polling from server for real-time updates and sync
    const fetchPlayerCount = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Set a timeout
        
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/player-count`, 
          { signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Only update if server count is higher or significantly different
          if (data.count > countRef.current || Math.abs(data.count - countRef.current) > 1) {
            setPlayerCount(Math.max(1, data.count)); // Always keep at least 1 player
          }
          setIsConnected(true);
          retryCount.current = 0; // Reset retry count on success
        } else {
          handleFetchError();
        }
      } catch (error) {
        handleFetchError();
      }
    };

    const handleFetchError = () => {
      // Only switch to disconnected state after multiple retry failures
      retryCount.current += 1;
      if (retryCount.current >= MAX_RETRIES) {
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchPlayerCount();

    // Set up polling interval
    const interval = setInterval(fetchPlayerCount, isConnected ? POLL_INTERVAL : RETRY_INTERVAL);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('player_joined', handlePlayerJoined);
      window.removeEventListener('player_left', handlePlayerLeft);
    };
  }, [gameState, isConnected]);

  return (
    <div className="players-online">
      <div className={`players-online-content ${!isConnected ? 'disconnected' : ''}`}>
        Players Online: {playerCount}
      </div>
    </div>
  );
};

export default PlayersOnline; 