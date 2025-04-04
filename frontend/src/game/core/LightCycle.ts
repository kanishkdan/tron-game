import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import * as CANNON from 'cannon-es';
import { Vec3 } from 'cannon-es';
import { useKeyboardControls } from '@react-three/drei';
import { ColorUtils, TronColor } from '../utils/ColorUtils';
import { SoundManager } from './SoundManager';

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

// Define interfaces with optional redirectUrl
interface CannonBodyWithUserData extends CANNON.Body {
    userData?: { 
        isPlayer?: boolean;
        isRamp?: boolean;
        isRedirectShape?: boolean; // New flag
        type?: string; 
        redirectUrl?: string; // Optional URL
    };
}
interface CannonCollisionEvent {
    body: CannonBodyWithUserData;
    target: CannonBodyWithUserData;
    contact: CANNON.ContactEquation;
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
    private readonly BASE_TRAIL_HEIGHT = 2.8;
    private readonly TRAIL_WIDTH = 0.15;
    private readonly COLLISION_THRESHOLD = 2.5;
    private readonly JUMP_FORCE = 30;
    private readonly JUMP_COOLDOWN = 3000; // 1 second cooldown
    private readonly JUMP_DURATION = 1000; // 0.5 seconds for jump animation
    private lastJumpTime = 0;
    private isJumping = false;
    private jumpStartTime = 0;
    private bikeColor: TronColor;
    private readonly GROUND_HEIGHT = 0.05;
    private readonly PHYSICS_HEIGHT = 1.5; // New constant for physics body height
    
    // New properties for trail activation cooldown
    private readonly TRAIL_ACTIVATION_DELAY = 5000; // 1 second in milliseconds (reduced from 5 seconds)
    private creationTime: number = 0;
    private trailsActive: boolean;
    private trailActivationCallback?: (secondsRemaining: number) => void;
    // LOD for trail segments to improve performance
    private trailUpdateCounter: number = 0;
    private readonly TRAIL_UPDATE_INTERVAL = 2; // Only update every X frames
    private currentLODLevel: number = LOD_HIGH;
    private useSharedResources: boolean;

    private keydownHandler: (event: KeyboardEvent) => void = () => {};
    private keyupHandler: (event: KeyboardEvent) => void = () => {};
    private gameControlHandler: EventListener = () => {};

    // Player name properties
    private playerName: string = '';
    private playerNameMesh: THREE.Mesh | null = null;
    private readonly NAME_HEIGHT = 8; // Height above the bike for the name to appear
    private camera?: THREE.Camera; // Add camera reference

    private soundManager: SoundManager;

    private isMoving: boolean = false;

    private bodyMaterial: CANNON.Material; // Store body material

