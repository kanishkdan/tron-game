import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { LightCycle } from './LightCycle';
import { Player } from '../../network/gameClient';
import { TronGame, TrailActivationEvent } from './TronGame';

// Constants for performance optimization
const UPDATE_FREQUENCY = 0.03; // Only update visuals at 30Hz
const POSITION_LERP_FACTOR = 0.2; // Smoother interpolation
const ROTATION_LERP_FACTOR = 0.3; // Quicker rotation updates
const MAX_VISIBLE_DISTANCE = 300; // Only show players within this distance
const MAX_PLAYERS_WITH_PHYSICS = 10; // Maximum number of players with full physics
const MAX_PLAYERS_TOTAL = 16; // Hard limit on total players
const JOIN_THROTTLE_TIME = 500; // Minimum ms between player joins

export class MultiplayerManager {
    private remotePlayers: Map<string, LightCycle> = new Map();
    private remotePositions: Map<string, THREE.Vector3> = new Map();
    private remoteRotations: Map<string, number> = new Map();
    private scene: THREE.Scene;
    private world: CANNON.World;
    private localPlayerId: string | null = null;
    private localPlayerPosition: THREE.Vector3 = new THREE.Vector3();
    private updateAccumulator: number = 0;
    // Store enemy positions for minimap
    private enemyPositions: Map<string, {x: number, z: number}> = new Map();
    // For debugging
    private lastPerformanceLog: number = 0;
    // Optional callback for trail activation events
    private onTrailActivationUpdate?: (event: TrailActivationEvent) => void;
    // Game instance reference
    private game?: TronGame;
    // Add new properties for throttling player joins
    private lastPlayerJoinTime: number = 0;
    private pendingJoins: Map<string, {position?: { x: number; y: number; z: number }, attempts: number}> = new Map();
    private readonly MAX_JOIN_ATTEMPTS = 3;
    private readonly tempVector = new THREE.Vector3(); // Reusable vector to avoid allocations

    constructor(
        scene: THREE.Scene, 
        world: CANNON.World,
        onTrailActivationUpdate?: (event: TrailActivationEvent) => void
    ) {
        this.scene = scene;
        this.world = world;
        this.onTrailActivationUpdate = onTrailActivationUpdate;
    }

    setLocalPlayerId(playerId: string) {
        this.localPlayerId = playerId;
    }

    setLocalPlayerPosition(position: THREE.Vector3) {
        this.localPlayerPosition.copy(position);
    }
    
    setGameInstance(game: TronGame) {
        this.game = game;
    }

