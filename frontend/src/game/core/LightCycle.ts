import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as CANNON from 'cannon-es';
import { useKeyboardControls } from '@react-three/drei';

export class LightCycle {
    private mesh!: THREE.Group;
    private body: CANNON.Body;
    private readonly MAX_SPEED = 50;
    private readonly MIN_SPEED = 30;
    private readonly ACCELERATION = 15;
    private readonly DECELERATION = 20;
    private readonly TURN_SPEED = 2.0;
    private readonly BANK_ANGLE = 0.3;
    private readonly GRID_SIZE = 2;
    private readonly ARENA_SIZE = 500;
    private currentSpeed = this.MIN_SPEED;
    private turnDirection = 0;
    private targetRotation = 0;
    private currentRotation = 0;
    private currentBankAngle = 0;
    private targetBankAngle = 0;
    private lightTrail: THREE.Mesh[] = [];
    private lastTrailPosition: THREE.Vector3;
    private trailMaterial: THREE.MeshPhysicalMaterial;
    private trailGeometry: THREE.BoxGeometry;
    private trailPoints: THREE.Vector3[] = [];
    private readonly MAX_TRAIL_POINTS = 50;
    private readonly TRAIL_SEGMENT_DISTANCE = 2;
    private modelLoaded = false;
    private scene: THREE.Scene;
    private rearLight: THREE.PointLight;
    private initialScale = new THREE.Vector3(2.5, 2.5, 2.5);
    private lastGridPosition: THREE.Vector3;
    private isTurning = false;
    private turnStartTime = 0;
    private readonly TURN_DURATION = 0.5;
    private lastUpdateTime = 0;
    private readonly MOVEMENT_UPDATE_RATE = 1000 / 60; // 60 FPS
    private trailLight: THREE.PointLight;
    private readonly MAX_TRAIL_LENGTH = 500; // Maximum trail length in units
    private readonly TRAIL_GROWTH_RATE = 30; // Units per second
    private currentTrailLength = 0;
    private totalTrailDistance = 0;
    private lastTrailPoint: THREE.Vector3 | null = null;
    private trailMeshes: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;

        // Create rear light
        this.rearLight = new THREE.PointLight(0x0fbef2, 2, 30);
        scene.add(this.rearLight);

