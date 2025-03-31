import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena';
import { LightCycle } from './LightCycle';
import { PerformanceManager } from './PerformanceManager';
import { MultiplayerManager } from './MultiplayerManager';

// Event for trail activation countdown
export type TrailActivationEvent = {
    playerId: string;
    secondsRemaining: number;
};

export class TronGame {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private player: LightCycle | null = null;
    private arena: Arena | null = null;
    private players: Map<string, LightCycle> = new Map();
    private lastUpdateTime: number = 0;
    private isGameOver: boolean = false;
    private currentPlayer: LightCycle | null = null;
    private readonly SIZE_MULTIPLIER = 5; // Match the multiplier from LightCycle.ts
    private readonly ARENA_SIZE = 500 * this.SIZE_MULTIPLIER;
    private onTrailActivationUpdate?: (event: TrailActivationEvent) => void;
    private multiplayerManager: MultiplayerManager | null = null;
    private onKill?: (killerName: string, victimName: string) => void;

    constructor(
        scene: THREE.Scene, 
        world: CANNON.World,
        onTrailActivationUpdate?: (event: TrailActivationEvent) => void,
        onKill?: (killerName: string, victimName: string) => void
    ) {
        this.scene = scene;
        this.world = world;
        this.onTrailActivationUpdate = onTrailActivationUpdate;
        this.onKill = onKill;

        // Initialize performance manager
        PerformanceManager.getInstance();

        // Create arena with configuration
        this.arena = new Arena(scene, world, {
            size: this.ARENA_SIZE, // Size of the arena with multiplier
            wallHeight: 20 * this.SIZE_MULTIPLIER, // Height of boundary walls
            groundTexturePath: '/segment.jpg' // Using your provided texture
        });
    }

    start(playerName: string) {
        // Calculate initial position for player
        const startPosition = new THREE.Vector3(0, 1, 0);
        
        // Create player's light cycle with trail activation callback
        const playerCycle = new LightCycle(
            this.scene,
            startPosition,
            this.world,
            () => this.handleCollision(playerCycle, "Arena"),
            (secondsRemaining) => {
                if (this.onTrailActivationUpdate) {
                    this.onTrailActivationUpdate({
                        playerId: playerName,
                        secondsRemaining
                    });
                }
            }
        );
        
        this.players.set(playerName, playerCycle);
        this.currentPlayer = playerCycle;

        // Start game loop
        this.lastUpdateTime = performance.now();
        this.update();
    }

    // Add a method to add remote players with delayed trail activation
    addRemotePlayer(playerId: string, position?: THREE.Vector3): LightCycle | null {
        try {
            console.log(`[DEBUG] TronGame.addRemotePlayer called for ${playerId}, position:`, position);
            
            // Ensure playerId is valid
            if (!playerId || this.players.has(playerId)) {
                console.warn(`[DEBUG] Player ${playerId} already exists in TronGame.players map or has invalid ID`);
                return null;
            }
            
            // Calculate a safe starting position if none provided
            const startPos = position || new THREE.Vector3(
                (Math.random() * 0.5 + 0.1) * this.ARENA_SIZE/2 * (Math.random() > 0.5 ? 1 : -1),
                1,
                (Math.random() * 0.5 + 0.1) * this.ARENA_SIZE/2 * (Math.random() > 0.5 ? 1 : -1)
            );
            
            // Check if position is within arena bounds
            const boundary = this.ARENA_SIZE / 2 - 20;
            startPos.x = Math.min(Math.max(startPos.x, -boundary), boundary);
            startPos.z = Math.min(Math.max(startPos.z, -boundary), boundary);
            
            console.log(`[DEBUG] Creating LightCycle for ${playerId} at position:`, startPos);
            
            try {
                // Create new light cycle with collision and trail callbacks
                // Pass false for useSharedResources to ensure activation delay for all players
                const remoteCycle = new LightCycle(
                    this.scene,
                    startPos,
                    this.world,
                    () => this.handleCollision(remoteCycle, playerId),
                    (secondsRemaining) => {
                        if (this.onTrailActivationUpdate) {
                            this.onTrailActivationUpdate({
                                playerId,
                                secondsRemaining
                            });
                        }
                    },
                    false // Set to false to ensure remote players also have activation delay
                );
                
                // Add to players map
                this.players.set(playerId, remoteCycle);
                console.log(`[DEBUG] Successfully added remote player: ${playerId} at position ${startPos.x}, ${startPos.y}, ${startPos.z}`);
                return remoteCycle;
            } catch (cycleError) {
                console.error(`[DEBUG] Error creating LightCycle for ${playerId}:`, cycleError);
                return null;
            }
        } catch (error) {
            console.error(`[DEBUG] Outer error in addRemotePlayer for ${playerId}:`, error);
            return null;
        }
    }

