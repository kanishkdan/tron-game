import React from 'react';
import { KeyboardControls } from '@react-three/drei';
import { GameScene } from './game/GameScene';
import { GameUI } from './components/GameUI';
import { GlobalStyles } from './styles/GlobalStyles';
import './App.css';

const App: React.FC = () => {
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
        <GameScene />
        <GameUI />
      </KeyboardControls>
    </>
  );
};

export default App;
