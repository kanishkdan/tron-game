import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { LightCycle } from './LightCycle';
import { Player } from '../../network/gameClient';

// Constants for performance optimization
const UPDATE_FREQUENCY = 0.03; // 33Hz for smooth updates
const POSITION_LERP_FACTOR = 0.2; // Smooth interpolation
const ROTATION_LERP_FACTOR = 0.3; // Quick rotation updates
const MAX_VISIBLE_DISTANCE = 300; // Only show nearby players

export class MultiplayerManager {
    private remotePlayers: Map<string, LightCycle> = new Map();
    private remotePositions: Map<string, THREE.Vector3> = new Map();
    private remoteRotations: Map<string, number> = new Map();
    private scene: THREE.Scene;
    private world: CANNON.World;
    private localPlayerId: string | null = null;
    private localPlayerPosition: THREE.Vector3 = new THREE.Vector3();
    private updateAccumulator: number = 0;
    private enemyPositions: Map<string, {x: number, z: number}> = new Map();

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
        
        if (playerId === this.localPlayerId) {
            console.log("Skipping local player");
            return;
        }

        // Remove any existing instance first
        this.removePlayer(playerId);

        try {
            const cycle = new LightCycle(
                this.scene,
                position ? new THREE.Vector3(position.x, position.y || 0.5, position.z) : new THREE.Vector3(0, 0.5, 0),
                this.world,
                () => console.log(`Remote player ${playerId} collision`),
                undefined
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
            return cycle;
        } catch (error) {
            console.error(`Error creating remote player ${playerId}:`, error);
        }
    }

    removePlayer(playerId: string) {
        const cycle = this.remotePlayers.get(playerId);
        if (cycle) {
            cycle.dispose();
            this.remotePlayers.delete(playerId);
            this.remotePositions.delete(playerId);
            this.remoteRotations.delete(playerId);
            this.enemyPositions.delete(playerId);
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

        // Update position directly for immediate feedback
        cycle.setPosition(new THREE.Vector3(position.x, position.y || 0.5, position.z));
        
        // Store position for interpolation
        this.remotePositions.set(playerId, new THREE.Vector3(position.x, position.y || 0.5, position.z));
        this.enemyPositions.set(playerId, { x: position.x, z: position.z });
        
        if (rotation !== undefined) {
            this.remoteRotations.set(playerId, rotation);
        }
    }

    update(deltaTime: number) {
        this.updateAccumulator += deltaTime;
        
        if (this.updateAccumulator >= UPDATE_FREQUENCY) {
            this.updateAccumulator = 0;
            
            this.remotePlayers.forEach((player, id) => {
                if (id === this.localPlayerId) return;
                
                const targetPosition = this.remotePositions.get(id);
                const targetRotation = this.remoteRotations.get(id);
                
                if (targetPosition && targetRotation !== undefined) {
                    const distanceToPlayer = this.localPlayerPosition.distanceTo(targetPosition);
                    if (distanceToPlayer > MAX_VISIBLE_DISTANCE) return;
                    
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
    }
} 