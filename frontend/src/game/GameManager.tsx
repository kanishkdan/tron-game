import { useEffect, useRef } from 'react';
import { useGameStore } from './gameStore';
import { GameClient } from '../network/gameClient';

interface GameManagerProps {
  playerId: string;
}

export const GameManager = ({ playerId }: GameManagerProps) => {
  const gameClient = useRef<GameClient | null>(null);
  const { setGameState, setLocalPlayer, updatePlayerPosition, eliminatePlayer } = useGameStore();

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

    // Cleanup on unmount
    return () => {
      if (gameClient.current) {
        gameClient.current.disconnect();
      }
    };
  }, [playerId, setGameState, setLocalPlayer, updatePlayerPosition, eliminatePlayer]);

  return null;
}; 