import { Canvas, RootState, useThree, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { PerspectiveCamera, KeyboardControls } from '@react-three/drei';
import { Suspense, useRef, useState, useEffect } from 'react';
import StartMenu from './StartMenu';
import { TronGame, TrailActivationEvent } from './core/TronGame';
import { CameraController } from './core/CameraController';
import { Minimap } from '../components/Minimap';
import { Ground } from './Ground';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameClient } from '../network/gameClient';
import { MultiplayerManager } from './core/MultiplayerManager';
import { TrailActivationDisplay } from '../components/TrailActivationDisplay';
import { PerformanceDisplay } from '../components/PerformanceDisplay';

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

const GameRenderer = ({ 
    game, 
    onPositionUpdate, 
    gameClient,
    onEnemyPositionsUpdate,
    onTrailActivationUpdate
}: { 
    game: TronGame; 
    onPositionUpdate: (pos: { x: number; y: number; z: number }, trailPoints: { x: number; z: number }[]) => void;
    gameClient: GameClient;
    onEnemyPositionsUpdate: (enemies: {id: string, position: {x: number, z: number}}[]) => void;
    onTrailActivationUpdate: (event: TrailActivationEvent) => void;
}) => {
    const { camera, gl, scene } = useThree();
    const cameraController = useRef<CameraController>();
    const multiplayerManager = useRef<MultiplayerManager>();
    const world = useRef<CANNON.World>();
    const lastUpdateTime = useRef<number>(0);
    const lastEnemyUpdateTime = useRef<number>(0);
    const updateInterval = 100; // Send position updates every 100ms
    const enemyUpdateInterval = 200; // Update enemy positions on minimap every 200ms

    useEffect(() => {
        window.gameRenderer = gl;
        
        // Initialize physics world for remote players
        world.current = new CANNON.World();
        world.current.gravity.set(0, -19.81, 0);
        
        // Initialize multiplayer manager with trail activation callback
        multiplayerManager.current = new MultiplayerManager(
            scene, 
            world.current,
            onTrailActivationUpdate
        );
        
        // Connect multiplayer manager with game instance
        if (game) {
            multiplayerManager.current.setGameInstance(game);
            console.log('[DEBUG] Connected MultiplierManager to TronGame instance');
        } else {
            console.error('[DEBUG] No game instance available when setting up MultiplayerManager');
        }
        
        // Set local player ID
        multiplayerManager.current.setLocalPlayerId(gameClient.getPlayerId() || '');
        console.log(`[DEBUG] Set local player ID: ${gameClient.getPlayerId()}`);

        // Set up WebSocket event handlers
        gameClient.on('player_joined', (data) => {
            console.log('[DEBUG] Player joined event:', data);
            if (multiplayerManager.current) {
                multiplayerManager.current.addPlayer(data.player_id);
            } else {
                console.error('[DEBUG] MultiplayerManager not available during player_joined event');
            }
        });

        gameClient.on('player_left', (data) => {
            console.log('[DEBUG] Player left event:', data);
            multiplayerManager.current?.removePlayer(data.player_id);
        });

        gameClient.on('player_moved', (data) => {
            console.log('[DEBUG] Player moved event received:', data);
            // Verify we have position and rotation data
            if (!data.position) {
                console.error('[DEBUG] Missing position data in player_moved event');
                return;
            }
            
            // Pass the proper rotation value to updatePlayerPosition
            const rotation = data.position.rotation !== undefined 
                ? data.position.rotation 
                : undefined;
                
            console.log(`[DEBUG] Updating player ${data.player_id} position:`, 
                data.position, 'rotation:', rotation);
                
            multiplayerManager.current?.updatePlayerPosition(
                data.player_id, 
                data.position,
                rotation
            );
        });

        gameClient.on('game_state', (data) => {
            const localPlayerId = gameClient.getPlayerId();
            console.log('[DEBUG] Game state received:', data);
            console.log(`[DEBUG] Local player ID: ${localPlayerId}`);
            console.log('[DEBUG] All players in game state:', Object.keys(data.players));
            
            const remotePlayerCount = Object.entries(data.players)
                .filter(([id]) => id !== localPlayerId).length;
            console.log(`[DEBUG] Remote players: ${remotePlayerCount}`);
            
            // Handle initial game state
            Object.entries(data.players).forEach(([id, player]: [string, any]) => {
                console.log(`[DEBUG] Processing player ${id} from game state, is local: ${id === localPlayerId}`);
                if (id !== localPlayerId && player.position) {
                    console.log(`[DEBUG] Adding remote player from game state: ${id}, position:`, player.position);
                    multiplayerManager.current?.addPlayer(id, player.position, true);
                } else {
                    console.log(`[DEBUG] Skipping local player ${id} or player without position`);
                }
            });
        });

        return () => {
            window.gameRenderer = undefined;
            multiplayerManager.current?.clear();
        };
    }, [gl, scene, gameClient, game, onTrailActivationUpdate]);

    useEffect(() => {
        if (game.getPlayer()) {
            cameraController.current = new CameraController(
                camera as THREE.PerspectiveCamera,
                game.getPlayer()!
            );
        }
    }, [game, camera]);

    useFrame((state, delta) => {
        // Update camera controller
        if (cameraController.current) {
            cameraController.current.update(delta);
        }
        
        // Get player position and trail points
        const playerPos = game.getPlayer()?.getPosition();
        const playerRotation = game.getPlayer()?.getRotation();
        const trails = game.getPlayer()?.getTrailPoints() || [];
        
        if (playerPos) {
            // Update multiplayer manager's local player position for LOD calculations
            if (multiplayerManager.current) {
                multiplayerManager.current.setLocalPlayerPosition(playerPos);
            }

            // Update local state with position and trail points
            onPositionUpdate(
                playerPos, 
                trails.map(point => ({ x: point.x, z: point.z }))
            );
            
            // Send position update to server (throttled)
            const now = performance.now();
            if (now - lastUpdateTime.current > updateInterval) {
                lastUpdateTime.current = now;
                gameClient.updatePosition({
                    x: playerPos.x,
                    y: playerPos.y,
                    z: playerPos.z,
                    rotation: playerRotation
                });
            }
            
            // Update enemy positions on minimap (throttled)
            if (now - lastEnemyUpdateTime.current > enemyUpdateInterval) {
                lastEnemyUpdateTime.current = now;
                if (multiplayerManager.current) {
                    const enemies = multiplayerManager.current.getEnemyPositions();
                    onEnemyPositionsUpdate(enemies);
                }
            }
        }
        
        // Update multiplayer manager
        if (multiplayerManager.current) {
            multiplayerManager.current.update(delta);
        }
    });

    return null;
};

