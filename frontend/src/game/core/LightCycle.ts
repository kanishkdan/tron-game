import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as CANNON from 'cannon-es';
import { useKeyboardControls } from '@react-three/drei';

export class LightCycle {
    private mesh!: THREE.Group;
    private body: CANNON.Body;
    private readonly SIZE_MULTIPLIER = 5; // Global multiplier for map size
    private readonly MAX_SPEED = 40 * this.SIZE_MULTIPLIER;
    private readonly MIN_SPEED = 10 * this.SIZE_MULTIPLIER;
    private readonly ACCELERATION = 15 * this.SIZE_MULTIPLIER;
    private readonly DECELERATION = 10 * this.SIZE_MULTIPLIER;
    private readonly TURN_SPEED = 2.0;
    private readonly BANK_ANGLE = 0.3;
    private readonly GRID_SIZE = 4 * this.SIZE_MULTIPLIER;
    private readonly ARENA_SIZE = 500 * this.SIZE_MULTIPLIER;
    private currentSpeed = this.MIN_SPEED;
    private turnDirection = 0;
    private targetRotation = 0;
    private currentRotation = 0;
    private currentBankAngle = 0;
    private targetBankAngle = 0;
    private trailPoints: THREE.Vector3[] = [];
    private lastTrailPoint: THREE.Vector3 | null = null;
    private trailMaterial!: THREE.MeshBasicMaterial;
    private trailMesh!: THREE.Mesh;
    private trailGeometry!: THREE.BufferGeometry;
    private trailVertices: number[] = [];
    private trailIndices: number[] = [];
    private readonly MAX_TRAIL_LENGTH = 1000;
    private scene: THREE.Scene;
    private rearLight: THREE.PointLight;
    private initialScale = new THREE.Vector3(2.5, 2.5, 2.5);
    private lastGridPosition: THREE.Vector3;
    private isTurning = false;
    private turnStartTime = 0;
    private readonly TURN_DURATION = 0.5;
    private lastUpdateTime = 0;
    private readonly MOVEMENT_UPDATE_RATE = 1000 / 60; // 60 FPS
    private trailLight!: THREE.PointLight;
    private readonly TRAIL_GROWTH_RATE = 1;
    private currentTrailLength = 100;
    private totalTrailDistance = 0;
    private trailMeshes: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;

        // Create rear light
        this.rearLight = new THREE.PointLight(0x0fbef2, 2, 30);
        scene.add(this.rearLight);

        // Initialize trail system
        this.initLightTrail();

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
                
                // Initialize initial trail position
                this.lastTrailPoint = new THREE.Vector3(
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
        if (!this.mesh) return;

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

        const currentPoint = new THREE.Vector3(position.x, 0.1, position.z);

        // Only add new points if we've moved enough
        if (!this.lastTrailPoint || currentPoint.distanceTo(this.lastTrailPoint) > 0.1) {
            // Add new point to trail
            this.trailPoints.push(currentPoint.clone());
            this.lastTrailPoint = currentPoint.clone();
            
            // Remove oldest points if trail is too long
            if (this.trailPoints.length > this.MAX_TRAIL_LENGTH) {
                this.trailPoints.shift();
            }
            
            // Rebuild the entire trail geometry
            this.rebuildTrailGeometry();
        }
        
        // Update trail light position
        this.trailLight.position.copy(currentPoint);
        this.trailLight.position.y = 2.0;
    }

