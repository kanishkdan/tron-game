import { useEffect, useRef, useState } from 'react';
import { useGameStore } from './gameStore';
import { GameClient } from '../network/gameClient';
import { KillFeed } from '../components/KillFeed';

interface GameManagerProps {
  playerId: string;
}

export const GameManager = ({ playerId }: GameManagerProps) => {
  const gameClient = useRef<GameClient | null>(null);
  const { setGameState, setLocalPlayer, updatePlayerPosition, eliminatePlayer } = useGameStore();
  const [killMessages, setKillMessages] = useState<Array<{ killer: string; victim: string; timestamp: number }>>([]);
  
  useEffect(() => {
    // Initialize game client
    gameClient.current = new GameClient();

    // Connect to server
    gameClient.current.connect(playerId).catch(console.error);

    // Set up event handlers
    gameClient.current.on('game_state', (state) => {
      setGameState(state);
      if (state.players[playerId]) {
        setLocalPlayer(state.players[playerId]);
      }
    });

    gameClient.current.on('player_moved', ({ player_id, position }) => {
      updatePlayerPosition(player_id, position);
    });

    gameClient.current.on('player_eliminated', ({ player_id }) => {
      eliminatePlayer(player_id);
    });
    
    // Listen for kill events
    gameClient.current.on('player_kill', (data) => {
      console.log(`Received kill event: ${data.killer} killed ${data.victim}`);
      
      // Add to kill feed
      setKillMessages(prev => {
        const newMessages = [...prev, { 
          killer: data.killer, 
          victim: data.victim,
          timestamp: Date.now() 
        }];
        return newMessages.slice(-5); // Keep only last 5 messages
      });
      
      // Remove old messages after 5 seconds
      setTimeout(() => {
        setKillMessages(prev => prev.filter(msg => Date.now() - msg.timestamp < 5000));
      }, 5000);
    });

    // Cleanup on unmount
    return () => {
      if (gameClient.current) {
        gameClient.current.disconnect();
      }
    };
  }, [playerId, setGameState, setLocalPlayer, updatePlayerPosition, eliminatePlayer]);

  // Render kill feed
  return (
    <KillFeed messages={killMessages} />
  );
}; 