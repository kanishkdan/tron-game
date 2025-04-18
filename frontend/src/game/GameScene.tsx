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
import { KillFeed } from '../components/KillFeed';
import { ChatBox } from '../components/ChatBox';
import { GameUI } from '../components/GameUI';

// TTS Helper function
const playTTS = (text: string, playerName?: string) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text.replace('{playername}', playerName || ''));
    
    // Attempt to find a robotic/suitable voice
    const voices = window.speechSynthesis.getVoices();
    
    // Prioritize voices in this order:
    // 1. English robotic voices
    // 2. English non-gendered voices
    // 3. Any English voice
    let selectedVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      /robot|google|automaton|mechanic|neural|synthesized|artificial/i.test(voice.name)
    ) || 
    voices.find(voice => 
      voice.lang.startsWith('en') && 
      !/female|male|girl|boy|woman|man/i.test(voice.name)
    ) ||
    voices.find(voice => 
      voice.lang.startsWith('en')
    );

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('Selected voice:', selectedVoice.name); // Debug log
    }
    
    // Adjust voice parameters for more robotic feel
    utterance.rate = 0.75; // Slightly slower
    utterance.pitch = 1.0; // Lower pitch but not too low
    utterance.volume = 0.9; // Slightly lower volume

    // Ensure voices are loaded (needed on some browsers)
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            const updatedVoices = window.speechSynthesis.getVoices();
            selectedVoice = updatedVoices.find(voice => 
              voice.lang.startsWith('en') && 
              /robot|google|automaton|mechanic|neural|synthesized|artificial/i.test(voice.name)
            ) || 
            updatedVoices.find(voice => 
              voice.lang.startsWith('en') && 
              !/female|male|girl|boy|woman|man/i.test(voice.name)
            ) ||
            updatedVoices.find(voice => 
              voice.lang.startsWith('en')
            );
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('Selected voice after loading:', selectedVoice.name); // Debug log
            }
            window.speechSynthesis.speak(utterance);
        };
    } else {
        window.speechSynthesis.speak(utterance);
    }
  } else {
    console.warn("Browser doesn't support Speech Synthesis.");
  }
};