    addPlayer(playerId: string, position?: { x: number; y: number; z: number }) {
        console.log(`Adding remote player: ${playerId}`);
        
        // Don't add the local player twice
        if (playerId === this.localPlayerId) {
            console.log("Skipping local player");
            return;
        }

        // Check if we already have too many players
        if (this.remotePlayers.size >= MAX_PLAYERS_TOTAL) {
            console.warn(`Maximum player limit reached (${MAX_PLAYERS_TOTAL}), rejecting player ${playerId}`);
            return;
        }

        // Throttle player joins to prevent multiple players from joining at the same time
        const now = performance.now();
        if (now - this.lastPlayerJoinTime < JOIN_THROTTLE_TIME) {
            // Queue this player join for later
            console.log(`Throttling join for player ${playerId}, will retry soon`);
            
            // Store in pending joins with position
            const existing = this.pendingJoins.get(playerId);
            this.pendingJoins.set(playerId, {
                position,
                attempts: existing ? existing.attempts + 1 : 1
            });
            
            // Schedule retry with exponential backoff
            const attempts = this.pendingJoins.get(playerId)?.attempts || 1;
            if (attempts <= this.MAX_JOIN_ATTEMPTS) {
                setTimeout(() => {
                    const pendingJoin = this.pendingJoins.get(playerId);
                    if (pendingJoin) {
                        this.pendingJoins.delete(playerId);
                        this.addPlayer(playerId, pendingJoin.position);
                    }
                }, JOIN_THROTTLE_TIME * Math.pow(2, attempts - 1));
            } else {
                console.warn(`Failed to add player ${playerId} after ${attempts} attempts`);
                this.pendingJoins.delete(playerId);
            }
            return;
        }
        
        // Remember the time of this join to throttle future joins
        this.lastPlayerJoinTime = now;

        // Remove any existing instance first
        this.removePlayer(playerId);

        try {
            // Convert position to THREE.Vector3 if provided
            let pos: THREE.Vector3 | undefined;
            if (position) {
                // Use temporary vector to avoid allocations
                this.tempVector.set(
                    position.x || 0, 
                    position.y || 0.5, 
                    position.z || 0
                );
                pos = this.tempVector;
            }
            
            // Use the game instance to create players if available (preferred approach)
            if (this.game) {
                const cycle = this.game.addRemotePlayer(playerId, pos);
                
                // Handle case where cycle creation failed
                if (!cycle) {
                    console.warn(`Failed to create remote player ${playerId} through game instance`);
                    return; // Exit early, don't add to maps
                }
                
                // Store the player
                this.remotePlayers.set(playerId, cycle);
                
                // Set initial position for tracking
                if (position) {
                    // Create a new Vector3 for storage (can't use the temp vector here)
                    const storedPos = new THREE.Vector3(
                        position.x || 0,
                        position.y || 0.5,
                        position.z || 0
                    );
                    this.remotePositions.set(playerId, storedPos);
                    
                    // Store for minimap
                    this.enemyPositions.set(playerId, {
                        x: position.x || 0,
                        z: position.z || 0
                    });
                } else {
                    this.remotePositions.set(playerId, new THREE.Vector3(0, 0.5, 0));
                    this.enemyPositions.set(playerId, {x: 0, z: 0});
                }
                
                // Store initial rotation
                this.remoteRotations.set(playerId, 0);
            } else {
                console.warn("No game instance available, can't add player", playerId);
            }
        } catch (error) {
            console.error(`Error creating remote player ${playerId}:`, error);
        }
    }

    removePlayer(playerId: string) {
        console.log(`Removing remote player: ${playerId}`);
        const cycle = this.remotePlayers.get(playerId);
        if (cycle) {
            try {
                cycle.dispose(); // Clean up resources
            } catch (e) {
                console.error("Error disposing cycle:", e);
            }
            this.remotePlayers.delete(playerId);
            this.remotePositions.delete(playerId);
            this.remoteRotations.delete(playerId);
            this.enemyPositions.delete(playerId);
        }
    }

