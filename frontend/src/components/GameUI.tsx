import { useGameStore } from '../game/gameStore';
import './GameUI.css';

export const GameUI = () => {
  const { gameState, localPlayer } = useGameStore();

  if (!gameState) return null;

  return (
    <div className="game-ui">
      <div className="game-info">
        <div className="player-count">
          Players: {gameState.player_count}/{gameState.max_players}
        </div>
        <div className="game-phase">
          Phase: {gameState.game_phase}
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
    </div>
  );
}; 