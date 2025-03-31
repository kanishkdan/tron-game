import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { LightCycle, LOD_HIGH, LOD_MEDIUM, LOD_LOW } from './LightCycle';
import { Player } from '../../network/gameClient';

// Constants for performance optimization
const UPDATE_FREQUENCY = 0.016; // 60Hz for smoother updates
const POSITION_LERP_FACTOR = 0.4; // More aggressive position interpolation
const ROTATION_LERP_FACTOR = 0.5; // Quicker rotation updates
const MAX_VISIBLE_DISTANCE = 300; // Only show nearby players
const PHYSICS_UPDATE_INTERVAL = 0.05; // 20Hz for physics updates
const LOD_DISTANCE_HIGH = 100; // High detail within 100 units
const LOD_DISTANCE_MEDIUM = 200; // Medium detail within 200 units
const ARENA_SIZE = 2500; // Arena size matches LightCycle's ARENA_SIZE * SIZE_MULTIPLIER

export class MultiplayerManager {
    private remotePlayers: Map<string, LightCycle> = new Map();
    private remotePositions: Map<string, THREE.Vector3> = new Map();
    private remoteRotations: Map<string, number> = new Map();
    private remoteLODLevels: Map<string, number> = new Map();
    private scene: THREE.Scene;
    private world: CANNON.World;
    private localPlayerId: string | null = null;
    private localPlayerName: string | null = null;
    private localPlayerPosition: THREE.Vector3 = new THREE.Vector3();
    private updateAccumulator: number = 0;
    private physicsAccumulator: number = 0;
    private enemyPositions: Map<string, {x: number, z: number}> = new Map();
    private resourcesInitialized: boolean = false;
    private pendingRemovals: string[] = [];
    private removalTimer: number = 0;
    private playerNames: Map<string, string> = new Map();
    private isGameStarted: boolean = false;
    private playerStarted: Set<string> = new Set();
    private camera?: THREE.Camera;

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;
        this.world = world;
        this.initializeSharedResources();
    }

    // Initialize shared resources once for all bikes
    private initializeSharedResources() {
        if (!this.resourcesInitialized) {
            // Initialize shared models, materials and geometries in LightCycle
            LightCycle.initializeSharedResources(this.scene);
            this.resourcesInitialized = true;
        }
    }

    setLocalPlayerId(playerId: string, playerName: string) {
        this.localPlayerId = playerId;
        this.localPlayerName = playerName;
        this.playerNames.set(playerId, playerName);
        this.isGameStarted = true; // Set game as started when local player ID is set
    }

    setLocalPlayerPosition(position: THREE.Vector3) {
        this.localPlayerPosition.copy(position);
    }

    getPlayerName(playerId: string): string {
        return this.playerNames.get(playerId) || playerId;
    }

    addPlayer(playerId: string, position?: { x: number; y: number; z: number }, playerName?: string) {
        // Only add players when the game has started and local player ID is set
        if (!this.isGameStarted || !this.localPlayerId) {
            console.log("Game not started yet, skipping player addition:", playerId);
            return;
        }
        
        console.log(`Adding remote player: ${playerId}`);
        
        // Skip if this is the local player
        if (playerId === this.localPlayerId) {
            console.log("Skipping local player");
            return;
        }
        
        // Also skip if player ID is empty or invalid
        if (!playerId || playerId === 'null' || playerId === 'undefined') {
            console.error("Invalid player ID, skipping creation");
            return;
        }

        // Store player name
        this.playerNames.set(playerId, playerName || playerId);

        // Forcefully remove any existing instance of this player first to ensure clean state
        this.forceRemovePlayer(playerId);
        
        // Create new bike after ensuring cleanup is complete
        try {
            const cycle = new LightCycle(
                this.scene,
                position ? new THREE.Vector3(position.x, position.y || 0.5, position.z) : new THREE.Vector3(0, 0.5, 0),
                this.world,
                () => console.log(`Remote player ${playerId} collision`),
                undefined,
                true, // Use shared resources flag to activate trails immediately
                undefined, // No custom color for remote players (can be added later)
                playerName || playerId // Pass the player name here
            );
            
            // Set the camera for the remote player's cycle
            if (this.camera) {
                cycle.setCamera(this.camera);
            }

            this.remotePlayers.set(playerId, cycle);
            
            if (position) {
                const pos = new THREE.Vector3(position.x, position.y || 0.5, position.z);
                this.remotePositions.set(playerId, pos);
                this.enemyPositions.set(playerId, { x: position.x, z: position.z });
            } else {
                this.remotePositions.set(playerId, new THREE.Vector3(0, 0.5, 0));
                this.enemyPositions.set(playerId, { x: 0, z: 0 });
            }
            
            this.remoteRotations.set(playerId, 0);
            this.remoteLODLevels.set(playerId, LOD_LOW);
            this.playerStarted.add(playerId); // Mark this player as started
            return cycle;
        } catch (error) {
            console.error(`Error creating remote player ${playerId}:`, error);
        }
    }

    // Method for immediate and thorough removal
    forceRemovePlayer(playerId: string) {
        console.log(`Force removing player ${playerId}`);
        const cycle = this.remotePlayers.get(playerId);
        if (cycle) {
            try {
                // IMMEDIATE ACTIONS: Hide trails and remove physics
                cycle.hideTrailsImmediately();  // Use the new public method
                
                // Immediately remove physics body
                const physicsBody = cycle.getPhysicsBody();
                if (physicsBody && physicsBody.world) {
                    try {
                        this.world.removeBody(physicsBody);
                    } catch (e) {
                        console.error(`Error removing physics body for ${playerId}:`, e);
                    }
                }

                // Remove from maps immediately
                this.remotePlayers.delete(playerId);
                this.remotePositions.delete(playerId);
                this.remoteRotations.delete(playerId);
                this.enemyPositions.delete(playerId);
                this.remoteLODLevels.delete(playerId);
                this.playerStarted.delete(playerId);

                // Schedule full cleanup for the next frame
                requestAnimationFrame(() => {
                    try {
                        // Full cleanup in background
                        cycle.cleanupTrails();
                        cycle.dispose();
                    } catch (e) {
                        console.error(`Error during background cleanup for ${playerId}:`, e);
                    }
                });
            } catch (e) {
                console.error(`Error during cycle cleanup for ${playerId}:`, e);
            }
        }
    }

    removePlayer(playerId: string) {
        console.log(`Removing player ${playerId}`);
        
        // Perform immediate removal - no scheduling or delays
        this.forceRemovePlayer(playerId);
        
        // Double check all maps to ensure complete removal
        const maps = [
            this.remotePlayers,
            this.remotePositions,
            this.remoteRotations,
            this.enemyPositions,
            this.remoteLODLevels
        ];
        
        // Ensure player is completely removed from all maps
        maps.forEach(map => {
            if (map.has(playerId)) {
                console.log(`Found player ${playerId} still in a map, removing...`);
                map.delete(playerId);
            }
        });
        
        // Also remove from started players set
        this.playerStarted.delete(playerId);
    }

    updatePlayerPosition(playerId: string, position: { x: number; y: number; z: number }, rotation?: number) {
        // Skip updates if game hasn't started
        if (!this.isGameStarted) return;
        
        if (playerId === this.localPlayerId) return;
        
        // If player doesn't exist, add them
        if (!this.remotePlayers.has(playerId)) {
            this.addPlayer(playerId, position);
            return;
        }

        const cycle = this.remotePlayers.get(playerId);
        if (!cycle) return;

        // Store position for interpolation
        this.remotePositions.set(playerId, new THREE.Vector3(position.x, position.y || 0.5, position.z));
        this.enemyPositions.set(playerId, { x: position.x, z: position.z });
        
        if (rotation !== undefined) {
            this.remoteRotations.set(playerId, rotation);
            cycle.setRotation(rotation || 0);
        }

        // Update LOD level based on distance for better performance
        const distanceToPlayer = this.localPlayerPosition.distanceTo(this.remotePositions.get(playerId)!);
        
        if (distanceToPlayer < LOD_DISTANCE_HIGH) {
            this.remoteLODLevels.set(playerId, LOD_HIGH);
            cycle.setLODLevel(LOD_HIGH);
        } else if (distanceToPlayer < LOD_DISTANCE_MEDIUM) {
            this.remoteLODLevels.set(playerId, LOD_MEDIUM);
            cycle.setLODLevel(LOD_MEDIUM);
        } else {
            this.remoteLODLevels.set(playerId, LOD_LOW);
            cycle.setLODLevel(LOD_LOW);
        }
        
        // Update physics for all players
        const tmpBody = cycle.getBody();
        if (tmpBody) {
            // Update physics body velocity based on rotation
            const forward = new THREE.Vector3(
                Math.sin(rotation || 0),
                0,
                Math.cos(rotation || 0)
            );
            tmpBody.velocity.x = forward.x * cycle.getCurrentSpeed();
            tmpBody.velocity.z = forward.z * cycle.getCurrentSpeed();
        }
    }

    update(deltaTime: number) {
        // Skip updates if game hasn't started
        if (!this.isGameStarted) return;
        
        this.updateAccumulator += deltaTime;
        this.physicsAccumulator += deltaTime;
        
        // Update each remote player's LightCycle instance
        this.remotePlayers.forEach((player, id) => {
            if (id === this.localPlayerId) return;
            
            // Always update at full detail
            player.update(deltaTime, false); // Never skip trails
            
            // Check for collisions or out-of-bounds
            const position = player.getPosition();
            const boundary = ARENA_SIZE / 2 - 5;
            
            if (Math.abs(position.x) > boundary || Math.abs(position.z) > boundary) {
                console.log(`Player ${id} out of bounds, removing`);
                this.removePlayer(id);
                return;
            }
            
            // Check for collisions with other players' trails
            this.checkPlayerCollisions(player, id);
        });
        
        // Reset update accumulators
        if (this.updateAccumulator >= UPDATE_FREQUENCY) {
            this.updateAccumulator = 0;
            
            this.remotePlayers.forEach((player, id) => {
                if (id === this.localPlayerId) return;
                
                const targetPosition = this.remotePositions.get(id);
                const targetRotation = this.remoteRotations.get(id);
                
                if (targetPosition && targetRotation !== undefined) {
                    const currentPosition = player.getPosition();
                    currentPosition.lerp(targetPosition, POSITION_LERP_FACTOR);
                    
                    const body = player.getBody();
                    if (body) {
                        body.position.copy(currentPosition as any);
                    }
                }
            });
        }
    }
    
    // Check if a player collides with any other player's trail
    private checkPlayerCollisions(cycle: LightCycle, playerId: string) {
        const position = cycle.getPosition();
        
        // Skip collision detection for this player during activation phase
        const creationTime = cycle.getCreationTime ? cycle.getCreationTime() : 0;
        const elapsedTime = creationTime ? performance.now() - creationTime : Number.MAX_VALUE;
        const isImmuneLocalPlayer = elapsedTime < 5000; // 5 seconds immunity
        
        if (isImmuneLocalPlayer) {
            return; // Skip collision detection during immunity period
        }
        
        // Check against all other players' trails
        this.remotePlayers.forEach((otherCycle, otherId) => {
            // Skip checking against own trail
            if (otherId === playerId) return;
            
            // Get the other player's trail points
            const trailPoints = otherCycle.getTrailPoints();
            if (trailPoints.length < 2) return;
            
            // Check each trail segment for collision
            for (let i = 0; i < trailPoints.length - 1; i++) {
                const point = trailPoints[i];
                const nextPoint = trailPoints[i + 1];
                
                // Calculate distance from bike to trail segment
                const distanceToSegment = this.pointToLineDistance(
                    position,
                    point,
                    nextPoint
                );
                
                if (distanceToSegment < 2) { // Collision threshold
                    console.log(`Player ${playerId} collided with ${otherId}'s trail`);
                    this.removePlayer(playerId);
                    return;
                }
            }
        });
    }
    
    // Helper method to calculate point to line segment distance
    private pointToLineDistance(point: THREE.Vector3, lineStart: THREE.Vector3, lineEnd: THREE.Vector3): number {
        const line = new THREE.Vector3().subVectors(lineEnd, lineStart);
        const len = line.length();
        if (len === 0) return point.distanceTo(lineStart);

        // Project point onto line
        const t = Math.max(0, Math.min(1, point.clone().sub(lineStart).dot(line) / (len * len)));
        const projection = lineStart.clone().add(line.multiplyScalar(t));
        
        // Return distance to projection point
        return point.distanceTo(projection);
    }

    // Remove LOD-based updates since we're keeping everything in high detail
    private updatePlayerLODs() {
        this.remotePlayers.forEach((player, id) => {
            if (id === this.localPlayerId) return;
            player.setLODLevel(LOD_HIGH);
        });
    }

    getEnemyPositions(): {id: string, position: {x: number, z: number}}[] {
        // Only return enemy positions when the game has started
        if (!this.isGameStarted) return [];
        
        return Array.from(this.enemyPositions.entries()).map(([id, pos]) => ({
            id,
            position: pos
        }));
    }

    // Add method to expose remote players for collision detection
    getRemotePlayers(): Map<string, LightCycle> {
        return this.remotePlayers;
    }

    // Add method to update local player reference when restarting
    updateLocalPlayer(cycle: LightCycle) {
        console.log('[DEBUG] Updating local player reference');
        
        // Remove from remote players if mistakenly added
        if (this.localPlayerId) {
            this.remotePlayers.delete(this.localPlayerId);
            // Also remove from enemy positions to prevent ghost dots
            this.enemyPositions.delete(this.localPlayerId);
        }
        
        // Update enemy positions for minimap visibility
        const pos = cycle.getPosition();
        if (this.localPlayerId) {
            this.enemyPositions.set(this.localPlayerId, { x: pos.x, z: pos.z });
        }
        
        // Delay notifying other players about new position
        setTimeout(() => {
            if (this.localPlayerId) {
                this.remotePositions.set(this.localPlayerId, pos);
            }
        }, 100);
    }

    clear() {
        console.log("Clearing all multiplayer resources");
        
        // Make a copy of the keys to avoid modification during iteration
        const playerIds = Array.from(this.remotePlayers.keys());
        
        // First remove all physics bodies to prevent physics engine issues
        playerIds.forEach(id => {
            const cycle = this.remotePlayers.get(id);
            if (cycle) {
                try {
                    const body = cycle.getPhysicsBody();
                    if (body && body.world) {
                        this.world.removeBody(body);
                    }
                } catch (e) {
                    console.error(`Error removing physics body for ${id}:`, e);
                }
            }
        });
        
        // Then dispose all resources
        playerIds.forEach(id => {
            const cycle = this.remotePlayers.get(id);
            if (cycle) {
                try {
                    cycle.cleanupTrails();
                    cycle.dispose();
                } catch (e) {
                    console.error(`Error disposing cycle for ${id}:`, e);
                }
            }
            
            // Clear from all maps
            this.remotePlayers.delete(id);
            this.remotePositions.delete(id);
            this.remoteRotations.delete(id);
            this.enemyPositions.delete(id);
            this.remoteLODLevels.delete(id);
        });
        
        this.playerStarted.clear();
        
        // Clean up shared resources when clearing everything
        LightCycle.cleanupSharedResources();
    }

    // Add method to set the camera
    setCamera(camera: THREE.Camera) {
        this.camera = camera;
    }
} 