    getPlayer(): LightCycle | null {
        return this.currentPlayer;
    }

    getPlayers(): Map<string, LightCycle> {
        return this.players;
    }

    getArenaSize(): number {
        return this.ARENA_SIZE;
    }

    // Add method to remove a player by ID
    removePlayer(playerId: string): void {
        // Check if player exists in our map
        if (this.players.has(playerId)) {
            const cycle = this.players.get(playerId);
            if (cycle) {
                // Clean up resources
                cycle.cleanupTrails();
                cycle.dispose();
            }
            // Remove from player map
            this.players.delete(playerId);
            console.log(`Player ${playerId} removed from TronGame`);
        }
    }

    private update = () => {
        if (this.isGameOver) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        this.lastUpdateTime = currentTime;

        // Update performance manager
        PerformanceManager.getInstance().update();

        // Update physics world with fixed timestep for stability
        const fixedTimeStep = 1/60;
        const maxSubSteps = 3;
        this.world.step(fixedTimeStep, deltaTime, maxSubSteps);

        // Update all players
        for (const [name, cycle] of this.players) {
            cycle.update(deltaTime);

            // Check for collisions with light trails
            this.checkCollisions(cycle);
        }

        // Continue game loop
        requestAnimationFrame(this.update);
    }

    private checkCollisions(cycle: LightCycle) {
        // Skip collision detection if trails aren't active yet (immunity period)
        if (!cycle.getTrailsActive()) {
            return;
        }
        
        // Get cycle's current position
        const position = cycle.getPosition();
        
        // Check if cycle is out of bounds first (faster check)
        if (Math.abs(position.x) > this.ARENA_SIZE/2 - 10 || 
            Math.abs(position.z) > this.ARENA_SIZE/2 - 10 || 
            position.y < -10) {
            this.handleCollision(cycle, "Arena");
            return;
        }

        // First check collisions with local players' light trails
        for (const [name, otherCycle] of this.players) {
            // Skip collision check with own trail
            if (otherCycle === cycle) continue;
            
            // Skip collision check with cycles that don't have active trails yet
            if (!otherCycle.getTrailsActive()) continue;

            // Get other cycle's trail segments
            const trailSegments = otherCycle.getLightTrail();
            if (trailSegments.length === 0) continue;
            
            // Get trail points for more precise collision detection
            const trailPoints = otherCycle.getTrailPoints();
            
            // Check each trail point for collision
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
                    this.handleCollision(cycle, name);
                    return;
                }
            }
        }
        
        // Then check collisions with remote players' trails if MultiplayerManager is available
        if (this.multiplayerManager) {
            const remotePlayers = this.multiplayerManager.getRemotePlayers();
            for (const [id, remoteCycle] of remotePlayers) {
                // Skip collision check with cycles that don't have active trails yet
                if (!remoteCycle.getTrailsActive()) continue;
                
                // Get remote cycle's trail points
                const trailPoints = remoteCycle.getTrailPoints();
                if (trailPoints.length < 2) continue;
                
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
                    
                    if (distanceToSegment < 3) { // Increased collision threshold for remote trails
                        this.handleCollision(cycle, id);
                        return;
                    }
                }
            }
        }
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

    private handleCollision(cycle: LightCycle, killerName: string) {
        // Create explosion effect
        this.createExplosion(cycle.getPosition());

        // Remove the cycle
        cycle.dispose();
        
        // Find and remove player
        let isCurrentPlayer = false;
        let playerId: string | null = null;
        
        for (const [name, playerCycle] of this.players) {
            if (playerCycle === cycle) {
                playerId = name;
                this.players.delete(name);
                // Check if this is the current player
                if (cycle === this.currentPlayer) {
                    isCurrentPlayer = true;
                }
                break;
            }
        }
        
        // Notify about the kill
        if (playerId && this.onKill && this.multiplayerManager) {
            if (killerName === "Arena") {
                this.onKill("Arena", this.multiplayerManager.getPlayerName(playerId));
            } else {
                this.onKill(
                    this.multiplayerManager.getPlayerName(killerName),
                    this.multiplayerManager.getPlayerName(playerId)
                );
            }
        }
        
        // Notify MultiplayerManager to remove the crashed player
        if (playerId && this.multiplayerManager) {
            this.multiplayerManager.removePlayer(playerId);
        }
        
        // If this was the current player, restart game after a delay
        if (isCurrentPlayer) {
            setTimeout(() => {
                // Pass a callback to update the camera
                this.restartCurrentPlayer(playerId, (newCycle) => {
                    // Dispatch a custom event that GameRenderer can listen for
                    const event = new CustomEvent('lightcycle_restarted', { detail: { cycle: newCycle } });
                    window.dispatchEvent(event);
                });
            }, 1500);
        }
    }

    // Add a new method to restart the current player without reloading
    private restartCurrentPlayer(playerId: string | null, onRestart?: (cycle: LightCycle) => void) {
        if (!playerId) return;
        
        try {
            // Get player name from the ID (format is name-randomstring)
            const playerName = playerId.split('-')[0];
            if (!playerName) return;
            
            console.log(`[DEBUG] Restarting player ${playerName} after crash`);
            
            // Calculate initial position for player restart
            const startPosition = new THREE.Vector3(
                (Math.random() * 0.5 + 0.1) * this.ARENA_SIZE/2 * (Math.random() > 0.5 ? 1 : -1),
                1,
                (Math.random() * 0.5 + 0.1) * this.ARENA_SIZE/2 * (Math.random() > 0.5 ? 1 : -1)
            );
            
            // Create new player's light cycle with trail activation callback
            const playerCycle = new LightCycle(
                this.scene,
                startPosition,
                this.world,
                () => this.handleCollision(playerCycle, "Arena"),
                (secondsRemaining) => {
                    if (this.onTrailActivationUpdate) {
                        this.onTrailActivationUpdate({
                            playerId: playerId, // Use full player ID to match existing connections
                            secondsRemaining
                        });
                    }
                }
            );
            
            // Add back to players map with the same ID
            this.players.set(playerId, playerCycle);
            this.currentPlayer = playerCycle;
            
            // If we have a multiplayer manager, update it
            if (this.multiplayerManager) {
                this.multiplayerManager.updateLocalPlayer(playerCycle);
            }

            // Notify about the new cycle
            if (onRestart) {
                onRestart(playerCycle);
            }
        } catch (error) {
            console.error("Error restarting player:", error);
        }
    }

    private createExplosion(position: THREE.Vector3) {
        // Create particle system for explosion - further reduce particles for better performance
        const particleCount = 35; // Reduced from 50
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const velocities = new Float32Array(particleCount * 3);

        const color = new THREE.Color(0x0fbef2);
        for (let i = 0; i < particleCount; i++) {
            // Initial position at explosion point
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            // Set color
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Random size
            sizes[i] = Math.random() * 1.5;

            // Initial velocity - more downward and less spread
            velocities[i * 3] = (Math.random() - 0.5) * 4; // Less horizontal spread
            velocities[i * 3 + 1] = Math.random() * 8; // Initial upward velocity
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 4; // Less horizontal spread
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 1,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        // Animate particles with more efficient updates
        let frame = 0;
        const maxFrames = 60; // Limit animation to about 1 second
        const gravity = 0.3; // Reduced gravity effect
        
        const animate = () => {
            frame++;
            
            // Update positions and velocities
            for (let i = 0; i < particleCount; i++) {
                // Update velocity with gravity
                velocities[i * 3 + 1] -= gravity;

                // Update position
                positions[i * 3] += velocities[i * 3] * 0.1;
                positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.1;
                positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.1;
            }
            
            // Update geometry attributes
            geometry.attributes.position.needsUpdate = true;
            
            // Fade out particle system
            material.opacity = Math.max(0, 0.8 * (1 - frame / maxFrames));
            
            if (frame < maxFrames && material.opacity > 0.05) {
                requestAnimationFrame(animate);
            } else {
                // Clean up resources
                this.scene.remove(particles);
                geometry.dispose();
                material.dispose();
            }
        };
        
        animate();
    }

    // Add method to set the multiplayer manager
    setMultiplayerManager(manager: MultiplayerManager): void {
        this.multiplayerManager = manager;
    }
} 