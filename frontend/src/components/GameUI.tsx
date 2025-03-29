import { useGameStore } from '../game/gameStore';
import { MobileControls } from './MobileControls';
import './GameUI.css';
import { useEffect, useState } from 'react';

interface GameUIProps {
  gameStarted?: boolean;
  forceMobile?: boolean; // For debugging
  isChatOpen?: boolean;
  onOpenChat?: () => void;
}

export const GameUI = ({ 
  gameStarted = false, 
  forceMobile = false,
  isChatOpen = false,
  onOpenChat = () => {}
}: GameUIProps) => {
  const { gameState, localPlayer } = useGameStore();
  const [playerCount, setPlayerCount] = useState<number>(0);

  // Update player count whenever gameState changes
  useEffect(() => {
    if (gameState && gameState.player_count !== undefined) {
      setPlayerCount(gameState.player_count);
      console.log('Player count updated:', gameState.player_count);
    }
  }, [gameState]);

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
      {gameState && (
        <div className="game-info">
          {/* <div className="player-count" style={{ 
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
          </div> */}
        </div>
      )}
      
      {/* Chat indicator */}
      {gameStarted && !isChatOpen && (
        <div 
          className="chat-indicator" 
          onClick={onOpenChat}
          style={{ 
            position: 'fixed',
            left: '20px',
            top: '80px',
            color: '#0fbef2', 
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '8px 12px',
            border: '1px solid #0fbef2',
            borderRadius: '3px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            pointerEvents: 'auto',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(15, 190, 242, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          Tap to chat (or Press T)
        </div>
      )}
      
      {/* Always render mobile controls, regardless of gameState */}
      <MobileControls
        onLeftPress={handleLeftPress}
        onRightPress={handleRightPress}
        onLeftRelease={handleLeftRelease}
        onRightRelease={handleRightRelease}
        onJumpPress={handleJumpPress}
        forceMobile={forceMobile}
      />
    </div>
  );
}; 