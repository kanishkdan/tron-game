import React from 'react';
import { KeyboardControls } from '@react-three/drei';
import { GameScene } from './game/GameScene';
import { GameUI } from './components/GameUI';
import { GameManager } from './game/GameManager';
import { GlobalStyles } from './styles/GlobalStyles';
import './App.css';

const App: React.FC = () => {
  // In a real app, you would get this from user authentication
  const playerId = 'player-' + Math.random().toString(36).substr(2, 9);

  return (
    <>
      <GlobalStyles />
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
    </>
  );
};

export default App;
