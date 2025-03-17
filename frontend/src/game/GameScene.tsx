import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { PerspectiveCamera, KeyboardControls } from '@react-three/drei';
import { Player, PlayerRef } from './Player';
import { Environment } from './Environment';
import { ObstacleCourse } from './ObstacleCourse';
import { Suspense, useRef, useState } from 'react';
import { CameraController } from './CameraController';
import StartMenu from './StartMenu';

export const GameScene = () => {
  const playerRef = useRef<PlayerRef>(null);
  const [playerName, setPlayerName] = useState<string>();
  const [gameStarted, setGameStarted] = useState(false);

  const handleGameStart = (name: string) => {
    setPlayerName(name);
    setGameStarted(true);
    // Reset player position
    playerRef.current?.respawn();
  };

  return (
    <>
      <KeyboardControls
        map={[
          { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
          { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
          { name: 'leftward', keys: ['ArrowLeft', 'a', 'A'] },
          { name: 'rightward', keys: ['ArrowRight', 'd', 'D'] },
          { name: 'jump', keys: ['Space'] },
        ]}
      >
        <Canvas shadows>
          <Suspense fallback={null}>
            <PerspectiveCamera
              makeDefault
              position={[0, 10, -20]}
              fov={60}
            />
            <Physics
              gravity={[0, -19.81, 0]}
              defaultContactMaterial={{
                friction: 0.5,
                restitution: 0.2,
              }}
            >
              <Environment />
              <ObstacleCourse />
              <Player ref={playerRef} playerName={playerName} />
              <CameraController target={playerRef} />
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
      {!gameStarted && <StartMenu onStart={handleGameStart} />}
    </>
  );
}; 