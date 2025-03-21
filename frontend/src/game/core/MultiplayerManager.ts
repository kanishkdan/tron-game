import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { LightCycle } from './LightCycle';
import { Player } from '../../network/gameClient';

// Constants for performance optimization
const UPDATE_FREQUENCY = 0.03; // Only update visuals at 30Hz
const POSITION_LERP_FACTOR = 0.2; // Smoother interpolation
const ROTATION_LERP_FACTOR = 0.3; // Quicker rotation updates
const MAX_VISIBLE_DISTANCE = 300; // Only show players within this distance
const MAX_PLAYERS_WITH_PHYSICS = 10; // Maximum number of players with full physics

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

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;
        this.world = world;
    }

    setLocalPlayerId(playerId: string) {
        this.localPlayerId = playerId;
    }

    setLocalPlayerPosition(position: THREE.Vector3) {
        this.localPlayerPosition.copy(position);
    }

    addPlayer(playerId: string, position?: { x: number; y: number; z: number }) {
        console.log(`Adding remote player: ${playerId}`);
        
        // Don't add the local player twice
        if (playerId === this.localPlayerId) {
            console.log("Skipping local player");
            return;
        }

        // Remove any existing instance first
        this.removePlayer(playerId);

        try {
            // If we have too many remote players already, use a simplified representation
            const shouldUseSimplifiedPhysics = this.remotePlayers.size >= MAX_PLAYERS_WITH_PHYSICS;
            
            // Create a remote player's light cycle with a dummy collision handler
            const cycle = new LightCycle(this.scene, this.world, () => {
                console.log(`Remote player ${playerId} collision`);
            });
            
            // If using simplified physics, modify the cycle's behavior
            if (shouldUseSimplifiedPhysics) {
                // Make it not affect other objects' physics
                const body = (cycle as any).body;
                if (body) {
                    body.type = CANNON.Body.KINEMATIC;
                    body.collisionResponse = false;
                }
            }
            
            // Store the player
            this.remotePlayers.set(playerId, cycle);
            
            // Set initial position if provided
            if (position) {
                console.log(`Setting initial position for ${playerId}:`, position);
                this.remotePositions.set(playerId, new THREE.Vector3(
                    position.x || 0, 
                    position.y || 0.5, 
                    position.z || 0
                ));
                
                // Also store for minimap
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
            
            return cycle;
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
        
        // Create the player if they don't exist
        if (!this.remotePlayers.has(playerId)) {
            console.log(`Creating player on position update: ${playerId}`);
            this.addPlayer(playerId, position);
            return;
        }

        // Store the target position/rotation for smooth interpolation
        this.remotePositions.set(
            playerId, 
            new THREE.Vector3(position.x, position.y || 0.5, position.z)
        );
        
        // Update minimap position
        this.enemyPositions.set(playerId, {x: position.x, z: position.z});
        
        if (rotation !== undefined) {
            this.remoteRotations.set(playerId, rotation);
            
            // Immediately apply rotation to get better visual feedback
            const cycle = this.remotePlayers.get(playerId);
            if (cycle) {
                const currentRotation = cycle.getRotation();
                // Determine turn direction based on shortest path to target rotation
                const diff = ((rotation - currentRotation) + Math.PI) % (Math.PI * 2) - Math.PI;
                const direction = diff > 0 ? 'left' : diff < 0 ? 'right' : null;
                
                if (direction) {
                    cycle.move(direction);
                    // After turning, reset to straight
                    setTimeout(() => cycle.move(null), 100);
                }
            }
        }
    }

    update(deltaTime: number) {
        this.updateAccumulator += deltaTime;
        
        // Only update visual positions periodically to improve performance
        if (this.updateAccumulator >= UPDATE_FREQUENCY) {
            this.updateAccumulator = 0;
            
            let visiblePlayerCount = 0;
            
            this.remotePlayers.forEach((player, id) => {
                if (id === this.localPlayerId) return;
                
                // Get target position and rotation
                const targetPosition = this.remotePositions.get(id);
                const targetRotation = this.remoteRotations.get(id);
                
                if (targetPosition && targetRotation !== undefined) {
                    // Skip visual updates for distant players
                    const distanceToPlayer = this.localPlayerPosition.distanceTo(targetPosition);
                    if (distanceToPlayer > MAX_VISIBLE_DISTANCE) {
                        // Still update position for the minimap
                        this.enemyPositions.set(id, {
                            x: targetPosition.x,
                            z: targetPosition.z
                        });
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
                        
                        // Also update enemy position for minimap immediately
                        this.enemyPositions.set(id, {
                            x: currentPosition.x,
                            z: currentPosition.z
                        });
                    }
                }
            });
            
            // Log performance info occasionally
            const now = performance.now();
            if (now - this.lastPerformanceLog > 5000) {
                console.log(`Multiplayer: ${this.remotePlayers.size} total players, ${visiblePlayerCount} visible`);
                this.lastPerformanceLog = now;
            }
        }
        
        // Update all remote players
        this.remotePlayers.forEach((player, id) => {
            if (id !== this.localPlayerId) {
                player.update(deltaTime);
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