import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as CANNON from 'cannon-es';
import { useKeyboardControls } from '@react-three/drei';
import { ColorUtils, TronColor } from '../utils/ColorUtils';

// LOD level constants
export const LOD_HIGH = 0;
export const LOD_MEDIUM = 1;
export const LOD_LOW = 2;

// Declare global gameRenderer property for TypeScript
declare global {
    interface Window {
        gameRenderer?: THREE.WebGLRenderer;
    }
}

export class LightCycle {
    // Static shared resources
    private static sharedModelGeometry: THREE.BufferGeometry | null = null;
    private static sharedModels: Map<string, THREE.Group> = new Map();
    private static sharedMaterials: Map<string, THREE.Material> = new Map();
    private static isLoadingModels: boolean = false;
    private static resourcesScene: THREE.Scene | null = null;

    private mesh!: THREE.Group;
    private modelContainer!: THREE.Group; // New container to adjust model position
    private body: CANNON.Body;
    private readonly SIZE_MULTIPLIER = 5; // Standardized multiplier across all components
    private readonly MAX_SPEED = 20 * this.SIZE_MULTIPLIER;
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
    private trailMaterial: THREE.MeshStandardMaterial | null = null;
    private readonly MAX_TRAIL_LENGTH = 100;
    private scene: THREE.Scene;
    private bikeLight: THREE.PointLight; // Single consolidated light for the bike
    private initialScale = new THREE.Vector3(3.0, 2.5, 2.5);
    private lastGridPosition: THREE.Vector3;
    private isTurning = false;
    private turnStartTime = 0;
    private readonly TURN_DURATION = 0.5;
    private lastUpdateTime = 0;
    private readonly MOVEMENT_UPDATE_RATE = 1000 / 60; // 60 FPS
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
    private currentLODLevel: number = LOD_HIGH;
    private useSharedResources: boolean = false;

    private keydownHandler: (event: KeyboardEvent) => void = () => {};
    private keyupHandler: (event: KeyboardEvent) => void = () => {};
    private gameControlHandler: EventListener = () => {};

    /**
     * Initialize shared resources for all LightCycle instances
     * This reduces memory usage and CPU/GPU load when creating multiple bikes
     */
    public static initializeSharedResources(scene: THREE.Scene): void {
        if (this.resourcesScene === scene) return; // Already initialized
        
        this.resourcesScene = scene;
        this.isLoadingModels = true;
        
        // Load shared model only once
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.load('/models/bike2.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/bike2.obj', (object) => {
                // Store the geometry for reuse
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.geometry) {
                        if (!this.sharedModelGeometry) {
                            this.sharedModelGeometry = child.geometry.clone();
                        }
                    }
                });
                
                // Create a template model to clone
                this.sharedModels.set('bike', object.clone());
                
                // Create shared materials
                ColorUtils.getAllTronColors().forEach((color: TronColor) => {
                    // Create body material
                    const bodyMaterial = new THREE.MeshPhysicalMaterial({
                        color: 0x000000,
                        metalness: 0.9,
                        roughness: 0.3,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.1
                    });
                    
                    // Create glow material for each color
                    const glowMaterial = new THREE.MeshPhysicalMaterial({
                        color: color.hex,
                        emissive: color.hex,
                        emissiveIntensity: 0.8,
                        metalness: 0.9,
                        roughness: 0.2,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.1,
                        transparent: true,
                        opacity: 0.9
                    });
                    
                    // Store materials
                    this.sharedMaterials.set(`body_${color.name}`, bodyMaterial);
                    this.sharedMaterials.set(`glow_${color.name}`, glowMaterial);
                });
                
