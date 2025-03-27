import { useGameStore } from '../game/gameStore';
import { MobileControls } from './MobileControls';
import './GameUI.css';

export const GameUI = () => {
  const { gameState, localPlayer } = useGameStore();

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
        <div className="player-count">
          Players Online: {gameState.player_count}
        </div>
        {gameState.current_round > 0 && (
          <div className="current-round">
            Round: {gameState.current_round}
          </div>
        )}
      </div>

      {localPlayer && (
        <div className="player-info">
          <div className="player-score">
            Score: {localPlayer.score}
          </div>
          {localPlayer.is_eliminated && (
            <div className="eliminated-message">
              You've been eliminated!
            </div>
          )}
        </div>
      )}

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