import { useGameStore } from '../game/gameStore';
import { MobileControls } from './MobileControls';
import './GameUI.css';
import { useEffect, useState } from 'react';

interface GameUIProps {
  gameStarted?: boolean;
}

export const GameUI = ({ gameStarted = false }: GameUIProps) => {
  const { gameState, localPlayer } = useGameStore();
  const [playerCount, setPlayerCount] = useState<number>(0);

  // Effect to update player count whenever gameState changes
  useEffect(() => {
    if (gameState && gameState.player_count !== undefined) {
      setPlayerCount(gameState.player_count);
      console.log('Player count updated:', gameState.player_count);
    }
  }, [gameState]);

  if (!gameState) return null;

  const handleLeftPress = () => {
    // Dispatch a custom event that LightCycle will listen for
    window.dispatchEvent(new CustomEvent('gameControl', { detail: { action: 'left', type: 'press' } }));
  };

  const handleRightPress = () => {
    window.dispatchEvent(new CustomEvent('gameControl', { detail: { action: 'right', type: 'press' } }));
  };

  const handleLeftRelease = () => {
    window.dispatchEvent(new CustomEvent('gameControl', { detail: { action: 'left', type: 'release' } }));
  };

  const handleRightRelease = () => {
    window.dispatchEvent(new CustomEvent('gameControl', { detail: { action: 'right', type: 'release' } }));
  };

  const handleJumpPress = () => {
    window.dispatchEvent(new CustomEvent('gameControl', { detail: { action: 'jump', type: 'press' } }));
  };

  return (
    <div className="game-ui">
      <div className="game-info">
        <div className="player-count" style={{ 
          color: '#0fbef2', 
          fontSize: '18px',
          fontWeight: 'bold',
          textShadow: '0 0 5px #0fbef2, 0 0 10px #0fbef2',
          padding: '8px',
          border: '1px solid #0fbef2',
          borderRadius: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          marginBottom: '10px',
          zIndex: 1001
        }}>
          Players Online: {playerCount}
        </div>
      </div>
      {/* Always render mobile controls, component handles visibility internally */}
      <MobileControls
        onLeftPress={handleLeftPress}
        onRightPress={handleRightPress}
        onLeftRelease={handleLeftRelease}
        onRightRelease={handleRightRelease}
        onJumpPress={handleJumpPress}
      />
    </div>
  );
}; 