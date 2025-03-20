import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Arena } from './Arena';
import { LightCycle } from './LightCycle';

export class TronGame {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private player: LightCycle | null = null;
    private arena: Arena | null = null;
    private players: Map<string, LightCycle> = new Map();
    private lastUpdateTime: number = 0;
    private isGameOver: boolean = false;
    private currentPlayer: LightCycle | null = null;
    private readonly SIZE_MULTIPLIER = 4; // Match the multiplier from LightCycle.ts
    private readonly ARENA_SIZE = 500 * this.SIZE_MULTIPLIER;

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;
        this.world = world;

        // Create arena with configuration
        this.arena = new Arena(scene, world, {
            size: this.ARENA_SIZE, // Size of the arena with multiplier
            wallHeight: 20 * this.SIZE_MULTIPLIER, // Height of boundary walls
            groundTexturePath: '/segment.jpg' // Using your provided texture
        });
    }

    start(playerName: string) {
        // Create player's light cycle
        const playerCycle = new LightCycle(this.scene, this.world, () => {
            this.handleCollision(playerCycle);
        });
        this.players.set(playerName, playerCycle);
        this.currentPlayer = playerCycle;

        // Start game loop
        this.lastUpdateTime = performance.now();
        this.update();
    }

    getPlayer(): LightCycle | null {
        return this.currentPlayer;
    }

    getArenaSize(): number {
        return this.ARENA_SIZE;
    }

    private update = () => {
        if (this.isGameOver) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        this.lastUpdateTime = currentTime;

        // Update physics world
        this.world.step(1/60, deltaTime, 3);

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
        // Get cycle's current position
        const position = cycle.getPosition();

        // Check collisions with other players' light trails
        for (const [name, otherCycle] of this.players) {
            if (otherCycle === cycle) continue;

            // Get other cycle's trail segments
            const trailSegments = otherCycle.getLightTrail();
            for (const segment of trailSegments) {
                // Simple collision check with trail segments
                const segmentPos = segment.position;
                const distance = position.distanceTo(segmentPos);
                
                if (distance < 2) { // Collision threshold
                    this.handleCollision(cycle);
                    return;
                }
            }
        }

        // Check if cycle is out of bounds
        if (Math.abs(position.x) > this.ARENA_SIZE/2 - 10 || Math.abs(position.z) > this.ARENA_SIZE/2 - 10 || position.y < -10) {
            this.handleCollision(cycle);
        }
    }

    private handleCollision(cycle: LightCycle) {
        // Create explosion effect
        this.createExplosion(cycle.getPosition());

        // Remove the cycle
        cycle.dispose();
        
        // Find and remove player
        for (const [name, playerCycle] of this.players) {
            if (playerCycle === cycle) {
                this.players.delete(name);
                break;
            }
        }

        // Check if game is over
        if (this.players.size <= 1) {
            this.gameOver();
        }
    }

    private createExplosion(position: THREE.Vector3) {
        // Create particle system for explosion
        const particleCount = 100;
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
            velocities[i * 3] = (Math.random() - 0.5) * 5; // Less horizontal spread
            velocities[i * 3 + 1] = Math.random() * 10; // Initial upward velocity
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 5; // Less horizontal spread
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

        // Animate particles with more realistic gravity
        const gravity = 0.5;
        const animate = () => {
            for (let i = 0; i < particleCount; i++) {
                // Update velocity with gravity
                velocities[i * 3 + 1] -= gravity;

                // Update position
                positions[i * 3] += velocities[i * 3] * 0.1;
                positions[i * 3 + 1] += velocities[i * 3 + 1] * 0.1;
                positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.1;

                // Fade out based on height
                const heightFactor = Math.max(0, positions[i * 3 + 1] / 10);
                colors[i * 3 + 3] = color.r * heightFactor;
                colors[i * 3 + 4] = color.g * heightFactor;
                colors[i * 3 + 5] = color.b * heightFactor;
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;

            if (material.opacity > 0) {
                material.opacity -= 0.01;
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(particles);
                geometry.dispose();
                material.dispose();
            }
        };
        animate();
    }

    private gameOver() {
        this.isGameOver = true;
        
        // Clean up resources
        this.players.forEach(cycle => cycle.dispose());
        this.players.clear();
        this.arena?.dispose();
    }

    dispose() {
        this.gameOver();
    }
} 