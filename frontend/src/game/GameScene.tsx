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
import { KillFeed } from '../components/KillFeed';
import { GameUI } from '../components/GameUI';

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
    onEnemyPositionsUpdate
}: { 
    game: TronGame; 
    onPositionUpdate: (pos: { x: number; y: number; z: number }, trailPoints: { x: number; z: number }[]) => void;
    gameClient: GameClient;
    onEnemyPositionsUpdate: (enemies: {id: string, position: {x: number, z: number}}[]) => void;
}) => {
    const { camera, gl, scene } = useThree();
    const cameraController = useRef<CameraController>();
    const multiplayerManager = useRef<MultiplayerManager>();
    const world = useRef<CANNON.World>();
    const lastUpdateTime = useRef<number>(0);
    const lastEnemyUpdateTime = useRef<number>(0);
    const updateInterval = 50; // Send position updates every 50ms
    const enemyUpdateInterval = 50; // Update enemy positions every 50ms

    useEffect(() => {
        window.gameRenderer = gl;
        
        // Initialize physics world
        world.current = new CANNON.World();
        world.current.gravity.set(0, -19.81, 0);
        
        // Initialize multiplayer manager
        multiplayerManager.current = new MultiplayerManager(scene, world.current);
        multiplayerManager.current.setLocalPlayerId(gameClient.getPlayerId() || '');
        
        // Link multiplayer manager with game if both exist
        if (game && multiplayerManager.current) {
            game.setMultiplayerManager(multiplayerManager.current);
        }

        // Set up WebSocket event handlers
        gameClient.on('player_joined', (data) => {
            console.log('Player joined:', data.player_id);
            multiplayerManager.current?.addPlayer(data.player_id, undefined, data.player_name);
        });

        gameClient.on('player_left', (data) => {
            console.log('Player left:', data.player_id);
            multiplayerManager.current?.removePlayer(data.player_id);
            // Also remove from game if it exists there
            if (game.current) {
                const players = game.current.getPlayers();
                if (players.has(data.player_id)) {
                    const cycle = players.get(data.player_id);
                    if (cycle) {
                        cycle.cleanupTrails();
                        cycle.dispose();
                    }
                    players.delete(data.player_id);
                }
            }
        });

        gameClient.on('player_moved', (data) => {
            multiplayerManager.current?.updatePlayerPosition(
                data.player_id, 
                data.position,
                data.position.rotation
            );
        });

        gameClient.on('game_state', (data) => {
            Object.entries(data.players).forEach(([id, player]: [string, any]) => {
                if (id !== gameClient.getPlayerId() && player.position) {
                    multiplayerManager.current?.addPlayer(id, player.position);
                }
            });
        });

        return () => {
            window.gameRenderer = undefined;
            multiplayerManager.current?.clear();
        };
    }, [gl, scene, gameClient]);

    useEffect(() => {
        if (game.getPlayer()) {
            cameraController.current = new CameraController(
                camera as THREE.PerspectiveCamera,
                game.getPlayer()!
            );
        }
    }, [game, camera]);

    useFrame((state, delta) => {
        // Update camera
        if (cameraController.current) {
            cameraController.current.update(delta);
        }
        
        // Get player state
        const playerPos = game.getPlayer()?.getPosition();
        const playerRotation = game.getPlayer()?.getRotation();
        const trails = game.getPlayer()?.getTrailPoints() || [];
        
        if (playerPos) {
            // Update multiplayer manager's local player position
            if (multiplayerManager.current) {
                multiplayerManager.current.setLocalPlayerPosition(playerPos);
            }

            // Update local state
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
            
            // Update enemy positions (throttled)
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
    const [killMessages, setKillMessages] = useState<Array<{ killer: string; victim: string; timestamp: number }>>([]);
    const scene = useRef<THREE.Scene>();
    const game = useRef<TronGame>();
    const gameClient = useRef<GameClient>();
    const multiplayerManager = useRef<MultiplayerManager>();

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
                    handleTrailActivation,
                    handleKill
                );
                
                game.current.start(name);
                
                // Create and link multiplayer manager
                const mpManager = new MultiplayerManager(scene.current, physicsWorld);
                mpManager.setLocalPlayerId(gameClient.current.getPlayerId() || '', name);
                game.current.setMultiplayerManager(mpManager);
                multiplayerManager.current = mpManager;
                
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

    // Handle kill events
    const handleKill = (killer: string, victim: string) => {
        // Clean up any IDs from the names
        const cleanKiller = killer.split('-')[0];
        const cleanVictim = victim.split('-')[0];
        
        console.log(`Kill event: ${cleanKiller} killed ${cleanVictim}`);
        
        // Report kill to server to broadcast to all players
        if (gameClient.current) {
            gameClient.current.reportKill(cleanKiller, cleanVictim);
        }
        
        // Update local kill feed
        setKillMessages(prev => {
            // Add new message
            const newMessages = [...prev, { 
                killer: cleanKiller, 
                victim: cleanVictim, 
                timestamp: Date.now() 
            }];
            // Keep only last 5 messages
            return newMessages.slice(-5);
        });

        // Remove old messages after 5 seconds
        setTimeout(() => {
            setKillMessages(prev => prev.filter(msg => Date.now() - msg.timestamp < 5000));
        }, 5000);
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
                                />
                            )}
                        </Physics>
                    </Suspense>
                </Canvas>
            </KeyboardControls>
            {!gameStarted && <StartMenu onStart={handleGameStart} />}
            <GameUI gameStarted={gameStarted} />
            {gameStarted && (
                <>
                    <Minimap 
                        playerPosition={playerPosition} 
                        arenaSize={arenaSize} 
                        trailPoints={trailPoints}
                        enemyPositions={enemyPositions}
                    />
                    <TrailActivationDisplay trailActivationEvents={trailActivationEvents} />
                    <KillFeed messages={killMessages} />
                </>
            )}
        </>
    );
}; 