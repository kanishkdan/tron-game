import { Canvas, RootState, useThree, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { PerspectiveCamera, KeyboardControls } from '@react-three/drei';
import { Suspense, useRef, useState, useEffect } from 'react';
import StartMenu from './StartMenu';
import { TronGame } from './core/TronGame';
import { CameraController } from './core/CameraController';
import { Minimap } from '../components/Minimap';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Lighting component to handle all scene lighting
const SceneLighting = () => {
    return (
        <>
            {/* Ambient light for base illumination */}
            <ambientLight intensity={0.2} />
            
            {/* Main directional light from above */}
            <directionalLight
                position={[0, 100, 0]}
                intensity={0.8}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
            />
            
            {/* Additional point lights for Tron-like glow effect */}
            <pointLight position={[0, 50, 0]} intensity={0.8} color={0x0fbef2} distance={1000} />
            <pointLight position={[50, 50, 50]} intensity={0.5} color={0x0fbef2} distance={1000} />
            <pointLight position={[-50, 50, -50]} intensity={0.5} color={0x0fbef2} distance={1000} />
            
            {/* Add spotlight for dramatic effect */}
            <spotLight
                position={[0, 200, 0]}
                angle={Math.PI / 4}
                penumbra={0.2}
                intensity={0.8}
                color={0xffffff}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
            />
        </>
    );
};

const GameRenderer = ({ game, onPositionUpdate }: { 
    game: TronGame; 
    onPositionUpdate: (pos: { x: number; z: number }, trailPoints: { x: number; z: number }[]) => void 
}) => {
    const { camera } = useThree();
    const cameraController = useRef<CameraController>();

    useEffect(() => {
        if (game.getPlayer()) {
            cameraController.current = new CameraController(
                camera as THREE.PerspectiveCamera,
                game.getPlayer()!
            );
        }
    }, [game, camera]);

    useFrame((state, delta) => {
        if (cameraController.current) {
            cameraController.current.update(delta);
            
            // Update player position and trail for minimap
            const playerPos = game.getPlayer()?.getPosition();
            const trailPoints = game.getPlayer()?.getTrailPoints() || [];
            
            if (playerPos) {
                onPositionUpdate(
                    { x: playerPos.x, z: playerPos.z },
                    trailPoints.map(p => ({ x: p.x, z: p.z }))
                );
            }
        }
    });

    return null;
};

export const GameScene = () => {
    const [gameStarted, setGameStarted] = useState(false);
    const [playerName, setPlayerName] = useState<string>();
    const [playerPosition, setPlayerPosition] = useState({ x: 0, z: 0 });
    const [trailPoints, setTrailPoints] = useState<{ x: number; z: number }[]>([]);
    const [arenaSize, setArenaSize] = useState(500);
    const scene = useRef<THREE.Scene>();
    const game = useRef<TronGame>();

    const handleGameStart = (name: string) => {
        setPlayerName(name);
        setGameStarted(true);
        
        if (scene.current) {
            const physicsWorld = new CANNON.World();
            physicsWorld.gravity.set(0, -19.81, 0);
            physicsWorld.defaultContactMaterial.friction = 0.1;
            physicsWorld.defaultContactMaterial.restitution = 0.2;
            game.current = new TronGame(scene.current, physicsWorld);
            game.current.start(name);
            
            // Set the arena size from the game
            if (game.current) {
                setArenaSize(game.current.getArenaSize());
            }
        }
    };

    const handlePositionUpdate = (pos: { x: number; z: number }, trail: { x: number; z: number }[]) => {
        setPlayerPosition(pos);
        setTrailPoints(trail);
    };

    return (
        <>
            <KeyboardControls
                map={[
                    { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
                    { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
                    { name: 'leftward', keys: ['ArrowLeft', 'a', 'A'] },
                    { name: 'rightward', keys: ['ArrowRight', 'd', 'D'] },
                ]}
            >
                <Canvas shadows onCreated={(state: RootState) => { scene.current = state.scene; }}>
                    <Suspense fallback={null}>
                        <SceneLighting />
                        <PerspectiveCamera
                            makeDefault
                            position={[0, 8, 25]}
                            rotation={[-0.3, 0, 0]}
                            fov={75}
                        />
                        {gameStarted && game.current && (
                            <GameRenderer 
                                game={game.current} 
                                onPositionUpdate={handlePositionUpdate}
                            />
                        )}
                    </Suspense>
                </Canvas>
            </KeyboardControls>
            {!gameStarted && <StartMenu onStart={handleGameStart} />}
            {gameStarted && (
                <Minimap 
                    playerPosition={playerPosition} 
                    arenaSize={arenaSize} 
                    trailPoints={trailPoints}
                />
            )}
        </>
    );
}; 