    updatePlayerPosition(
        playerId: string, 
        position: { x: number; y: number; z: number },
        rotation?: number
    ) {
        // Skip updates for the local player
        if (playerId === this.localPlayerId) {
            return;
        }
        
        try {
            // Create the player if they don't exist
            if (!this.remotePlayers.has(playerId)) {
                this.addPlayer(playerId, position);
                return;
            }

            // Store the target position/rotation for smooth interpolation
            let positionVector = this.remotePositions.get(playerId);
            if (!positionVector) {
                positionVector = new THREE.Vector3();
                this.remotePositions.set(playerId, positionVector);
            }
            
            // Update the existing vector instead of creating a new one
            positionVector.set(position.x, position.y || 0.5, position.z);
            
            // Update minimap position
            let mapPos = this.enemyPositions.get(playerId);
            if (!mapPos) {
                mapPos = {x: position.x, z: position.z};
                this.enemyPositions.set(playerId, mapPos);
            } else {
                mapPos.x = position.x;
                mapPos.z = position.z;
            }
            
            if (rotation !== undefined) {
                this.remoteRotations.set(playerId, rotation);
                
                // Apply rotation with safeguards
                const cycle = this.remotePlayers.get(playerId);
                if (cycle) {
                    const currentRotation = cycle.getRotation();
                    // Determine turn direction based on shortest path to target rotation
                    const diff = ((rotation - currentRotation) + Math.PI) % (Math.PI * 2) - Math.PI;
                    const direction = diff > 0 ? 'left' : diff < 0 ? 'right' : null;
                    
                    if (direction) {
                        cycle.move(direction);
                        // After turning, reset to straight with safety check
                        setTimeout(() => {
                            if (this.remotePlayers.has(playerId)) {
                                const updatedCycle = this.remotePlayers.get(playerId);
                                if (updatedCycle) {
                                    updatedCycle.move(null);
                                }
                            }
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error(`Error updating position for player ${playerId}:`, error);
        }
    }

    update(deltaTime: number) {
        // Process any pending player joins first if we can
        if (performance.now() - this.lastPlayerJoinTime >= JOIN_THROTTLE_TIME && this.pendingJoins.size > 0) {
            // Get first entry from pendingJoins in a type-safe way
            const firstPlayerId = Array.from(this.pendingJoins.keys())[0];
            if (firstPlayerId) {
                const data = this.pendingJoins.get(firstPlayerId);
                this.pendingJoins.delete(firstPlayerId);
                if (data) {
                    this.addPlayer(firstPlayerId, data.position);
                }
            }
        }
        
        this.updateAccumulator += deltaTime;
        
        // Only update visual positions periodically to improve performance
        if (this.updateAccumulator >= UPDATE_FREQUENCY) {
            this.updateAccumulator = 0;
            
            let visiblePlayerCount = 0;
            
            this.remotePlayers.forEach((player, id) => {
                try {
                    if (id === this.localPlayerId) return;
                    
                    // Get target position and rotation
                    const targetPosition = this.remotePositions.get(id);
                    const targetRotation = this.remoteRotations.get(id);
                    
                    if (targetPosition && targetRotation !== undefined) {
                        // Skip visual updates for distant players
                        const distanceToPlayer = this.localPlayerPosition.distanceTo(targetPosition);
                        if (distanceToPlayer > MAX_VISIBLE_DISTANCE) {
                            return;
                        }
                        
                        visiblePlayerCount++;
                        
                        // Get current position and interpolate
                        const currentPosition = player.getPosition();
                        
                        // Smoother interpolation
                        currentPosition.lerp(targetPosition, POSITION_LERP_FACTOR);
                        
                        // Update physics body
                        const body = player.getBody();
                        if (body) {
                            body.position.copy(currentPosition as any);
                            
                            // Update enemy position for minimap
                            let mapPos = this.enemyPositions.get(id);
                            if (!mapPos) {
                                mapPos = {x: currentPosition.x, z: currentPosition.z};
                                this.enemyPositions.set(id, mapPos);
                            } else {
                                mapPos.x = currentPosition.x;
                                mapPos.z = currentPosition.z;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error updating remote player ${id}:`, error);
                    // Remove problematic player
                    this.removePlayer(id);
                }
            });
            
            // Log performance info occasionally
            const now = performance.now();
            if (now - this.lastPerformanceLog > 5000) {
                console.log(`Multiplayer: ${this.remotePlayers.size} total players, ${visiblePlayerCount} visible, ${this.pendingJoins.size} pending`);
                this.lastPerformanceLog = now;
            }
        }
        
        // Update all remote players with try/catch for safety
        this.remotePlayers.forEach((player, id) => {
            try {
                if (id !== this.localPlayerId) {
                    player.update(deltaTime);
                }
            } catch (error) {
                console.error(`Error in update for player ${id}:`, error);
                // Remove problematic player
                this.removePlayer(id);
            }
        });
    }

    // Get enemy positions for minimap
    getEnemyPositions(): {id: string, position: {x: number, z: number}}[] {
        const enemies: {id: string, position: {x: number, z: number}}[] = [];
        this.enemyPositions.forEach((pos, id) => {
            if (id !== this.localPlayerId) {
                enemies.push({id, position: pos});
            }
        });
        return enemies;
    }

    clear() {
        console.log(`Clearing all remote players: ${this.remotePlayers.size}`);
        this.remotePlayers.forEach((cycle, id) => {
            this.removePlayer(id);
        });
    }
} 