    private rebuildTrailGeometry(): void {
        if (this.trailPoints.length < 2) return;
        
        // Clear arrays
        this.trailVertices = [];
        this.trailIndices = [];
        
        const trailWidth = 0.1;  // Width of the trail
        const trailHeight = 3.5;  // Height of the trail
        
        // Build vertices and indices for all points
        for (let i = 0; i < this.trailPoints.length - 1; i++) {
            const current = this.trailPoints[i];
            const next = this.trailPoints[i + 1];
            
            // Calculate direction vector between points
            const direction = next.clone().sub(current).normalize();
            
            // Calculate perpendicular vector for width
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
            
            // Create vertices for this segment (4 vertices forming a rectangle)
            const v1 = current.clone().add(perpendicular.clone().multiplyScalar(trailWidth/2));
            const v2 = current.clone().add(perpendicular.clone().multiplyScalar(-trailWidth/2));
            const v3 = next.clone().add(perpendicular.clone().multiplyScalar(trailWidth/2));
            const v4 = next.clone().add(perpendicular.clone().multiplyScalar(-trailWidth/2));
            
            // Set height
            v1.y = trailHeight;
            v2.y = trailHeight;
            v3.y = trailHeight;
            v4.y = trailHeight;
            
            // Create vertices for the bottom of the trail
            const v5 = v1.clone().setY(0);
            const v6 = v2.clone().setY(0);
            const v7 = v3.clone().setY(0);
            const v8 = v4.clone().setY(0);
            
            // Add all vertices
            const baseIndex = this.trailVertices.length / 3;
            this.trailVertices.push(
                // Top vertices
                v1.x, v1.y, v1.z,
                v2.x, v2.y, v2.z,
                v3.x, v3.y, v3.z,
                v4.x, v4.y, v4.z,
                // Bottom vertices
                v5.x, v5.y, v5.z,
                v6.x, v6.y, v6.z,
                v7.x, v7.y, v7.z,
                v8.x, v8.y, v8.z
            );
            
            // Add indices for the segment (6 faces of a cube segment)
            this.trailIndices.push(
                // Top face
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex + 1, baseIndex + 3, baseIndex + 2,
                
                // Bottom face
                baseIndex + 4, baseIndex + 6, baseIndex + 5,
                baseIndex + 5, baseIndex + 6, baseIndex + 7,
                
                // Side 1
                baseIndex, baseIndex + 2, baseIndex + 4,
                baseIndex + 4, baseIndex + 2, baseIndex + 6,
                
                // Side 2
                baseIndex + 1, baseIndex + 5, baseIndex + 3,
                baseIndex + 3, baseIndex + 5, baseIndex + 7,
                
                // Front face
                baseIndex, baseIndex + 4, baseIndex + 1,
                baseIndex + 1, baseIndex + 4, baseIndex + 5,
                
                // Back face
                baseIndex + 2, baseIndex + 3, baseIndex + 6,
                baseIndex + 3, baseIndex + 7, baseIndex + 6
            );
        }
        
        // Update the geometry with new vertices and indices
        this.trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(this.trailVertices, 3));
        this.trailGeometry.setIndex(this.trailIndices);
        this.trailGeometry.computeVertexNormals();
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
        return this.trailMeshes;
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
        this.trailMeshes.forEach(segment => {
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
        if (this.trailMesh) {
            this.scene.remove(this.trailMesh);
            this.trailGeometry.dispose();
            this.trailMaterial.dispose();
        }
        this.trailPoints = [];
        this.scene.remove(this.trailLight);
    }

    private explode() {
        if (!this.mesh) return;

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

    private initLightTrail(): void {
        // Create a more efficient trail system using a single growing geometry
        this.trailPoints = [];
        this.lastTrailPoint = null;

        // Create material with glow effect
        this.trailMaterial = new THREE.MeshBasicMaterial({
            color: 0x0fbef2,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        // Create initial empty geometry
        this.trailGeometry = new THREE.BufferGeometry();
        
        // Create initial empty arrays for vertices and indices
        this.trailVertices = [];
        this.trailIndices = [];
        
        // Create mesh
        this.trailMesh = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
        this.trailMesh.frustumCulled = false;
        this.scene.add(this.trailMesh);
        
        // Add trail light
        this.trailLight = new THREE.PointLight(0x0fbef2, 1, 10);
        this.scene.add(this.trailLight);
    }
} 