        // Create physics body with adjusted dimensions and properties
        const shape = new CANNON.Box(new CANNON.Vec3(3, 0.5, 6)); // Reduced height for better ground contact
        this.body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(0, 0.5, 0), // Lowered initial position
            shape: shape,
            linearDamping: 0.5, // Increased damping for better stability
            angularDamping: 0.8,
            fixedRotation: true, // Lock rotation to prevent tipping
            material: new CANNON.Material({
                friction: 0.5,
                restitution: 0.1
            })
        });
        
        // Initialize velocity to move forward (negative Z direction)
        this.body.velocity.set(0, 0, -this.MIN_SPEED);
        world.addBody(this.body);

        // Create ground contact material with adjusted properties
        const groundMaterial = new CANNON.Material();
        const contactMaterial = new CANNON.ContactMaterial(
            groundMaterial,
            this.body.material || new CANNON.Material(),
            {
                friction: 0.5,
                restitution: 0.1,
                contactEquationStiffness: 1e6,
                contactEquationRelaxation: 3
            }
        );
        world.addContactMaterial(contactMaterial);

        // Initialize rotation to face forward
        this.targetRotation = 0;
        this.currentRotation = 0;

        // Initialize light trail with adjusted height
        this.trailMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 1.5,
            metalness: 0.8,
            roughness: 0.2,
            transparent: true,
            opacity: 0.8
        });
        
        // Taller trail geometry for better visibility
        this.trailGeometry = new THREE.BoxGeometry(0.2, 2.0, 1);
        this.lastTrailPosition = new THREE.Vector3(0, 1.0, 0);

        // Create a single persistent light for the trail
        this.trailLight = new THREE.PointLight(0x00ff00, 2, 10);
        this.scene.add(this.trailLight);

        // Load bike model with adjusted position
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.load('/models/bike2.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/bike2.obj', (object) => {
                this.mesh = object;
                this.mesh.scale.copy(this.initialScale);
                
                // Create Tron-style materials
                const bodyMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x000000, // Deep black base
                    metalness: 0.9,
                    roughness: 0.3,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                });

                const glowMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x0fbef2, // Bright blue glow
                    emissive: 0x0fbef2,
                    emissiveIntensity: 1.0,
                    metalness: 0.9,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transparent: true,
                    opacity: 0.9
                });

                // Apply materials based on mesh names/positions
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // Store original geometry for potential edge detection
                        const geometry = child.geometry;
                        
                        // Create edge geometry for highlights
                        const edges = new THREE.EdgesGeometry(geometry, 30); // 30-degree threshold
                        const edgesMesh = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ 
                                color: 0x0fbef2,
                                transparent: true,
                                opacity: 0.9,
                                linewidth: 1
                            })
                        );
                        child.add(edgesMesh);

                        // Apply materials based on part position/name
                        if (child.name.toLowerCase().includes('wheel') || 
                            child.name.toLowerCase().includes('rim') ||
                            child.name.toLowerCase().includes('engine')) {
                            child.material = glowMaterial;
                        } else {
                            child.material = bodyMaterial;
                        }

                        // Add point lights at key positions for extra glow
                        if (child.name.toLowerCase().includes('wheel')) {
                            const wheelLight = new THREE.PointLight(0x0fbef2, 1, 3);
                            child.add(wheelLight);
                        }

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Position and add to scene with adjusted height
                this.mesh.position.copy(this.body.position as any);
                this.mesh.position.y = 0.5;
                scene.add(this.mesh);
                this.modelLoaded = true;
                
                // Initialize initial trail position
                this.lastTrailPosition = new THREE.Vector3(
                    this.mesh.position.x,
                    0.25,
                    this.mesh.position.z
                );

                // Add bike headlight
                const headlight = new THREE.SpotLight(0x0fbef2, 2, 100, Math.PI / 6, 0.5, 2);
                headlight.position.set(0, 1, 2); // Positioned at front of bike
                this.mesh.add(headlight);

                // Add subtle ambient glow
                const bikeGlow = new THREE.PointLight(0x0fbef2, 0.5, 5);
                bikeGlow.position.set(0, 1, 0);
                this.mesh.add(bikeGlow);
            });
        });

        // Initialize last grid position
        this.lastGridPosition = new THREE.Vector3(0, 0, 0);

        // Start input handling
        this.handleInput();
    }

    private handleInput() {
        // Add event listeners for keyboard controls
        window.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    this.move('left');
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    this.move('right');
                    break;
            }
        });

        window.addEventListener('keyup', (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                case 'a':
                case 'A':
                case 'ArrowRight':
                case 'd':
                case 'D':
                    this.move(null);
                    break;
            }
        });
    }

    update(deltaTime: number) {
        if (!this.modelLoaded) return;

        const currentTime = performance.now();
        const timeSinceLastUpdate = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        // Check boundary collisions
        const pos = this.mesh.position;
        const boundary = this.ARENA_SIZE / 2 - 5;
        
        if (Math.abs(pos.x) > boundary || Math.abs(pos.z) > boundary) {
            this.explode();
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            return;
        }

        // Update speed with smooth acceleration/deceleration
        if (this.turnDirection !== 0) {
            // Decelerate during turns
            this.currentSpeed = Math.max(
                this.currentSpeed - this.DECELERATION * deltaTime,
                this.MIN_SPEED
            );
        } else {
            // Accelerate when not turning
            this.currentSpeed = Math.min(
                this.currentSpeed + this.ACCELERATION * deltaTime,
                this.MAX_SPEED
            );
        }

        // Update rotation based on turn direction with smoother transitions
        if (this.turnDirection !== 0) {
            if (!this.isTurning) {
                this.isTurning = true;
                this.turnStartTime = performance.now();
            }

            // Calculate turn progress for banking effect only
            const turnProgress = Math.min(
                (performance.now() - this.turnStartTime) / (this.TURN_DURATION * 1000),
                1
            );

            // Update target rotation without limiting by turn progress
            const turnAmount = this.TURN_SPEED * this.turnDirection * deltaTime;
            this.targetRotation += turnAmount;

            // Update bank angle based on speed
            const speedFactor = this.currentSpeed / this.MAX_SPEED;
            this.targetBankAngle = this.BANK_ANGLE * this.turnDirection * speedFactor;

            // Reset turn start time if we've completed this turn segment
            if (turnProgress >= 1) {
                this.turnStartTime = performance.now();
            }
        } else {
            // Reset turning state and gradually return to neutral
            this.isTurning = false;
            this.targetBankAngle = 0;
            
            // Snap rotation to nearest 90-degree increment for grid alignment
            const snappedRotation = Math.round(this.targetRotation / (Math.PI / 2)) * (Math.PI / 2);
            this.targetRotation = THREE.MathUtils.lerp(this.targetRotation, snappedRotation, 0.1);
        }
        
        // Smoothly interpolate current rotation and bank angle
        this.currentRotation = THREE.MathUtils.lerp(
            this.currentRotation,
            this.targetRotation,
            0.15 // Increased for more responsive rotation
        );

        this.currentBankAngle = THREE.MathUtils.lerp(
            this.currentBankAngle,
            this.targetBankAngle,
            0.2 // Increased for quicker bank angle recovery
        );

        // Calculate forward direction based on current rotation
        const forward = new CANNON.Vec3(
            Math.sin(this.currentRotation),
            0,
            Math.cos(this.currentRotation)
        );

        // Update velocity every frame instead of grid-based
        this.body.velocity.x = forward.x * this.currentSpeed;
        this.body.velocity.y = 0; // Keep y velocity at 0 to prevent flying
        this.body.velocity.z = forward.z * this.currentSpeed;

        // Update mesh position and rotation
        this.mesh.position.copy(this.body.position as any);
        this.mesh.position.y = 0.5; // Force bike to stay at ground level
        this.mesh.rotation.y = this.currentRotation;
        this.mesh.rotation.z = this.currentBankAngle;
        this.mesh.scale.copy(this.initialScale);

        // Update rear light position with improved alignment
        const rearOffset = new THREE.Vector3(
            -Math.sin(this.currentRotation) * 3,
            1,
            -Math.cos(this.currentRotation) * 3
        );
        this.rearLight.position.copy(this.mesh.position).add(rearOffset);

        // Update trail length and trail
        this.updateTrailLength(timeSinceLastUpdate);
        this.updateLightTrail();
    }

    private updateTrailLength(delta: number): void {
        // Grow trail length over time
        if (this.currentTrailLength < this.MAX_TRAIL_LENGTH) {
            this.currentTrailLength += this.TRAIL_GROWTH_RATE * delta;
            this.currentTrailLength = Math.min(this.currentTrailLength, this.MAX_TRAIL_LENGTH);
        }
    }

    private updateLightTrail(): void {
        const position = this.getPosition();
        if (!position) return;

        const currentPoint = new THREE.Vector3(position.x, 1.0, position.z);

        // Update trail points
        if (!this.lastTrailPoint || currentPoint.distanceTo(this.lastTrailPoint) > 0.5) {
            this.trailPoints.push(currentPoint.clone());
            
            if (this.lastTrailPoint) {
                // Calculate segment length
                const segmentLength = currentPoint.distanceTo(this.lastTrailPoint);
                this.totalTrailDistance += segmentLength;

                // Create trail segment
                const direction = currentPoint.clone().sub(this.lastTrailPoint).normalize();
                const trailGeometry = new THREE.BoxGeometry(segmentLength, 2.0, 0.2);
                const trailMesh = new THREE.Mesh(trailGeometry, this.trailMaterial);

                // Position and rotate trail segment
                const midPoint = this.lastTrailPoint.clone().add(currentPoint).multiplyScalar(0.5);
                trailMesh.position.copy(midPoint);
                trailMesh.lookAt(currentPoint);

                this.scene.add(trailMesh);
                this.trailMeshes.push(trailMesh);

                // Update trail light position
                this.trailLight.position.copy(currentPoint);
            }

            this.lastTrailPoint = currentPoint.clone();

            // Remove old trail segments if total length exceeds current trail length
            while (this.totalTrailDistance > this.currentTrailLength && this.trailMeshes.length > 0) {
                const oldestMesh = this.trailMeshes[0];
                const oldestLength = (oldestMesh.geometry as THREE.BoxGeometry).parameters.width;
                
                this.scene.remove(oldestMesh);
                oldestMesh.geometry.dispose();
                this.trailMeshes.shift();
                this.trailPoints.shift();
                
                this.totalTrailDistance -= oldestLength;
            }
        }
    }

    move(direction: 'left' | 'right' | null) {
        if (direction === 'left') {
            this.turnDirection = 1;
        } else if (direction === 'right') {
            this.turnDirection = -1;
        } else {
            this.turnDirection = 0;
        }
    }

    getPosition(): THREE.Vector3 {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }

    getRotation(): number {
        return this.currentRotation;
    }
    
    getCurrentSpeed(): number {
        return this.currentSpeed;
    }

    getLightTrail(): THREE.Mesh[] {
        return this.lightTrail;
    }

    getTurnDirection(): number {
        return this.turnDirection;
    }
    
    dispose() {
        // Remove event listeners
        window.removeEventListener('keydown', this.handleInput);
        window.removeEventListener('keyup', this.handleInput);
        
        // Remove lights
        if (this.rearLight.parent) {
            this.rearLight.parent.remove(this.rearLight);
        }
        if (this.trailLight.parent) {
            this.trailLight.parent.remove(this.trailLight);
        }
        
        // Remove light trails
        this.lightTrail.forEach(segment => {
            if (segment.parent) {
                segment.parent.remove(segment);
                if (segment.geometry) {
                    segment.geometry.dispose();
                }
                if (segment.material) {
                    if (Array.isArray(segment.material)) {
                        segment.material.forEach(m => m.dispose());
                    } else {
                        segment.material.dispose();
                    }
                }
            }
        });
        
        // Remove bike model
        if (this.mesh && this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
            this.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        // Clean up trail resources
        this.trailMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        });
        this.trailMeshes = [];
        this.trailPoints = [];
        this.scene.remove(this.trailLight);
    }

    private explode() {
        if (!this.modelLoaded) return;

        // Create explosion particles
        const particleCount = 50;
        const colors = [0x0fbef2, 0xffffff, 0x00ff00]; // Tron-style colors
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(this.mesh.position);
            
            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 10,
                (Math.random() - 0.5) * 10
            );
            
            this.scene.add(particle);
            
            // Animate particle
            const animate = () => {
                particle.position.add(velocity);
                velocity.y -= 0.2; // Gravity
                material.opacity -= 0.02;
                
                if (material.opacity > 0) {
                    requestAnimationFrame(animate);
                } else {
                    this.scene.remove(particle);
                    geometry.dispose();
                    material.dispose();
                }
            };
            
            animate();
        }
        
        // Hide the bike
        this.mesh.visible = false;
        
        // Stop all movement
        this.body.velocity.setZero();
        this.currentSpeed = 0;
    }

    // Add getter for trail points (for minimap)
    getTrailPoints(): THREE.Vector3[] {
        return this.trailPoints;
    }
} 