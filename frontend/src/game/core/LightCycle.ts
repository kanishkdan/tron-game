import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as CANNON from 'cannon-es';
import { useKeyboardControls } from '@react-three/drei';
import { ColorUtils, TronColor } from '../utils/ColorUtils';

// Declare global gameRenderer property for TypeScript
declare global {
    interface Window {
        gameRenderer?: THREE.WebGLRenderer;
    }
}

export class LightCycle {
    private mesh!: THREE.Group;
    private modelContainer!: THREE.Group; // New container to adjust model position
    private body: CANNON.Body;
    private readonly SIZE_MULTIPLIER = 5; // Standardized multiplier across all components
    private readonly MAX_SPEED = 30 * this.SIZE_MULTIPLIER;
    private readonly MIN_SPEED = 10 * this.SIZE_MULTIPLIER;
    private readonly ACCELERATION = 15 * this.SIZE_MULTIPLIER;
    private readonly DECELERATION = 10 * this.SIZE_MULTIPLIER;
    private readonly TURN_SPEED = 2.0;
    private readonly BANK_ANGLE = 0.5;
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
    private trailLine: THREE.Mesh | null = null;
    private trailGeometry: THREE.BufferGeometry | null = null;
    private trailMaterial: THREE.MeshBasicMaterial | null = null;
    private readonly MAX_TRAIL_LENGTH = 182;
    private scene: THREE.Scene;
    private rearLight: THREE.PointLight;
    private initialScale = new THREE.Vector3(3.0, 2.5, 2.5);
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
    private onCollision?: () => void; // Callback for collision handling
    private readonly BASE_TRAIL_HEIGHT = 3.0;
    private readonly TRAIL_WIDTH = 0.25;
    private readonly COLLISION_THRESHOLD = 2.5;
    private readonly JUMP_FORCE = 30;
    private readonly JUMP_COOLDOWN = 3000; // 1 second cooldown
    private readonly JUMP_DURATION = 1000; // 0.5 seconds for jump animation
    private lastJumpTime = 0;
    private isJumping = false;
    private jumpStartTime = 0;
    private bikeColor: TronColor;
    private readonly GROUND_HEIGHT = 0.05;
    private readonly PHYSICS_HEIGHT = 0.25; // New constant for physics body height
    
    // New properties for trail activation cooldown
    private readonly TRAIL_ACTIVATION_DELAY = 5000; // 5 seconds in milliseconds
    private creationTime: number = 0;
    private trailsActive: boolean = false;
    private trailActivationCallback?: (secondsRemaining: number) => void;
    // LOD for trail segments to improve performance
    private trailUpdateCounter: number = 0;
    private readonly TRAIL_UPDATE_INTERVAL = 2; // Only update every X frames

    private keydownHandler: (event: KeyboardEvent) => void = () => {};
    private keyupHandler: (event: KeyboardEvent) => void = () => {};
    private gameControlHandler: EventListener = () => {};