// Death remarks for when player dies
const deathRemarks = [
    // Tron-themed dark remarks
    "De-resolution complete. Just like your dignity.",
    "End of line, end of your pathetic existence.",
    "User program terminated. User brain cells: nonexistent.",
    "Identity disc compromised. Like your skill level.",
    "Re-calibration required. Maybe try a game for toddlers?",
    "System error. Your existence is the bug in the code.",
    "Cycle destroyed. Just like your hopes and dreams.",
    "You fight for the users... But they're all laughing at you.",
    
    // Savage roasts
    "Did you forget how to ride a bike, or just how to play the game?",
    "Your driving skills make a dumpster fire look organized.",
    "I've seen better driving from a headless chicken.",
    "Your lightcycle moves like it's carrying the weight of your failure.",
    "Did you get your license from the bottom of a trash compactor?",
    "Your trail looks like the EKG of your dying skill level.",
    "A three-legged sloth could outmaneuver you blindfolded.",
    "Your lightcycle needs therapy after being piloted by someone like you.",
    "That was less graceful than a hippo in an ice skating competition.",
    "Your driving style screams 'I peaked in the tutorial.'",
    "Did you learn to drive while heavily sedated?",
    "Your trail resembles your life choices: chaotic and ultimately fatal.",
    "That was about as smooth as gargling broken glass.",
    "Your lightcycle is filing for emotional damage compensation.",
    
    // Darker humor
    "You died as you lived: disappointingly.",
    "The Grid has standards. You clearly don't.",
    "That crash was the most impressive thing you've done all game.",
    "If 'failure' had a mascot, you'd be on the cereal box.",
    "You're the reason why games should have an 'ultra-beginner' difficulty.",
    "Your performance is why AI will replace humans.",
    "The only thing worse than your death is your gameplay.",
    "You make the NPCs look like e-sports champions.",
    "Your skills have been deleted. Nothing of value was lost.",
    "You're so bad even your lightcycle wanted to crash.",
    "Game over. Life suggestion: also over?",
    "That wasn't just a crash, it was an existential surrender.",
    "You didn't just hit a wall, you hit rock bottom.",
    "The Grid rejects you. So does everyone watching you play."
];

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
        multiplayerManager.current.setLocalPlayerId(gameClient.getPlayerId() || '', '');
        
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
            if (game) {
                const players = game.getPlayers();
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

        // Listen for lightcycle restart events
        const handleLightcycleRestart = (event: CustomEvent) => {
            const newCycle = event.detail.cycle;
            if (newCycle && camera instanceof THREE.PerspectiveCamera) {
                console.log('[DEBUG] Updating camera controller for restarted lightcycle');
                cameraController.current = new CameraController(camera, newCycle);
            }
        };

        window.addEventListener('lightcycle_restarted', handleLightcycleRestart as EventListener);

        return () => {
            window.gameRenderer = undefined;
            multiplayerManager.current?.clear();
            window.removeEventListener('lightcycle_restarted', handleLightcycleRestart as EventListener);
        };
    }, [gl, scene, gameClient, camera, game]);

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
    const [sceneReady, setSceneReady] = useState(false);
    const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0, z: 0 });
    const [trailPoints, setTrailPoints] = useState<{ x: number; z: number }[]>([]);
    const [enemyPositions, setEnemyPositions] = useState<{id: string, position: {x: number, z: number}}[]>([]);
    const [arenaSize, setArenaSize] = useState(500);
    const [trailActivationEvents, setTrailActivationEvents] = useState<Map<string, number>>(new Map());
    const [killMessages, setKillMessages] = useState<Array<{ killer: string; victim: string; timestamp: number }>>([]);
    const [chatMessages, setChatMessages] = useState<Array<{ player_name: string; message: string; timestamp: number }>>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [portalPosition, setPortalPosition] = useState<{ x: number; z: number } | null>(null);
    const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
    const [returnPortalUrl, setReturnPortalUrl] = useState<string | null>(null);
    const [returnPortalPosition, setReturnPortalPosition] = useState<{ x: number; z: number } | null>(null);
    const scene = useRef<THREE.Scene>();
    const game = useRef<TronGame>();
    const gameClient = useRef<GameClient>();
    const multiplayerManager = useRef<MultiplayerManager>();

    // Add useEffect to handle URL parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username');
        const refUrl = urlParams.get('ref');
        
        if (username && !gameStarted) {
            // Just set the player name, but don't start game yet
            console.log('[URL Init] Username detected:', username);
            setPlayerName(username);
            
            // Store ref URL in state if it exists
            if (refUrl) {
                console.log('[URL Init] Ref URL detected:', refUrl);
                // Decode the URL to handle any encoded characters
                const decodedRefUrl = decodeURIComponent(refUrl);
                console.log('[URL Init] Decoded ref URL:', decodedRefUrl);
                setReturnPortalUrl(decodedRefUrl);
            } else {
                console.log('[URL Init] No ref URL detected');
            }
        }
    }, []); // Run this effect only once on mount

    // Add a separate effect to handle scene initialization and game start
    useEffect(() => {
        // This effect runs when sceneReady changes to true
        if (sceneReady && playerName && !gameStarted) {
            console.log('[Scene Init] Scene is ready, initializing game with username:', playerName);
            // Scene is now available, initialize game
            handleGameStart(playerName);
        }
    }, [sceneReady, playerName, gameStarted]);

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
            console.log('[Game Start] Starting game with username:', name, 'Scene ready:', !!scene.current);
            
            // Early return if scene isn't ready yet
            if (!scene.current) {
                console.error('Cannot start game - scene not initialized yet');
                return;
            }
            
            // Initialize game client
            gameClient.current = new GameClient();
            await gameClient.current.connect(name);
            
            setPlayerName(name);
            setGameStarted(true);
            
            // Play welcome message
            playTTS("Hey {playername}, welcome to the grid.", name);
            
            // Add event listener for kill events
            gameClient.current.on('player_kill', (data) => {
                console.log(`Received kill event from server: ${data.killer} killed ${data.victim}`);
                
                // Add to kill feed
                setKillMessages(prev => {
                    const newMessages = [...prev, { 
                        killer: data.killer, 
                        victim: data.victim,
                        timestamp: Date.now() 
                    }];
                    return newMessages.slice(-5); // Keep only last 5 messages
                });
                
                // Remove old messages after 5 seconds
                setTimeout(() => {
                    setKillMessages(prev => prev.filter(msg => Date.now() - msg.timestamp < 5000));
                }, 5000);
            });
            
            // Add event listener for chat messages
            gameClient.current.on('chat_message', (data) => {
                console.log(`Received chat message from ${data.player_name}: ${data.message}`);
                
                // Add to chat feed
                setChatMessages(prev => {
                    const newMessages = [...prev, {
                        player_name: data.player_name,
                        message: data.message,
                        timestamp: Date.now()
                    }];
                    return newMessages.slice(-10); // Keep only last 10 messages
                });
                
                // Automatically remove old messages from state after 5 seconds
                setTimeout(() => {
                    setChatMessages(prev => 
                        prev.filter(msg => Date.now() - msg.timestamp < 5000)
                    );
                }, 5000);
            });
            
            if (scene.current) {
                // Create physics world with proper configuration
                const physicsWorld = new CANNON.World();
                physicsWorld.gravity.set(0, -19.81, 0);
                physicsWorld.defaultContactMaterial.friction = 0.1;
                physicsWorld.defaultContactMaterial.restitution = 0.2;
                
                // Ensure camera is available before creating TronGame
                if (!camera) {
                    console.error('Camera not ready when starting game');
                    return;
                }
                
                // Create game with trail activation callback
                game.current = new TronGame(
                    scene.current, 
                    physicsWorld,
                    camera,
                    handleTrailActivation,
                    handleKill,
                    returnPortalUrl
                );

                // Get color from URL parameters if present
                const urlParams = new URLSearchParams(window.location.search);
                const colorParam = urlParams.get('color');
                let customColor: number | undefined;
                
                if (colorParam) {
                    try {
                        // Convert hex string to number
                        customColor = parseInt(colorParam, 16);
                    } catch (error) {
                        console.error('Invalid color parameter:', error);
                    }
                }
                
                // Start the game with the player name and custom color
                game.current.start(name, customColor);
                
                // Create and link multiplayer manager
                const mpManager = new MultiplayerManager(scene.current, physicsWorld);
                mpManager.setLocalPlayerId(gameClient.current.getPlayerId() || '', name);
                if (camera) {
                    mpManager.setCamera(camera);
                }
                game.current.setMultiplayerManager(mpManager);
                multiplayerManager.current = mpManager;
                
                if (game.current) {
                    setArenaSize(game.current.getArenaSize());
                }
            } else {
                console.error('Scene not initialized when starting game');
            }
        } catch (error) {
            console.error('Failed to connect to game server:', error);
            // Handle connection error (show message to user, etc.)
        }
    };

    // Add useEffect for death remarks
    useEffect(() => {
        const handlePlayerDeath = () => {
            if (playerName) {
                const randomRemark = deathRemarks[Math.floor(Math.random() * deathRemarks.length)];
                playTTS(randomRemark, playerName);
            }
        };

        window.addEventListener('local_player_death', handlePlayerDeath);
        return () => {
            window.removeEventListener('local_player_death', handlePlayerDeath);
        };
    }, [playerName]);

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
        
        // Remove the local kill feed update - only rely on the server broadcast
        // to ensure all players see the same messages
    };

    const handleSendChatMessage = (message: string) => {
        if (gameClient.current) {
            gameClient.current.sendChat(message);
        }
    };

    // Handle keyboard events for chat
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only activate chat if game is started and chat is not already open
            if (gameStarted && !isChatOpen && e.key === 't' && !e.repeat) {
                e.preventDefault();
                setIsChatOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [gameStarted, isChatOpen]);

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (gameClient.current) {
                gameClient.current.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        // Fetch portal position once the game starts
        if (gameStarted && game.current) {
            console.log('[GameScene] Fetching portal positions, game started:', gameStarted);
            console.log('[GameScene] Return portal URL:', returnPortalUrl);
            
            const arena = game.current.getArena();
            console.log('[GameScene] Arena exists:', !!arena);
            
            // Get main portal
            const portal = arena?.getPortal();
            if (portal) {
                const pos = portal.getPosition();
                console.log('[GameScene] Main portal found at position:', pos.x, pos.y, pos.z);
                setPortalPosition({ x: pos.x, z: pos.z });
            } else {
                console.log('[GameScene] Main portal not found');
            }
            
            // Get return portal
            const returnPortal = arena?.getReturnPortal();
            if (returnPortal) {
                const returnPos = returnPortal.getPosition();
                console.log('[GameScene] Return portal found at position:', returnPos.x, returnPos.y, returnPos.z);
                setReturnPortalPosition({ x: returnPos.x, z: returnPos.z });
            } else {
                console.log('[GameScene] Return portal not found');
                console.log('[GameScene] Return portal URL:', returnPortalUrl);
            }
        }
    }, [gameStarted, returnPortalUrl]);

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
                <Canvas shadows onCreated={(state: RootState) => { 
                    // Store camera reference in state
                    if (state.camera instanceof THREE.PerspectiveCamera) {
                        setCamera(state.camera);
                    }
                    scene.current = state.scene;
                    console.log('[Canvas] Scene initialized:', !!state.scene);
                    // Set scene ready state to trigger effect
                    setSceneReady(true);
                }}>
                    <Suspense fallback={null}>
                        <Physics>
                            <SceneLighting />
                            <Ground />
                            <PerspectiveCamera
                                makeDefault
                                position={[0, 8, 25]}
                                rotation={[-0.3, 0, 0]}
                                fov={75}
                                near={0.1} // Set near clipping plane
                                far={5000} // Increase far clipping plane significantly
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
            {!gameStarted && !playerName && <StartMenu onStart={handleGameStart} />}
            <GameUI 
                gameStarted={gameStarted} 
                isChatOpen={isChatOpen}
                onOpenChat={() => setIsChatOpen(true)}
            />
            {gameStarted && (
                <Minimap 
                    playerPosition={playerPosition}
                    arenaSize={arenaSize}
                    trailPoints={trailPoints}
                    enemyPositions={enemyPositions}
                    portalPosition={portalPosition}
                    returnPortalPosition={returnPortalPosition}
                />
            )}
            <TrailActivationDisplay trailActivationEvents={trailActivationEvents} />
            <KillFeed messages={killMessages} />
            <ChatBox 
                    messages={chatMessages} 
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)} 
                    onSendMessage={handleSendChatMessage} 
                />
            )
        </>
    );
}; 