import { KeyboardControls } from '@react-three/drei';
import { GameScene } from './game/GameScene';
import { GameUI } from './components/GameUI';
import { GameManager } from './game/GameManager';
import './App.css';

function App() {
  // In a real app, you would get this from user authentication
  const playerId = 'player-' + Math.random().toString(36).substr(2, 9);

  return (
    <KeyboardControls
      map={[
        { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
        { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
        { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
        { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
        { name: 'jump', keys: ['Space'] },
      ]}
    >
      <GameManager playerId={playerId} />
      <GameScene />
      <GameUI />
    </KeyboardControls>
  );
}

export default App;
