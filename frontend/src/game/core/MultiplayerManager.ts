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
    }

    setLocalPlayerPosition(position: THREE.Vector3) {
        this.localPlayerPosition.copy(position);
    }

    getPlayerName(playerId: string): string {
        return this.playerNames.get(playerId) || playerId;
    }

    addPlayer(playerId: string, position?: { x: number; y: number; z: number }, playerName?: string) {
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

        // Forcefully remove any existing instance of this player first
        this.forceRemovePlayer(playerId);
        
        // Ensure all maps are clean
        const maps = [
            this.remotePlayers,
            this.remotePositions,
            this.remoteRotations,
            this.enemyPositions, 
            this.remoteLODLevels
        ];
        
        maps.forEach(map => {
            if (map.has(playerId)) {
                console.log(`Found stale player ${playerId} in a map, clearing...`);
                map.delete(playerId);
            }
        });

        // Create new bike with a small delay to ensure resources are freed
        setTimeout(() => {
            try {
                const cycle = new LightCycle(
                    this.scene,
                    position ? new THREE.Vector3(position.x, position.y || 0.5, position.z) : new THREE.Vector3(0, 0.5, 0),
                    this.world,
                    () => console.log(`Remote player ${playerId} collision`),
                    undefined,
                    true // Use shared resources flag to activate trails immediately
                );
                
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
                return cycle;
            } catch (error) {
                console.error(`Error creating remote player ${playerId}:`, error);
            }
        }, 50); // Small delay to ensure cleanup
    }

    // New method for immediate and thorough removal without scheduling
    forceRemovePlayer(playerId: string) {
        console.log(`Force removing player ${playerId}`);
        const cycle = this.remotePlayers.get(playerId);
        if (cycle) {
            try {
                // Ensure trails are cleaned up
                cycle.cleanupTrails();
                
                // Remove from scene
                if (cycle.getLightTrail().length > 0) {
                    this.scene.remove(...cycle.getLightTrail());
                }
                
                // Remove physics body
                try {
                    if (cycle.getPhysicsBody() && cycle.getPhysicsBody().world) {
                        this.world.removeBody(cycle.getPhysicsBody());
                    }
                } catch (e) {
                    console.error(`Error removing physics body for ${playerId}:`, e);
                }
                
                // Dispose resources
                cycle.dispose();
            } catch (e) {
                console.error(`Error during cycle cleanup for ${playerId}:`, e);
            }
            
            // Delete from maps
            this.remotePlayers.delete(playerId);
            this.remotePositions.delete(playerId);
            this.remoteRotations.delete(playerId);
            this.enemyPositions.delete(playerId);
            this.remoteLODLevels.delete(playerId);
            
            // Remove from pending removals if it was scheduled
            const pendingIndex = this.pendingRemovals.indexOf(playerId);
            if (pendingIndex !== -1) {
                this.pendingRemovals.splice(pendingIndex, 1);
            }
        }
    }

    removePlayer(playerId: string) {
        console.log(`Removing player ${playerId}`);
        
        // Stop any ongoing operations with this player
        if (this.pendingRemovals.includes(playerId)) {
            const index = this.pendingRemovals.indexOf(playerId);
            this.pendingRemovals.splice(index, 1);
        }
        
        // Clean up the player resources
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
    }

    updatePlayerPosition(playerId: string, position: { x: number; y: number; z: number }, rotation?: number) {
        if (playerId === this.localPlayerId) return;
        
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

        // Update LOD level based on distance
        const distanceToPlayer = this.localPlayerPosition.distanceTo(this.remotePositions.get(playerId)!);
        
        // Keep all players in high detail for better visibility
        this.remoteLODLevels.set(playerId, LOD_HIGH);
        cycle.setLODLevel(LOD_HIGH);
        
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
        // No longer process scheduled removals since we're doing immediate removal
        
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
        return Array.from(this.enemyPositions.entries()).map(([id, pos]) => ({
            id,
            position: pos
        }));
    }

    // Add method to expose remote players for collision detection
    getRemotePlayers(): Map<string, LightCycle> {
        return this.remotePlayers;
    }

    clear() {
        this.remotePlayers.forEach((cycle, id) => {
            this.removePlayer(id);
        });
        this.pendingRemovals = [];
    }
} 