    /**
     * Initialize shared resources for all LightCycle instances
     * This reduces memory usage and CPU/GPU load when creating multiple bikes
     */
    public static initializeSharedResources(scene: THREE.Scene): void {
        if (this.resourcesScene === scene) return; // Already initialized
        
        this.resourcesScene = scene;
        this.isLoadingModels = true;
        
        // Check if we already have cached models in memory
        if (this.sharedModels.has('bike')) {
            this.isLoadingModels = false;
            return;
        }
        
        // Load shared model only once
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        // Use a more efficient loading approach with Promise
        const loadModel = () => {
            return new Promise<void>((resolve) => {
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
                                emissiveIntensity: 1.2,
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
                        resolve();
                    });
                });
            });
        };
        
        // Start loading the model
        loadModel().catch(error => {
            console.error("Error loading shared bike model:", error);
            this.isLoadingModels = false;
        });
    }

    constructor(
        scene: THREE.Scene, 
        initialPosition: THREE.Vector3,
        physicsWorld: CANNON.World,
        onCollision?: () => void,
        trailActivationCallback?: (secondsRemaining: number) => void,
        useSharedResources: boolean = false,
        customColor?: number,
        playerName: string = 'Player' // New parameter for player name
    ) {
        this.soundManager = SoundManager.getInstance();
        // Store the player name
        this.playerName = playerName;
        
        // Store the callback for trail activation countdown
        this.trailActivationCallback = trailActivationCallback;
        this.useSharedResources = useSharedResources;
        
        // Record creation time for trail activation delay
        this.creationTime = performance.now();
        
        this.scene = scene;
        this.onCollision = onCollision;
        
        // Get color - either custom color or random Tron color
        if (customColor) {
            // Find matching Tron color or create a new one
            const allColors = ColorUtils.getAllTronColors();
            const matchingColor = allColors.find(c => c.hex === customColor);
            if (matchingColor) {
                this.bikeColor = matchingColor;
            } else {
                // If no matching color found, create a new one
                this.bikeColor = { hex: customColor, name: 'custom' };
            }
        } else {
            this.bikeColor = ColorUtils.getRandomTronColor();
        }

        // Create a single consolidated light for the bike with reduced intensity and range
        this.bikeLight = new THREE.PointLight(this.bikeColor.hex, 2.5, 25);
        scene.add(this.bikeLight);

        // Initialize trail system with bike color
        // Remote players have immediate trails, local player has delayed trails
        this.trailsActive = useSharedResources; // Immediate trails for remote players, delayed for local
        
        // Defer trail initialization to improve initial loading performance
        if (this.trailsActive) {
            this.initLightTrail();
        }

        // Create physics body
        const bikeWidth = 3;
        const bikeHeight = 1.5;
        const bikeLength = 6;
        const shape = new CANNON.Box(new CANNON.Vec3(bikeWidth / 2, bikeHeight / 2, bikeLength / 2)); // Use half-extents

        // Create and store the body material
        this.bodyMaterial = new CANNON.Material({ friction: 0.5, restitution: 0.1 });

        this.body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(initialPosition.x, bikeHeight / 2, initialPosition.z),
            shape: shape,
            linearDamping: 0.5,
            angularDamping: 0.8,
            fixedRotation: true,
            material: this.bodyMaterial, // Use stored material
        });
        // Assign userData after creation
        (this.body as CannonBodyWithUserData).userData = { isPlayer: true };

        this.currentSpeed = this.MIN_SPEED;
        this.body.velocity.set(0, 0, -this.MIN_SPEED);
        physicsWorld.addBody(this.body);

        // --- Add Collision Listener for Ramp Interaction and Redirect Shapes ---
        this.body.addEventListener('collide', (event: any) => { 
            const typedEvent = event as CannonCollisionEvent; 
            const otherBody = typedEvent.body === this.body ? typedEvent.target : typedEvent.body;

            // --- Handle Redirect Shapes (Block/Sphere) --- 
            if (otherBody.userData?.isRedirectShape && otherBody.userData.redirectUrl) {
                console.log("Collision with redirect shape:", otherBody.userData.type);
                window.location.href = otherBody.userData.redirectUrl; // Redirect immediately
                return; // Stop further processing for this collision
            }

            // --- Handle Ramps --- 
            if (otherBody.userData?.isRamp) {
                const contact = typedEvent.contact;
                if (!contact) return; 
                
                const contactNormal = contact.ni; 
                const worldNormal = new CANNON.Vec3(contactNormal.x, contactNormal.y, contactNormal.z);
                const rampQuaternion = otherBody.quaternion;
                const rampHeight = 25; 
                const rampLength = 75;
                const localSlopeNormal = new CANNON.Vec3(0, Math.sin(Math.atan2(rampHeight, rampLength)), -Math.cos(Math.atan2(rampHeight, rampLength))).normalize();
                
                // @ts-ignore <-- Add ts-ignore to suppress the linter error below
                const worldSlopeNormal = rampQuaternion.vmult(localSlopeNormal as CANNON.Vec3); 
                const dotSlope = worldNormal.dot(worldSlopeNormal); 
                const tolerance = -0.7;

                if (dotSlope > tolerance) { // If dot product is not strongly negative, it's a non-sloping face
                    console.log("Collision with non-sloping ramp face! Dot:", dotSlope);
                    // Check if this ramp has a redirect URL
                    if (otherBody.userData.redirectUrl) {
                        console.log("Redirecting to ramp URL:", otherBody.userData.redirectUrl);
                        window.location.href = otherBody.userData.redirectUrl;
                    } else {
                        // No URL, just crash
                        console.log("Crashing on non-sloping ramp face.");
                        this.onCollision?.(); 
                        if (this.modelContainer) { 
                            this.modelContainer.visible = false; 
                        }
                    }
                 }
                 // else: Collision is likely with the sloping face, allow normal physics
            }
        });
        // --- End Collision Listener ---

        // Create ground contact material
        const groundMaterial = new CANNON.Material("ground"); // Give ground a name

        const contactMaterial = new CANNON.ContactMaterial(
            groundMaterial, // Assuming ground has this material
            this.bodyMaterial,
            { friction: 0.5, restitution: 0.1, contactEquationStiffness: 1e6, contactEquationRelaxation: 3 }
        );
        physicsWorld.addContactMaterial(contactMaterial);

        // Initialize rotation to face forward
        this.targetRotation = 0;
        this.currentRotation = 0;

        // Load bike model with adjusted position
        this.loadBikeModel();

        // Defer player name creation to improve initial loading performance
        setTimeout(() => {
            this.createPlayerNameMesh();
        }, 100);

        // Initialize last grid position
        this.lastGridPosition = new THREE.Vector3(0, 0, 0);

        // Start input handling
        this.handleInput();
    }

    // New method to set the camera reference
    public setCamera(camera: THREE.Camera): void {
        this.camera = camera;
    }

    // New method to handle LOD changes
    setLODLevel(level: number): void {
        this.currentLODLevel = level;
        
        if (this.modelContainer && this.trailLine) {
            switch (level) {
                case LOD_HIGH:
                    this.modelContainer.visible = true;
                    this.trailLine.visible = this.trailsActive;
                    this.bikeLight.intensity = 2.5;
                    if (this.playerNameMesh) this.playerNameMesh.visible = true;
                    break;
                    
                case LOD_MEDIUM:
                    this.modelContainer.visible = true;
                    this.trailLine.visible = this.trailsActive;
                    this.bikeLight.intensity = 1.5;
                    if (this.playerNameMesh) this.playerNameMesh.visible = true;
                    break;
                    
                case LOD_LOW:
                    this.modelContainer.visible = true;
                    this.trailLine.visible = this.trailsActive;  // Keep trails visible
                    this.bikeLight.intensity = 0.8;  // Reduced but not zero
                    if (this.playerNameMesh) this.playerNameMesh.visible = true; // Keep names visible even in LOW LOD
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
        
        // Then update visual elements, passing the camera if available
        this.updateVisuals();
        
        // Check if trails should be activated (only for local player)
        if (!this.useSharedResources && !this.trailsActive) {
            this.checkTrailActivation(currentTime);
            return; // Don't update trails during activation phase
        }
        
        // Update trail only if active and not in activation phase
        if (this.trailsActive && !skipTrails) {
            this.trailUpdateCounter++;
            if (this.trailUpdateCounter >= this.TRAIL_UPDATE_INTERVAL) {
                this.updateTrail();
                this.trailUpdateCounter = 0;
            }
        }
    }

    private updatePhysics(deltaTime: number) {
        // Skip collision detection during activation phase
        const isInActivationPhase = !this.trailsActive && !this.useSharedResources;
        
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
                // Let physics handle landing naturally, don't force position
                // this.body.position.y = this.PHYSICS_HEIGHT;
                // this.body.velocity.y = 0;
            } else {
                // Apply downward force (simulating gravity during jump)
                this.body.velocity.y -= 30 * deltaTime; 
                
                // If bike hits ground during jump animation, stop jump
                // Use ground height check instead of PHYSICS_HEIGHT
                if (this.body.position.y - this.PHYSICS_HEIGHT / 2 < this.GROUND_HEIGHT) {
                    this.body.position.y = this.GROUND_HEIGHT + this.PHYSICS_HEIGHT / 2; // Reset to slightly above ground
                    if(this.body.velocity.y < 0) this.body.velocity.y = 0; // Stop downward velocity
                    this.isJumping = false;
                }
            }
        } else {
            // When not jumping, don't force the bike's Y position.
            // Let the physics engine handle interactions with surfaces like ramps.
            // Ground collision check: Ensure bottom of the bike is above ground
            if (this.body.position.y - this.PHYSICS_HEIGHT / 2 < this.GROUND_HEIGHT) {
                 this.body.position.y = this.GROUND_HEIGHT + this.PHYSICS_HEIGHT / 2; // Set bottom to ground level
                 if (this.body.velocity.y < 0) {
                    this.body.velocity.y = 0;
                 }
            }
            // Removed: 
            // this.body.position.y = this.PHYSICS_HEIGHT;
            // this.body.velocity.y = 0;
        }

        // Skip trail collision detection during activation phase
        if (!isInActivationPhase) {
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
        
        // Smoothly interpolate container position towards physics body position
        const physicsPosition = this.body.position as unknown as THREE.Vector3;
        this.modelContainer.position.lerp(physicsPosition, 0.25); // Adjust lerp factor (0.0 to 1.0) as needed
        
        // Update rotation (already smoothed)
        this.modelContainer.rotation.y = this.currentRotation;
        this.modelContainer.rotation.z = this.currentBankAngle;
        this.modelContainer.rotation.x = this.isJumping ? -0.2 : 0;
        
        // Ensure player name always faces the camera
        if (this.playerNameMesh && this.camera) {
            // Copy camera's rotation to make the name tag face it
            this.playerNameMesh.quaternion.copy(this.camera.quaternion);
        }

        // Update bike light position - now relative to container position
        const lightOffset = new THREE.Vector3(
            -Math.sin(this.currentRotation) * 2,
            1.0,
            -Math.cos(this.currentRotation) * 2
        );
        // Base light position on the *smoothed* visual position
        this.bikeLight.position.copy(this.modelContainer.position).add(lightOffset);
    }

    private updateTrail() {
        if (!this.modelContainer || !this.trailGeometry || !this.trailLine || !this.trailsActive) return;

        const currentPos = this.modelContainer.position; // Use visual position which follows physics body

        // Add new trail point if we've moved enough in 3D space
        const movedEnough = !this.lastTrailPoint ||
            currentPos.distanceTo(this.lastTrailPoint) > 2.0; // Use 3D distance

        if (movedEnough) {
            const newPoint = currentPos.clone(); // Clone current visual position
            this.trailPoints.push(newPoint);
            this.lastTrailPoint = newPoint.clone();

            if (this.trailPoints.length > this.MAX_TRAIL_LENGTH) {
                this.trailPoints.shift();
            }

            if (this.trailPoints.length >= 2) {
                this.rebuildTrailGeometry();
            }
        }
    }

    private rebuildTrailGeometry() {
        if (!this.trailGeometry || this.trailPoints.length < 2) return;

        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];
        const trailHeight = this.BASE_TRAIL_HEIGHT; // Visual height of the trail ribbon
        const trailWidth = this.TRAIL_WIDTH / 2; // Use half-width

        for (let i = 0; i < this.trailPoints.length; i++) {
            const p = this.trailPoints[i]; // Current point includes correct Y

            let dir: THREE.Vector3;
            if (i < this.trailPoints.length - 1) {
                dir = new THREE.Vector3().subVectors(this.trailPoints[i + 1], p).normalize();
            } else if (this.trailPoints.length > 1) { // Ensure there's a previous point
                dir = new THREE.Vector3().subVectors(p, this.trailPoints[i - 1]).normalize();
            } else {
                 // Default direction if only one segment (e.g., facing forward relative to current rotation)
                 dir = new THREE.Vector3(Math.sin(this.currentRotation), 0, Math.cos(this.currentRotation)).normalize();
            }

            // Perpendicular in the XZ plane for width
            const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(trailWidth);
            // Up vector (relative to the trail direction - cross product)
            const up = new THREE.Vector3().crossVectors(dir, perp).normalize().multiplyScalar(trailHeight / 2);


            // Calculate 4 vertices for this point in the ribbon, centered around the point's Y
            const v1 = new THREE.Vector3().copy(p).add(perp).add(up); // Top Left
            const v2 = new THREE.Vector3().copy(p).sub(perp).add(up); // Top Right
            const v3 = new THREE.Vector3().copy(p).add(perp).sub(up); // Bottom Left
            const v4 = new THREE.Vector3().copy(p).sub(perp).sub(up); // Bottom Right

            positions.push(v1.x, v1.y, v1.z);
            positions.push(v2.x, v2.y, v2.z);
            positions.push(v3.x, v3.y, v3.z);
            positions.push(v4.x, v4.y, v4.z);

            // Normals can be simplified or calculated based on face orientation
            const faceNormal1 = new THREE.Vector3().crossVectors(up, perp).normalize(); // Normal for side faces
            const faceNormal2 = new THREE.Vector3().copy(up).normalize(); // Normal for top/bottom faces (approx)

            normals.push(faceNormal1.x, faceNormal1.y, faceNormal1.z); // Normal for left edge (+perp side)
            normals.push(faceNormal1.x, faceNormal1.y, faceNormal1.z); // Normal for right edge (-perp side)
            normals.push(faceNormal1.x, faceNormal1.y, faceNormal1.z);
            normals.push(faceNormal1.x, faceNormal1.y, faceNormal1.z);


            // Add indices for the segment connecting this point to the next
            if (i < this.trailPoints.length - 1) {
                const baseIdx = i * 4;
                // Side Face Left (v1, v3, v1_next => v3, v3_next, v1_next)
                indices.push(baseIdx + 0, baseIdx + 2, baseIdx + 4); 
                indices.push(baseIdx + 2, baseIdx + 6, baseIdx + 4); 
                // Side Face Right (v2, v2_next, v4 => v4, v2_next, v4_next) - winding matters!
                indices.push(baseIdx + 1, baseIdx + 5, baseIdx + 3); 
                indices.push(baseIdx + 3, baseIdx + 5, baseIdx + 7); 

                 // Add top/bottom faces for visual thickness
                 // Top face: (v1, v1_next, v2 => v2, v1_next, v2_next)
                 indices.push(baseIdx + 0, baseIdx + 4, baseIdx + 1); 
                 indices.push(baseIdx + 1, baseIdx + 4, baseIdx + 5); 
                 // Bottom face: (v3, v4, v3_next => v4, v4_next, v3_next)
                 indices.push(baseIdx + 2, baseIdx + 3, baseIdx + 6); 
                 indices.push(baseIdx + 3, baseIdx + 7, baseIdx + 6); 
            }
        }

        // Update geometry attributes
        this.trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.trailGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        this.trailGeometry.setIndex(indices);

        this.trailGeometry.computeBoundingSphere();
        this.trailGeometry.computeBoundingBox(); // Important for culling/updates
        this.trailGeometry.attributes.position.needsUpdate = true;
        this.trailGeometry.attributes.normal.needsUpdate = true;
        if (this.trailGeometry.index) {
            this.trailGeometry.index.needsUpdate = true;
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
    
    getCreationTime(): number {
        return this.creationTime;
    }

    getTrailsActive(): boolean {
        return this.trailsActive;
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
        
        // Clean up all trails completely
        this.cleanupTrails();
        
        // Clean up player name mesh
        if (this.playerNameMesh) {
            if (this.playerNameMesh.material) {
                if (Array.isArray(this.playerNameMesh.material)) {
                    this.playerNameMesh.material.forEach(m => m.dispose());
                } else {
                    const material = this.playerNameMesh.material as THREE.MeshBasicMaterial;
                    if (material.map) material.map.dispose();
                    material.dispose();
                }
            }
            if (this.playerNameMesh.geometry) {
                this.playerNameMesh.geometry.dispose();
            }
            this.playerNameMesh = null;
        }
        
        // Remove bike model and dispose of resources
        if (this.modelContainer) {
            // Dispose all materials and geometries in the model
            this.modelContainer.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry && !object.geometry.isSharedBufferGeometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => {
                                if (!this.useSharedResources) {
                                    material.dispose();
                                }
                            });
                        } else if (!this.useSharedResources) {
                            object.material.dispose();
                        }
                    }
                }
            });
            
            // Remove from scene
            if (this.modelContainer.parent) {
                this.modelContainer.parent.remove(this.modelContainer);
            }
        }

        // Clear trail points array
        this.trailPoints = [];
        this.lastTrailPoint = null;
        
        // Remove physics body from physics world
        if (this.body && this.body.world) {
            try {
                this.body.world.removeBody(this.body);
            } catch (e) {
                console.error("Error removing physics body:", e);
            }
        }
    }

    // Enhanced trail cleanup method with complete removal
    cleanupTrails(): void {
        if (this.trailLine) {
            // First remove from scene
            if (this.trailLine.parent) {
                this.trailLine.parent.remove(this.trailLine);
            }
            
            // Dispose geometry
            if (this.trailGeometry) {
                // Clear any attributes to ensure no memory leaks
                this.trailGeometry.deleteAttribute('position');
                this.trailGeometry.deleteAttribute('normal');
                if (this.trailGeometry.index) {
                    this.trailGeometry.setIndex(null);
                }
                this.trailGeometry.dispose();
                this.trailGeometry = null;
            }
            
            // Dispose material
            if (this.trailMaterial) {
                this.trailMaterial.dispose();
                this.trailMaterial = null;
            }
            
            // Clear reference
            this.trailLine = null;
        }
        
        // Clear all trail points
        this.trailPoints = [];
        this.lastTrailPoint = null;
    }

    // Add getter for trail points (for minimap)
    getTrailPoints(): THREE.Vector3[] {
        // Ensure we always return at least the last trail point if it exists
        // This helps with collision detection in multiplayer
        if (this.trailPoints.length === 0 && this.lastTrailPoint) {
            return [this.lastTrailPoint.clone()];
        }
        return this.trailPoints;
    }

    getPhysicsBody(): CANNON.Body {
        return this.body;
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

        // Initialize with empty positions - use a more efficient approach
        // Pre-allocate arrays with the correct size
        const vertexCount = this.MAX_TRAIL_LENGTH * 4; // 4 vertices per point
        const positions = new Float32Array(vertexCount * 3); // 3 components (x,y,z) per vertex
        const normals = new Float32Array(vertexCount * 3);
        
        // Initialize with zeros for better performance
        for (let i = 0; i < positions.length; i++) {
            positions[i] = 0;
            normals[i] = 0;
        }
        
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.trailGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        
        // Create mesh with optimized settings
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
        
        // Check if shared resources are available and ready
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
                        emissiveIntensity: 1.2,
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
                                    opacity: 0.9,
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
        
        // If shared resources aren't available, check if they're still loading
        if (this.useSharedResources && LightCycle.isLoadingModels) {
            // Set up a polling mechanism to check when shared resources are ready
            const checkInterval = setInterval(() => {
                if (!LightCycle.isLoadingModels && LightCycle.sharedModels.has('bike')) {
                    clearInterval(checkInterval);
                    this.loadBikeModel(); // Retry loading with shared resources
                }
            }, 100);
            
            // Set a timeout to prevent infinite polling
            setTimeout(() => {
                clearInterval(checkInterval);
                this.loadBikeModelFallback();
            }, 5000); // 5 second timeout
            
            return;
        }
        
        // Fallback to traditional loading if shared resources aren't available
        this.loadBikeModelFallback();
    }
    
    private loadBikeModelFallback() {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.load('/models/bike2.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/bike2.obj', (object) => {
                this.mesh = object;
                this.mesh.scale.copy(this.initialScale);
                
                // Move the model DOWN so wheels touch the ground
                this.mesh.position.y = -2.0;
                
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
                    emissiveIntensity: 1.2,
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
                                opacity: 0.9,
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

    // Static method to clean up shared resources when no longer needed
    public static cleanupSharedResources(): void {
        if (LightCycle.sharedModels && LightCycle.sharedModels.size > 0) {
            LightCycle.sharedModels.forEach((model) => {
                model.traverse((object) => {
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
            });
            LightCycle.sharedModels.clear();
        }
        
        if (LightCycle.sharedMaterials && LightCycle.sharedMaterials.size > 0) {
            LightCycle.sharedMaterials.forEach((material) => {
                material.dispose();
            });
            LightCycle.sharedMaterials.clear();
        }
        
        LightCycle.sharedModelGeometry = null;
        LightCycle.resourcesScene = null;
    }

    // Add new public method to hide trails immediately
    hideTrailsImmediately(): void {
        if (this.trailLine) {
            this.trailLine.visible = false;
        }
    }

    // Method to create the player name text mesh
    private createPlayerNameMesh(): void {
        // Only create name mesh for remote players (identified by useSharedResources)
        // Also check if player name is actually set and not the default placeholder
        if (!this.useSharedResources || !this.playerName || this.playerName === 'Player') {
            return; // Local player doesn't see their own name, or name not ready
        }

        if (!this.modelContainer) return;

        // Create a canvas for the text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        
        // Set canvas dimensions
        canvas.width = 256;
        canvas.height = 64;
        
        // Configure font and styling
        context.font = 'bold 36px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add a background/outline for better visibility
        context.strokeStyle = '#000000';
        context.lineWidth = 4;
        context.strokeText(this.playerName, canvas.width / 2, canvas.height / 2);
        
        // Fill the text
        context.fillText(this.playerName, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material with the texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false // Ensures text always renders on top
        });
        
        // Create mesh with a simple plane geometry
        const geometry = new THREE.PlaneGeometry(10, 2.5);
        this.playerNameMesh = new THREE.Mesh(geometry, material);
        
        // Position the name above the bike
        this.playerNameMesh.position.y = this.NAME_HEIGHT;
        
        // Add to the bike container so it moves with the bike
        this.modelContainer.add(this.playerNameMesh);
    }
    
    // Update player name text
    setPlayerName(name: string): void {
        this.playerName = name;
        
        // If we already have a name mesh, update it
        // Re-create only if it's a remote player
        if (this.useSharedResources && this.modelContainer) {
            if (this.playerNameMesh) {
                this.modelContainer.remove(this.playerNameMesh);
                // Dispose old resources if necessary (material, texture, geometry)
                if (this.playerNameMesh.material) {
                   const mat = this.playerNameMesh.material as THREE.MeshBasicMaterial;
                   mat.map?.dispose();
                   mat.dispose();
                }
                if (this.playerNameMesh.geometry) this.playerNameMesh.geometry.dispose();
                this.playerNameMesh = null;
            }
            this.createPlayerNameMesh(); // Create new mesh with updated name
        }
    }
    
    // Get player name
    getPlayerName(): string {
        return this.playerName;
    }
} 