    constructor(
        scene: THREE.Scene, 
        initialPosition: THREE.Vector3,
        physicsWorld: CANNON.World,
        onCollision?: () => void,
        trailActivationCallback?: (secondsRemaining: number) => void
    ) {
        // Store the callback for trail activation countdown
        this.trailActivationCallback = trailActivationCallback;
        
        // Record creation time for trail activation delay
        this.creationTime = performance.now();
        
        this.scene = scene;
        this.onCollision = onCollision;
        
        // Get random color for this bike
        this.bikeColor = ColorUtils.getRandomTronColor();

        // Create rear light with increased intensity and bike color
        this.rearLight = new THREE.PointLight(this.bikeColor.hex, 3, 40);
        scene.add(this.rearLight);

        // Initialize trail system with bike color
        this.initLightTrail();

        // Create physics body with reduced height
        const shape = new CANNON.Box(new CANNON.Vec3(3, this.PHYSICS_HEIGHT, 6));
        this.body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(0, this.PHYSICS_HEIGHT, 0), // Position at half height
            shape: shape,
            linearDamping: 0.5,
            angularDamping: 0.8,
            fixedRotation: true,
            material: new CANNON.Material({
                friction: 0.5,
                restitution: 0.1
            })
        });
        
        // Ensure initial velocity is set correctly
        this.currentSpeed = this.MIN_SPEED;
        this.body.velocity.set(0, 0, -this.MIN_SPEED);
        physicsWorld.addBody(this.body);

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
        physicsWorld.addContactMaterial(contactMaterial);

        // Initialize rotation to face forward
        this.targetRotation = 0;
        this.currentRotation = 0;

        // Load bike model with adjusted position
        this.loadBikeModel();

        // Initialize last grid position
        this.lastGridPosition = new THREE.Vector3(0, 0, 0);

        // Start input handling
        this.handleInput();
    }

    private handleInput() {
        // Create bound event handlers for proper removal later
        this.keydownHandler = (event: KeyboardEvent) => {
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
                case ' ':
                    this.jump();
                    break;
            }
        };

        this.keyupHandler = (event: KeyboardEvent) => {
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
        };

        this.gameControlHandler = ((event: CustomEvent<{ action: 'left' | 'right' | 'jump', type: 'press' | 'release' }>) => {
            const { action, type } = event.detail;
            
            if (type === 'press') {
                switch (action) {
                    case 'left':
                        this.move('left');
                        break;
                    case 'right':
                        this.move('right');
                        break;
                    case 'jump':
                        this.jump();
                        break;
                }
            } else if (type === 'release') {
                switch (action) {
                    case 'left':
                    case 'right':
                        this.move(null);
                        break;
                }
            }
        }) as EventListener;

        // Add event listeners
        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);
        window.addEventListener('gameControl', this.gameControlHandler);
    }

    update(deltaTime: number) {
        if (!this.modelContainer) return;

        const currentTime = performance.now();
        const timeSinceLastUpdate = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        // Update physics and movement first
        this.updatePhysics(deltaTime);
        
        // Then update visual elements
        this.updateVisuals();
        
        // Check if trails should be activated
        this.checkTrailActivation(currentTime);
        
        // Update trail only if active - and using interval for performance
        if (this.trailsActive) {
            this.trailUpdateCounter++;
            if (this.trailUpdateCounter >= this.TRAIL_UPDATE_INTERVAL) {
                this.updateTrail();
                this.trailUpdateCounter = 0;
            }
        }
    }

    private updatePhysics(deltaTime: number) {
        // Check boundary collisions
        const pos = this.modelContainer.position;
        const boundary = this.ARENA_SIZE / 2 - 5;
        
        if (Math.abs(pos.x) > boundary || Math.abs(pos.z) > boundary) {
            // Hide the bike and stop movement
            this.modelContainer.visible = false;
            this.body.velocity.setZero();
            this.currentSpeed = 0;
            this.onCollision?.();
            return;
        }

        // Update jump physics
        const currentTime = performance.now();
        if (this.isJumping) {
            const jumpProgress = (currentTime - this.jumpStartTime) / this.JUMP_DURATION;
            
            if (jumpProgress >= 1) {
                this.isJumping = false;
                this.body.position.y = this.PHYSICS_HEIGHT;
                this.body.velocity.y = 0;
            } else {
                this.body.velocity.y -= 30 * deltaTime;
                
                if (this.body.position.y < this.PHYSICS_HEIGHT) {
                    this.body.position.y = this.PHYSICS_HEIGHT;
                    this.body.velocity.y = 0;
                    this.isJumping = false;
                }
            }
        } else {
            this.body.position.y = this.PHYSICS_HEIGHT;
            this.body.velocity.y = 0;
        }

        // Check trail collisions using line segments
        if (this.trailPoints.length > 10) {
            const bikePos = new THREE.Vector3(pos.x, pos.y, pos.z);
            const bikeRadius = 2.0;
            const collisionDistance = bikeRadius + this.TRAIL_WIDTH;
            
            // Skip the last 10 points to prevent immediate self-collision
            for (let i = 0; i < this.trailPoints.length - 10; i++) {
                if (i + 1 < this.trailPoints.length) {
                    const p1 = this.trailPoints[i];
                    const p2 = this.trailPoints[i + 1];
                    
                    // Only check collision if bike is at similar height to trail segment
                    const trailHeight = (p1.y + p2.y) / 2;
                    if (Math.abs(bikePos.y - trailHeight) < 1.0) {
                        const lineSeg = new THREE.Line3(
                            new THREE.Vector3(p1.x, p1.y, p1.z),
                            new THREE.Vector3(p2.x, p2.y, p2.z)
                        );
                        
                        const closestPoint = new THREE.Vector3();
                        lineSeg.closestPointToPoint(bikePos, true, closestPoint);
                        
                        const distance = bikePos.distanceTo(closestPoint);
                        
                        if (distance < collisionDistance) {
                            this.modelContainer.visible = false;
                            this.body.velocity.setZero();
                            this.currentSpeed = 0;
                            this.onCollision?.();
                            return;
                        }
                    }
                }
            }
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
        const forward = new THREE.Vector3(
            Math.sin(this.currentRotation),
            0,
            Math.cos(this.currentRotation)
        );

        // Update velocity
        this.body.velocity.x = forward.x * this.currentSpeed;
        this.body.velocity.z = forward.z * this.currentSpeed;
        // Y velocity is handled by jump physics
    }

    private updateVisuals() {
        if (!this.modelContainer) return;
        
        // Update container position (the mesh itself is offset inside)
        this.modelContainer.position.copy(this.body.position as any);
        
        // Update rotation
        this.modelContainer.rotation.y = this.currentRotation;
        this.modelContainer.rotation.z = this.currentBankAngle;
        this.modelContainer.rotation.x = this.isJumping ? -0.2 : 0;

        // Update rear light - now relative to container position
        const rearOffset = new THREE.Vector3(
            -Math.sin(this.currentRotation) * 3,
            1.0,
            -Math.cos(this.currentRotation) * 3
        );
        this.rearLight.position.copy(this.modelContainer.position).add(rearOffset);
    }

    private updateTrail() {
        if (!this.modelContainer || !this.trailGeometry || !this.trailLine || !this.trailsActive) return;

        const currentPos = this.modelContainer.position;
        
        // Add new trail point if we've moved enough or no previous point
        const shouldAddPoint = !this.lastTrailPoint || 
            new THREE.Vector3(currentPos.x, 0, currentPos.z)
                .distanceTo(new THREE.Vector3(
                    this.lastTrailPoint.x, 
                    0, 
                    this.lastTrailPoint.z
                )) > 0.5; // Slightly increased minimum distance for fewer points
        
        if (shouldAddPoint) {
            // Create the new point at the bike's current height
            const newPoint = new THREE.Vector3(
                currentPos.x, 
                currentPos.y, // Use actual bike height
                currentPos.z
            );
            
            // Add new point to trail
            this.trailPoints.push(newPoint);
            this.lastTrailPoint = newPoint.clone();
            
            // Limit trail length - remove just one point at a time for smoother trails
            if (this.trailPoints.length > this.MAX_TRAIL_LENGTH) {
                this.trailPoints.shift();
            }
            
            // Only rebuild geometry if we have enough points
            if (this.trailPoints.length >= 2) {
                this.rebuildTrailGeometry();
            }
            
            // Update trail light to follow the current height
            this.trailLight.position.set(newPoint.x, newPoint.y + 0.5, newPoint.z);
        }
    }

    // Separate method for rebuilding geometry to improve code organization
    private rebuildTrailGeometry() {
        if (!this.trailGeometry) return;
        
        // Create extruded 3D trail (a flat ribbon with width and height)
        const positions: number[] = [];
        const indices: number[] = [];
        
        // Process trail points to create extruded geometry
        for (let i = 0; i < this.trailPoints.length; i++) {
            const point = this.trailPoints[i];
            
            // Calculate direction and perpendicular for each segment
            let segmentDirection, segmentPerpendicular;
            
            if (i < this.trailPoints.length - 1) {
                const nextPoint = this.trailPoints[i + 1];
                segmentDirection = new THREE.Vector3().subVectors(nextPoint, point).normalize();
            } else if (i > 0) {
                const prevPoint = this.trailPoints[i - 1];
                segmentDirection = new THREE.Vector3().subVectors(point, prevPoint).normalize();
            } else {
                continue; // Skip single points
            }
            
            segmentPerpendicular = new THREE.Vector3(-segmentDirection.z, 0, segmentDirection.x).normalize();
            
            // Calculate the bottom height for this segment
            const bottomHeight = Math.max(0, point.y - 0.1); // Very small offset from ground
            const topHeight = point.y + this.BASE_TRAIL_HEIGHT; // Restore original tall trail height
            
            // Create the 4 corners of the ribbon segment
            // Top left
            positions.push(
                point.x + segmentPerpendicular.x * this.TRAIL_WIDTH,
                topHeight,
                point.z + segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            
            // Top right
            positions.push(
                point.x - segmentPerpendicular.x * this.TRAIL_WIDTH,
                topHeight,
                point.z - segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            
            // Bottom left
            positions.push(
                point.x + segmentPerpendicular.x * this.TRAIL_WIDTH,
                bottomHeight,
                point.z + segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            
            // Bottom right
            positions.push(
                point.x - segmentPerpendicular.x * this.TRAIL_WIDTH,
                bottomHeight,
                point.z - segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            
            // Create faces (triangles) - only if we have a next point
            if (i < this.trailPoints.length - 1) {
                const baseIdx = i * 4;
                // Top face
                indices.push(baseIdx, baseIdx + 1, baseIdx + 4);
                indices.push(baseIdx + 1, baseIdx + 5, baseIdx + 4);
                
                // Left side
                indices.push(baseIdx, baseIdx + 2, baseIdx + 4);
                indices.push(baseIdx + 2, baseIdx + 6, baseIdx + 4);
                
                // Right side
                indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 5);
                indices.push(baseIdx + 3, baseIdx + 7, baseIdx + 5);
                
                // Bottom face
                indices.push(baseIdx + 2, baseIdx + 3, baseIdx + 6);
                indices.push(baseIdx + 3, baseIdx + 7, baseIdx + 6);
            }
        }
        
        // Update geometry only if we have valid data
        if (positions.length > 0 && indices.length > 0) {
            this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
            this.trailGeometry.setIndex(indices);
            this.trailGeometry.computeVertexNormals();
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
        return this.modelContainer ? this.modelContainer.position : new THREE.Vector3();
    }

    getRotation(): number {
        return this.currentRotation;
    }
    
    getCurrentSpeed(): number {
        return this.currentSpeed;
    }

    getLightTrail(): THREE.Object3D[] {
        // Only return trail if it's active
        return (this.trailLine && this.trailsActive) ? [this.trailLine] : [];
    }

    getTurnDirection(): number {
        return this.turnDirection;
    }
    
    // Add method to get the physics body
    getBody(): CANNON.Body {
        return this.body;
    }
    
    dispose() {
        // Release the color when the bike is disposed
        ColorUtils.releaseColor(this.bikeColor.hex);
        
        // Remove event listeners properly
        window.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('keyup', this.keyupHandler);
        window.removeEventListener('gameControl', this.gameControlHandler);
        
        // Remove lights and dispose of their resources
        if (this.rearLight) {
            if (this.rearLight.parent) {
                this.rearLight.parent.remove(this.rearLight);
            }
            this.rearLight.dispose();
        }
        
        if (this.trailLight) {
            if (this.trailLight.parent) {
                this.trailLight.parent.remove(this.trailLight);
            }
            this.trailLight.dispose();
        }
        
        // Remove light trails
        if (this.trailLine) {
            if (this.trailLine.parent) {
                this.trailLine.parent.remove(this.trailLine);
            }
            this.trailLine = null;
        }
        
        // Remove bike model and dispose of resources
        if (this.modelContainer) {
            // Dispose all materials and geometries in the model
            this.modelContainer.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
            
            if (this.modelContainer.parent) {
                this.modelContainer.parent.remove(this.modelContainer);
            }
        }

        // Clean up trail resources
        if (this.trailGeometry) {
            this.trailGeometry.dispose();
            this.trailGeometry = null;
        }
        
        if (this.trailMaterial) {
            this.trailMaterial.dispose();
            this.trailMaterial = null;
        }
        
        // Clear trail points array
        this.trailPoints = [];
        
        // Remove physics body from physics world
        if (this.body.world) {
            this.body.world.removeBody(this.body);
        }
    }

    // Add getter for trail points (for minimap)
    getTrailPoints(): THREE.Vector3[] {
        return this.trailPoints;
    }

    private initLightTrail() {
        // Create trail geometry for 3D extruded trail
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailMaterial = new THREE.MeshBasicMaterial({
            color: this.bikeColor.hex,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: true // Enable depth writing for proper visual appearance
        });

        // Initialize with empty positions
        const positions = new Float32Array(this.MAX_TRAIL_LENGTH * 12); // 4 vertices per point
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create mesh
        this.trailLine = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
        this.trailLine.renderOrder = 1;
        this.trailLine.frustumCulled = false; // Disable frustum culling to ensure trail is always visible
        this.scene.add(this.trailLine);

        // Create trail light with increased intensity and bike color
        this.trailLight = new THREE.PointLight(this.bikeColor.hex, 1.5, 20);
        this.scene.add(this.trailLight);
    }

    private jump() {
        const currentTime = performance.now();
        if (!this.isJumping && currentTime - this.lastJumpTime > this.JUMP_COOLDOWN) {
            this.isJumping = true;
            this.lastJumpTime = currentTime;
            this.jumpStartTime = currentTime;
            this.body.velocity.y = this.JUMP_FORCE;
        }
    }

    private loadBikeModel() {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        // Create a container group to position the bike correctly
        this.modelContainer = new THREE.Group();
        this.scene.add(this.modelContainer);

        mtlLoader.load('/models/bike2.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/bike2.obj', (object) => {
                this.mesh = object;
                this.mesh.scale.copy(this.initialScale);
                
                // Move the model DOWN so wheels touch the ground
                // This is the key fix - offset the model within its container
                this.mesh.position.y = -1.0; // Adjust this value as needed to get wheels on ground
                
                // Create materials
                const bodyMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x000000,
                    metalness: 0.9,
                    roughness: 0.3,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                });

                const glowMaterial = new THREE.MeshPhysicalMaterial({
                    color: this.bikeColor.hex,
                    emissive: this.bikeColor.hex,
                    emissiveIntensity: 1.0,
                    metalness: 0.9,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transparent: true,
                    opacity: 0.9
                });

                // Apply materials and create edge highlights
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // Add edge highlights
                        const edges = new THREE.EdgesGeometry(child.geometry, 30);
                        const edgesMesh = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ 
                                color: this.bikeColor.hex,
                                transparent: true,
                                opacity: 0.9,
                                linewidth: 1
                            })
                        );
                        child.add(edgesMesh);

                        // Apply main materials
                        child.material = child.name.toLowerCase().match(/wheel|rim|engine/) 
                            ? glowMaterial 
                            : bodyMaterial;

                        // Add wheel lights
                        if (child.name.toLowerCase().includes('wheel')) {
                            const wheelLight = new THREE.PointLight(this.bikeColor.hex, 1, 3);
                            child.add(wheelLight);
                        }

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Add bike lights
                const headlight = new THREE.SpotLight(this.bikeColor.hex, 2, 100, Math.PI / 6, 0.5, 2);
                headlight.position.set(0, 1, 2);
                this.mesh.add(headlight);

                const bikeGlow = new THREE.PointLight(this.bikeColor.hex, 0.5, 5);
                bikeGlow.position.set(0, 1, 0);
                this.mesh.add(bikeGlow);

                // Add model to container instead of directly to scene
                this.modelContainer.add(this.mesh);
                
                // Don't initialize trail right away, wait for activation time
                this.lastTrailPoint = new THREE.Vector3(
                    this.mesh.position.x,
                    this.BASE_TRAIL_HEIGHT,
                    this.mesh.position.z
                );
            });
        });
    }

    // Add getter for bike color (for minimap)
    getBikeColor(): number {
        return this.bikeColor.hex;
    }

    /**
     * Check if light trails should be activated based on time since creation
     */
    private checkTrailActivation(currentTime: number) {
        if (!this.trailsActive) {
            const elapsedTime = currentTime - this.creationTime;
            const timeRemaining = Math.max(0, this.TRAIL_ACTIVATION_DELAY - elapsedTime);
            
            // Notify about countdown if callback is provided
            if (this.trailActivationCallback && timeRemaining > 0) {
                const secondsRemaining = Math.ceil(timeRemaining / 1000);
                this.trailActivationCallback(secondsRemaining);
            }
            
            // Activate trails after delay
            if (elapsedTime >= this.TRAIL_ACTIVATION_DELAY) {
                this.trailsActive = true;
                
                // Initialize light trail only when needed
                if (!this.trailLine) {
                    this.initLightTrail();
                }
                
                // Final callback with 0 seconds remaining
                if (this.trailActivationCallback) {
                    this.trailActivationCallback(0);
                }
            }
        }
    }
} 