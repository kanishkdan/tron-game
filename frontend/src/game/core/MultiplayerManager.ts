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
    private localPlayerPosition: THREE.Vector3 = new THREE.Vector3();
    private updateAccumulator: number = 0;
    private physicsAccumulator: number = 0;
    private enemyPositions: Map<string, {x: number, z: number}> = new Map();
    private resourcesInitialized: boolean = false;
    private pendingRemovals: string[] = [];
    private removalTimer: number = 0;

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

    setLocalPlayerId(playerId: string) {
        this.localPlayerId = playerId;
    }

    setLocalPlayerPosition(position: THREE.Vector3) {
        this.localPlayerPosition.copy(position);
    }

    addPlayer(playerId: string, position?: { x: number; y: number; z: number }) {
        console.log(`Adding remote player: ${playerId}`);
        
        if (playerId === this.localPlayerId) {
            console.log("Skipping local player");
            return;
        }

        // Remove any existing instance first (with gradual cleanup)
        this.schedulePlayerRemoval(playerId);

        try {
            const cycle = new LightCycle(
                this.scene,
                position ? new THREE.Vector3(position.x, position.y || 0.5, position.z) : new THREE.Vector3(0, 0.5, 0),
                this.world,
                () => console.log(`Remote player ${playerId} collision`),
                undefined,
                true // Use shared resources flag
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
    }

    // Schedule player removal to avoid frame drops during player exit
    schedulePlayerRemoval(playerId: string) {
        if (this.remotePlayers.has(playerId) && !this.pendingRemovals.includes(playerId)) {
            this.pendingRemovals.push(playerId);
        }
    }

    // Process removals gradually over multiple frames
    processScheduledRemovals(deltaTime: number) {
        this.removalTimer += deltaTime;
        
        // Process one removal per frame to distribute load
        if (this.pendingRemovals.length > 0 && this.removalTimer > 0.1) {
            const playerId = this.pendingRemovals.shift();
            if (playerId && this.remotePlayers.has(playerId)) {
                this.removePlayer(playerId);
            }
            this.removalTimer = 0;
        }
    }

    removePlayer(playerId: string) {
        console.log(`Removing player ${playerId}`);
        const cycle = this.remotePlayers.get(playerId);
        if (cycle) {
            // Ensure trails are cleaned up
            cycle.cleanupTrails();
            cycle.dispose();
            this.remotePlayers.delete(playerId);
            this.remotePositions.delete(playerId);
            this.remoteRotations.delete(playerId);
            this.enemyPositions.delete(playerId);
            this.remoteLODLevels.delete(playerId);
        }
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
        // Process any pending removals
        this.processScheduledRemovals(deltaTime);
        
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
                this.schedulePlayerRemoval(id);
                return;
            }
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

    clear() {
        this.remotePlayers.forEach((cycle, id) => {
            this.removePlayer(id);
        });
        this.pendingRemovals = [];
    }
} 