                this.isLoadingModels = false;
            });
        });
    }

    constructor(
        scene: THREE.Scene, 
        initialPosition: THREE.Vector3,
        physicsWorld: CANNON.World,
        onCollision?: () => void,
        trailActivationCallback?: (secondsRemaining: number) => void,
        useSharedResources: boolean = false
    ) {
        // Store the callback for trail activation countdown
        this.trailActivationCallback = trailActivationCallback;
        this.useSharedResources = useSharedResources;
        
        // Record creation time for trail activation delay
        this.creationTime = performance.now();
        
        this.scene = scene;
        this.onCollision = onCollision;
        
        // Get random color for this bike
        this.bikeColor = ColorUtils.getRandomTronColor();

        // Create a single consolidated light for the bike with reduced intensity and range
        this.bikeLight = new THREE.PointLight(this.bikeColor.hex, 1.5, 20);
        scene.add(this.bikeLight);

        // Initialize trail system with bike color - activate trails immediately for remote players
        this.trailsActive = true; // Always active for remote players
        this.initLightTrail();

        // Create physics body with reduced height
        const shape = new CANNON.Box(new CANNON.Vec3(3, this.PHYSICS_HEIGHT, 6));
        this.body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(initialPosition.x, this.PHYSICS_HEIGHT, initialPosition.z),
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

    // New method to handle LOD changes
    setLODLevel(level: number): void {
        this.currentLODLevel = level;
        
        // Update visibility and detail based on LOD level
        if (this.modelContainer && this.trailLine) {
            // Model is always visible but with different detail levels
            switch (level) {
                case LOD_HIGH:
                    // Full detail model and effects
                    this.modelContainer.visible = true;
                    this.trailLine.visible = this.trailsActive;
                    this.bikeLight.intensity = 1.5;
                    break;
                    
                case LOD_MEDIUM:
                    // Medium detail: simplified trails, reduced lighting
                    this.modelContainer.visible = true;
                    this.trailLine.visible = this.trailsActive;
                    this.bikeLight.intensity = 0.7;
                    break;
                    
                case LOD_LOW:
                    // Low detail: no trails, minimal lighting
                    this.modelContainer.visible = true;
                    this.trailLine.visible = false;
                    this.bikeLight.intensity = 0;
                    break;
            }
        }
    }
    
    // Minimal update for distant bikes
    updateMinimal(): void {
        if (!this.modelContainer) return;
        
        // Only update position and rotation (no physics, no trails)
        this.modelContainer.position.copy(this.body.position as any);
        this.modelContainer.rotation.y = this.currentRotation;
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

    update(deltaTime: number, skipTrails: boolean = false) {
        if (!this.modelContainer) return;

        const currentTime = performance.now();
        const timeSinceLastUpdate = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        // Update physics and movement first
        this.updatePhysics(deltaTime);
        
        // Then update visual elements
        this.updateVisuals();
        
        // Always update trails for remote players
        if (this.trailsActive && !skipTrails) {
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
        
        // Update container position
        this.modelContainer.position.copy(this.body.position as any);
        
        // Update rotation
        this.modelContainer.rotation.y = this.currentRotation;
        this.modelContainer.rotation.z = this.currentBankAngle;
        this.modelContainer.rotation.x = this.isJumping ? -0.2 : 0;

        // Update bike light position - now relative to container position
        const lightOffset = new THREE.Vector3(
            -Math.sin(this.currentRotation) * 2,
            1.0,
            -Math.cos(this.currentRotation) * 2
        );
        this.bikeLight.position.copy(this.modelContainer.position).add(lightOffset);
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
                )) > 2.0; // Reduced minimum distance for more frequent trail points
        
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
        }
    }

    // Separate method for rebuilding geometry to improve code organization
    private rebuildTrailGeometry() {
        if (!this.trailGeometry) return;
        
        // Create extruded 3D trail (a flat ribbon with width and height)
        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];
        
        // Need at least 2 points to create a trail
        if (this.trailPoints.length < 2) return;
        
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
            const bottomHeight = 0.1;  // Just slightly above the ground
            const topHeight = 4.0;     // Taller, more visible trail
            
            // Create the 4 corners of the ribbon segment
            // Top left
            positions.push(
                point.x + segmentPerpendicular.x * this.TRAIL_WIDTH,
                topHeight,
                point.z + segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            normals.push(segmentPerpendicular.x, 0, segmentPerpendicular.z);
            
            // Top right
            positions.push(
                point.x - segmentPerpendicular.x * this.TRAIL_WIDTH,
                topHeight,
                point.z - segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            normals.push(-segmentPerpendicular.x, 0, -segmentPerpendicular.z);
            
            // Bottom left
            positions.push(
                point.x + segmentPerpendicular.x * this.TRAIL_WIDTH,
                bottomHeight,
                point.z + segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            normals.push(segmentPerpendicular.x, 0, segmentPerpendicular.z);
            
            // Bottom right
            positions.push(
                point.x - segmentPerpendicular.x * this.TRAIL_WIDTH,
                bottomHeight,
                point.z - segmentPerpendicular.z * this.TRAIL_WIDTH
            );
            normals.push(-segmentPerpendicular.x, 0, -segmentPerpendicular.z);
            
            // Create faces (triangles) - only if we have a next point
            if (i < this.trailPoints.length - 1) {
                const baseIdx = i * 4;
                
                // Top face
                indices.push(baseIdx, baseIdx + 4, baseIdx + 1);
                indices.push(baseIdx + 1, baseIdx + 4, baseIdx + 5);
                
                // Left side
                indices.push(baseIdx, baseIdx + 2, baseIdx + 4);
                indices.push(baseIdx + 2, baseIdx + 6, baseIdx + 4);
                
                // Right side
                indices.push(baseIdx + 1, baseIdx + 5, baseIdx + 3);
                indices.push(baseIdx + 3, baseIdx + 5, baseIdx + 7);
                
                // Bottom face
                indices.push(baseIdx + 2, baseIdx + 3, baseIdx + 6);
                indices.push(baseIdx + 3, baseIdx + 7, baseIdx + 6);
            }
        }
        
        // Update geometry only if we have valid data
        if (positions.length > 0 && indices.length > 0) {
            this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
            this.trailGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
            this.trailGeometry.setIndex(indices);
            
            // Clear any previous index or attributes that might be cached
            this.trailGeometry.index = new THREE.BufferAttribute(new Uint16Array(indices), 1);
            
            // Make sure the geometry knows it's changed
            this.trailGeometry.attributes.position.needsUpdate = true;
            this.trailGeometry.attributes.normal.needsUpdate = true;
            this.trailGeometry.index.needsUpdate = true;
            
            // Explicitly compute bounding box/sphere for frustum culling
            this.trailGeometry.computeBoundingSphere();
            this.trailGeometry.computeBoundingBox();
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

    setRotation(rotation: number) {
        this.currentRotation = rotation;
        this.targetRotation = rotation;
        if (this.modelContainer) {
            this.modelContainer.rotation.y = rotation;
        }
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
        
        // Remove bike light
        if (this.bikeLight) {
            if (this.bikeLight.parent) {
                this.bikeLight.parent.remove(this.bikeLight);
            }
            this.bikeLight.dispose();
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
        
        // Fix: Use a material that works better with Three.js's rendering pipeline
        this.trailMaterial = new THREE.MeshStandardMaterial({
            color: this.bikeColor.hex,
            emissive: this.bikeColor.hex,
            emissiveIntensity: 1.5,  // Brighter emission for better visibility
            roughness: 0.3,
            metalness: 0.2,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: true
        });

        // Initialize with empty positions
        const positions = new Float32Array(this.MAX_TRAIL_LENGTH * 12); // 4 vertices per point
        const normals = new Float32Array(this.MAX_TRAIL_LENGTH * 12);
        
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.trailGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        
        // Create mesh
        this.trailLine = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
        this.trailLine.renderOrder = 1;
        this.trailLine.frustumCulled = false; // Disable frustum culling to ensure trail is always visible
        
        // Add to scene
        this.scene.add(this.trailLine);
        
        // Create initial point to start the trail
        if (this.modelContainer) {
            const pos = this.modelContainer.position;
            this.lastTrailPoint = new THREE.Vector3(pos.x, 0.1, pos.z);
            this.trailPoints.push(this.lastTrailPoint.clone());
        }
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
        // Create a container group to position the bike correctly
        this.modelContainer = new THREE.Group();
        this.scene.add(this.modelContainer);
        
        if (this.useSharedResources && LightCycle.sharedModels.has('bike') && !LightCycle.isLoadingModels) {
            // Use shared model (much faster)
            const sharedModel = LightCycle.sharedModels.get('bike');
            if (sharedModel) {
                this.mesh = sharedModel.clone();
                this.mesh.scale.copy(this.initialScale);
                this.mesh.position.y = -1.0;
                
                // Get shared materials for this color
                const bodyMaterial = LightCycle.sharedMaterials.get('body_' + this.bikeColor.name) || 
                    new THREE.MeshPhysicalMaterial({
                        color: 0x000000,
                        metalness: 0.9,
                        roughness: 0.3,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.1
                    });
                
                const glowMaterial = LightCycle.sharedMaterials.get('glow_' + this.bikeColor.name) || 
                    new THREE.MeshPhysicalMaterial({
                        color: this.bikeColor.hex,
                        emissive: this.bikeColor.hex,
                        emissiveIntensity: 0.8,
                        metalness: 0.9,
                        roughness: 0.2,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.1,
                        transparent: true,
                        opacity: 0.9
                    });
                
                // Apply shared materials and create simplified edge highlights
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // Add simplified edge highlights for performance
                        if (this.currentLODLevel === LOD_HIGH) {
                            const edges = new THREE.EdgesGeometry(child.geometry, 30);
                            const edgesMesh = new THREE.LineSegments(
                                edges,
                                new THREE.LineBasicMaterial({ 
                                    color: this.bikeColor.hex,
                                    transparent: true,
                                    opacity: 0.7,
                                    linewidth: 1
                                })
                            );
                            child.add(edgesMesh);
                        }

                        // Apply shared materials
                        child.material = child.name.toLowerCase().match(/wheel|rim|engine/) 
                            ? glowMaterial 
                            : bodyMaterial;

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.modelContainer.add(this.mesh);
                
                // Initialize trail position
                this.lastTrailPoint = new THREE.Vector3(
                    this.mesh.position.x,
                    this.BASE_TRAIL_HEIGHT,
                    this.mesh.position.z
                );
                
                return;
            }
        }
        
        // Fallback to traditional loading if shared resources aren't available
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.load('/models/bike2.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/bike2.obj', (object) => {
                this.mesh = object;
                this.mesh.scale.copy(this.initialScale);
                
                // Move the model DOWN so wheels touch the ground
                this.mesh.position.y = -1.0;
                
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
                    emissiveIntensity: 0.8, // Reduced emissive intensity
                    metalness: 0.9,
                    roughness: 0.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transparent: true,
                    opacity: 0.9
                });

                // Apply materials and create edge highlights with reduced intensity
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // Add edge highlights with reduced intensity
                        const edges = new THREE.EdgesGeometry(child.geometry, 30);
                        const edgesMesh = new THREE.LineSegments(
                            edges,
                            new THREE.LineBasicMaterial({ 
                                color: this.bikeColor.hex,
                                transparent: true,
                                opacity: 0.7, // Reduced opacity
                                linewidth: 1
                            })
                        );
                        child.add(edgesMesh);

                        // Apply main materials
                        child.material = child.name.toLowerCase().match(/wheel|rim|engine/) 
                            ? glowMaterial 
                            : bodyMaterial;

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Add model to container
                this.modelContainer.add(this.mesh);
                
                // Initialize trail position
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

    setPosition(position: THREE.Vector3) {
        if (!this.modelContainer) return;

        // Update model container position
        this.modelContainer.position.copy(position);
        
        // Update physics body position
        this.body.position.copy(position as any);
        this.body.velocity.setZero(); // Reset velocity to prevent drift
        
        // Update bike light position
        this.bikeLight.position.copy(position)
            .add(new THREE.Vector3(
                -Math.sin(this.currentRotation) * 2,
                1.0,
                -Math.cos(this.currentRotation) * 2
            ));
    }

    // Add cleanup method for trails
    cleanupTrails(): void {
        if (this.trailLine) {
            if (this.trailLine.parent) {
                this.trailLine.parent.remove(this.trailLine);
            }
            if (this.trailGeometry) {
                this.trailGeometry.dispose();
            }
            if (this.trailMaterial) {
                this.trailMaterial.dispose();
            }
            this.trailLine = null;
        }
        this.trailPoints = [];
    }
} 