export const GameScene = () => {
    const [gameStarted, setGameStarted] = useState(false);
    const [playerName, setPlayerName] = useState<string>();
    const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0, z: 0 });
    const [trailPoints, setTrailPoints] = useState<{ x: number; z: number }[]>([]);
    const [enemyPositions, setEnemyPositions] = useState<{id: string, position: {x: number, z: number}}[]>([]);
    const [arenaSize, setArenaSize] = useState(500);
    const [trailActivationEvents, setTrailActivationEvents] = useState<Map<string, number>>(new Map());
    const scene = useRef<THREE.Scene>();
    const game = useRef<TronGame>();
    const gameClient = useRef<GameClient>();

    // Handle trail activation events
    const handleTrailActivation = (event: TrailActivationEvent) => {
        setTrailActivationEvents(prev => {
            const newMap = new Map(prev);
            newMap.set(event.playerId, event.secondsRemaining);
            // Remove completed activations after a short delay
            if (event.secondsRemaining === 0) {
                setTimeout(() => {
                    setTrailActivationEvents(current => {
                        const updatedMap = new Map(current);
                        updatedMap.delete(event.playerId);
                        return updatedMap;
                    });
                }, 1000);
            }
            return newMap;
        });
    };

    const handleGameStart = async (name: string) => {
        try {
            // Initialize game client
            gameClient.current = new GameClient();
            await gameClient.current.connect(name);
            
            setPlayerName(name);
            setGameStarted(true);
            
            if (scene.current) {
                const physicsWorld = new CANNON.World();
                physicsWorld.gravity.set(0, -19.81, 0);
                physicsWorld.defaultContactMaterial.friction = 0.1;
                physicsWorld.defaultContactMaterial.restitution = 0.2;
                
                // Create game with trail activation callback
                game.current = new TronGame(
                    scene.current, 
                    physicsWorld,
                    handleTrailActivation
                );
                
                game.current.start(name);
                
                if (game.current) {
                    setArenaSize(game.current.getArenaSize());
                }
            }
        } catch (error) {
            console.error('Failed to connect to game server:', error);
            // Handle connection error (show message to user, etc.)
        }
    };

    const handlePositionUpdate = (pos: { x: number; y: number; z: number }, trail: { x: number; z: number }[]) => {
        setPlayerPosition(pos);
        setTrailPoints(trail);
    };
    
    const handleEnemyPositionsUpdate = (enemies: {id: string, position: {x: number, z: number}}[]) => {
        setEnemyPositions(enemies);
    };

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (gameClient.current) {
                gameClient.current.disconnect();
            }
        };
    }, []);

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
                        <Physics>
                            <SceneLighting />
                            <Ground />
                            <PerspectiveCamera
                                makeDefault
                                position={[0, 8, 25]}
                                rotation={[-0.3, 0, 0]}
                                fov={75}
                            />
                            {gameStarted && game.current && gameClient.current && (
                                <GameRenderer 
                                    game={game.current} 
                                    onPositionUpdate={handlePositionUpdate}
                                    gameClient={gameClient.current}
                                    onEnemyPositionsUpdate={handleEnemyPositionsUpdate}
                                    onTrailActivationUpdate={handleTrailActivation}
                                />
                            )}
                        </Physics>
                    </Suspense>
                </Canvas>
            </KeyboardControls>
            {!gameStarted && <StartMenu onStart={handleGameStart} />}
            {gameStarted && (
                <>
                    <Minimap 
                        playerPosition={playerPosition} 
                        arenaSize={arenaSize} 
                        trailPoints={trailPoints}
                        enemyPositions={enemyPositions}
                    />
                    <TrailActivationDisplay trailActivationEvents={trailActivationEvents} />
                </>
            )}
        </>
    );
}; 