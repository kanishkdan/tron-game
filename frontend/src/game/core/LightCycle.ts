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
    private readonly SIZE_MULTIPLIER = 4; // Standardized multiplier across all components
    private readonly MAX_SPEED = 20 * this.SIZE_MULTIPLIER;
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
    private trailLine: THREE.Mesh | null = null;
    private trailGeometry: THREE.BufferGeometry | null = null;
    private trailMaterial: THREE.MeshBasicMaterial | null = null;
    private readonly MAX_TRAIL_LENGTH = 250;
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

    constructor(scene: THREE.Scene, world: CANNON.World, onCollision?: () => void) {
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
        this.loadBikeModel();

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
                case ' ':
                    this.jump();
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
        if (!this.modelContainer) return;

        const currentTime = performance.now();
        const timeSinceLastUpdate = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        // Update physics and movement first
        this.updatePhysics(deltaTime);
        
        // Then update visual elements
        this.updateVisuals();
        
        // Finally update trail
        this.updateTrail();
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
            setTimeout(() => {
                window.location.reload();
            }, 1500);
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
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
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
        if (!this.modelContainer || !this.trailGeometry || !this.trailLine) return;

        const currentPos = this.modelContainer.position;
        
        // Add new trail point only if we've moved enough
        if (!this.lastTrailPoint || 
            new THREE.Vector3(currentPos.x, 0, currentPos.z)
                .distanceTo(new THREE.Vector3(
                    this.lastTrailPoint.x, 
                    0, 
                    this.lastTrailPoint.z
                )) > 0.5) {
            
            // Create the new point at the bike's current height
            const newPoint = new THREE.Vector3(
                currentPos.x, 
                currentPos.y,  // Use actual bike height
                currentPos.z
            );
            
            // Calculate direction vector (for creating width)
            const direction = new THREE.Vector3();
            
            if (this.trailPoints.length > 0) {
                // Get direction from last point to current point
                direction.subVectors(newPoint, this.lastTrailPoint!).normalize();
            
            // Calculate perpendicular vector for width
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
            
                // Add new point
                this.trailPoints.push(newPoint);
                this.lastTrailPoint = newPoint.clone();
                
                // Limit trail length
                if (this.trailPoints.length > this.MAX_TRAIL_LENGTH) {
                    this.trailPoints.shift();
                }
                
                // Create extruded 3D trail (a flat ribbon with width and height)
                const positions = new Float32Array(this.trailPoints.length * 12); // 4 vertices per point
                const indices = [];
                
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
                        segmentDirection = direction.clone();
                    }
                    
                    segmentPerpendicular = new THREE.Vector3(-segmentDirection.z, 0, segmentDirection.x).normalize();
                    
                    // Calculate the bottom height for this segment
                    const bottomHeight = Math.max(0, point.y - this.BASE_TRAIL_HEIGHT);
                    const topHeight = point.y + this.BASE_TRAIL_HEIGHT;
                    
                    // Create the 4 corners of the ribbon segment with consistent height difference
                    // Top left
                    positions[i * 12] = point.x + segmentPerpendicular.x * this.TRAIL_WIDTH;
                    positions[i * 12 + 1] = topHeight;
                    positions[i * 12 + 2] = point.z + segmentPerpendicular.z * this.TRAIL_WIDTH;
                    
                    // Top right
                    positions[i * 12 + 3] = point.x - segmentPerpendicular.x * this.TRAIL_WIDTH;
                    positions[i * 12 + 4] = topHeight;
                    positions[i * 12 + 5] = point.z - segmentPerpendicular.z * this.TRAIL_WIDTH;
                    
                    // Bottom left
                    positions[i * 12 + 6] = point.x + segmentPerpendicular.x * this.TRAIL_WIDTH;
                    positions[i * 12 + 7] = bottomHeight; // Use calculated bottom height
                    positions[i * 12 + 8] = point.z + segmentPerpendicular.z * this.TRAIL_WIDTH;
                    
                    // Bottom right
                    positions[i * 12 + 9] = point.x - segmentPerpendicular.x * this.TRAIL_WIDTH;
                    positions[i * 12 + 10] = bottomHeight; // Use calculated bottom height
                    positions[i * 12 + 11] = point.z - segmentPerpendicular.z * this.TRAIL_WIDTH;
                    
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
                
                // Update geometry
                this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                this.trailGeometry.setIndex(indices);
                this.trailGeometry.computeVertexNormals();
                
                // Update trail light to follow the current height
                this.trailLight.position.set(newPoint.x, newPoint.y + 0.5, newPoint.z);
            } else {
                // First point - add it and continue
                this.trailPoints.push(newPoint);
                this.lastTrailPoint = newPoint.clone();
                this.trailLight.position.set(newPoint.x, newPoint.y + 0.5, newPoint.z);
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
        return this.modelContainer ? this.modelContainer.position : new THREE.Vector3();
    }

    getRotation(): number {
        return this.currentRotation;
    }
    
    getCurrentSpeed(): number {
        return this.currentSpeed;
    }

    getLightTrail(): THREE.Object3D[] {
        return this.trailLine ? [this.trailLine] : [];
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
        if (this.trailLine) {
            this.scene.remove(this.trailLine);
            this.trailLine = null;
        }
        
        // Remove bike model
        if (this.modelContainer && this.modelContainer.parent) {
            this.modelContainer.parent.remove(this.modelContainer);
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
        this.trailPoints = [];
        this.scene.remove(this.trailLight);
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
            side: THREE.DoubleSide
        });

        // Initialize with empty positions
        const positions = new Float32Array(this.MAX_TRAIL_LENGTH * 12); // 4 vertices per point
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create mesh
        this.trailLine = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
        this.trailLine.renderOrder = 1;
        this.trailLine.frustumCulled = false;
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
                
                // Initialize trail
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
} 