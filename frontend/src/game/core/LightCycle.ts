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
    private readonly ACCELERATION = 20;
    private readonly TURN_SPEED = 2.5;
    private currentSpeed = this.MIN_SPEED;
    private turnDirection = 0;
    private targetRotation = 0;
    private currentRotation = 0;
    private lightTrail: THREE.Mesh[] = [];
    private lastTrailPosition: THREE.Vector3;
    private trailMaterial: THREE.MeshStandardMaterial;
    private trailGeometry: THREE.BoxGeometry;
    private trailPoints: THREE.Vector3[] = [];
    private readonly MAX_TRAIL_POINTS = 50;
    private readonly TRAIL_SEGMENT_DISTANCE = 2;
    private modelLoaded = false;
    private scene: THREE.Scene;
    private rearLight: THREE.PointLight;

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;

        // Create rear light
        this.rearLight = new THREE.PointLight(0x0fbef2, 2, 30);
        scene.add(this.rearLight);

        // Fix physics body - prevent rotation which causes jumping
        const shape = new CANNON.Box(new CANNON.Vec3(3, 1.5, 6));
        this.body = new CANNON.Body({
            mass: 1,
            position: new CANNON.Vec3(0, 2, 0), // Start at center of arena
            shape: shape,
            linearDamping: 0.1,
            fixedRotation: true
        });
        
        // Initialize velocity to prevent initial jumping
        this.body.velocity.set(0, 0, -this.MIN_SPEED);
        world.addBody(this.body);

        // Initialize light trail
        this.trailMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0fbef2, 
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(0x0fbef2),
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        
        // Much thinner trail geometry
        this.trailGeometry = new THREE.BoxGeometry(0.2, 1.5, 1);
        this.lastTrailPosition = new THREE.Vector3(0, 0.5, 0);

        // Load bike model
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.load('/models/bike2.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/bike2.obj', (object) => {
                this.mesh = object;
                this.mesh.scale.set(2.5, 2.5, 2.5);
                
                // Adjust materials for TRON style
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    mat.color = new THREE.Color(0xffffff);
                                    mat.emissive = new THREE.Color(0x0fbef2);
                                    mat.emissiveIntensity = 0.8;
                                    mat.needsUpdate = true;
                                });
                            } else {
                                child.material.color = new THREE.Color(0xffffff);
                                child.material.emissive = new THREE.Color(0x0fbef2);
                                child.material.emissiveIntensity = 0.8;
                                child.material.needsUpdate = true;
                            }
                        }
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Position and add to scene
                this.mesh.position.copy(this.body.position as any);
                scene.add(this.mesh);
                this.modelLoaded = true;
                
                // Initialize initial trail position
                this.lastTrailPosition = new THREE.Vector3(
                    this.mesh.position.x,
                    0.5,
                    this.mesh.position.z
                );

                // Add bike headlight
                const headlight = new THREE.SpotLight(0x0fbef2, 2, 100, Math.PI / 6, 0.5, 2);
                headlight.position.set(0, 2, 0);
                this.mesh.add(headlight);
            });
        });

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

        // Update speed
        this.currentSpeed = Math.min(
            this.currentSpeed + this.ACCELERATION * deltaTime,
            this.MAX_SPEED
        );

        // Update rotation based on turn direction
        if (this.turnDirection !== 0) {
            // Update target rotation based on turn direction
            this.targetRotation += this.TURN_SPEED * this.turnDirection * deltaTime;
        }
        
        // Smoothly interpolate current rotation to target rotation
        this.currentRotation = THREE.MathUtils.lerp(
            this.currentRotation,
            this.targetRotation,
            0.1
        );

        // Calculate forward direction based on current rotation
        const forward = new CANNON.Vec3(
            Math.sin(this.currentRotation),
            0,
            Math.cos(this.currentRotation)
        );
        
        // Set velocity directly instead of applying forces
        this.body.velocity.x = forward.x * this.currentSpeed;
        this.body.velocity.y = 0; // Keep y velocity at 0 to prevent jumping
        this.body.velocity.z = forward.z * this.currentSpeed;

        // Update mesh position and rotation
        this.mesh.position.copy(this.body.position as any);
        this.mesh.rotation.y = this.currentRotation;

        // Update rear light position
        const rearOffset = new THREE.Vector3(
            -Math.sin(this.currentRotation) * 3,
            2,
            -Math.cos(this.currentRotation) * 3
        );
        this.rearLight.position.copy(this.mesh.position).add(rearOffset);

        // Update light trail from the center of the bike
        this.updateLightTrail();
    }

    private updateLightTrail() {
        if (!this.modelLoaded) return;
        
        // Calculate tire position (slightly offset from center)
        const currentPosition = this.mesh.position.clone();
        currentPosition.y = 0.5; // Lower height for trail
        
        // Calculate tire offset based on bike's rotation
        const tireOffset = new THREE.Vector3(
            Math.sin(this.currentRotation) * 1.5, // Offset from center
            0,
            Math.cos(this.currentRotation) * 1.5
        );
        
        // Position trail at the tire
        currentPosition.sub(tireOffset);
        
        const distance = currentPosition.distanceTo(this.lastTrailPosition);
        
        // Only create new trail segment if we've moved enough
        if (distance > this.TRAIL_SEGMENT_DISTANCE) {
            // Calculate midpoint and direction
            const midpoint = new THREE.Vector3().addVectors(
                this.lastTrailPosition,
                currentPosition
            ).multiplyScalar(0.5);
            
            // Calculate trail segment rotation to match movement
            const direction = new THREE.Vector3().subVectors(
                currentPosition,
                this.lastTrailPosition
            ).normalize();
            const trailRotation = Math.atan2(direction.x, direction.z);
            
            // Create trail segment - thinner and taller
            const trailSegment = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 1.5, distance), // Very thin width, taller height
                this.trailMaterial
            );
            
            // Position and rotate trail segment
            trailSegment.position.copy(midpoint);
            trailSegment.position.y = 0.75; // Slightly raised from ground
            trailSegment.rotation.y = trailRotation;
            
            // Add segment to scene and track it
            this.scene.add(trailSegment);
            this.lightTrail.push(trailSegment);
            
            // Limit trail length
            if (this.lightTrail.length > this.MAX_TRAIL_POINTS) {
                const oldSegment = this.lightTrail.shift();
                if (oldSegment && oldSegment.parent) {
                    oldSegment.parent.remove(oldSegment);
                    (oldSegment.geometry as THREE.BufferGeometry).dispose();
                }
            }
            
            // Update last position
            this.lastTrailPosition = currentPosition.clone();
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
        
        // Remove rear light
        if (this.rearLight.parent) {
            this.rearLight.parent.remove(this.rearLight);
        }
        
        // Remove light trails
        this.lightTrail.forEach(segment => {
            if (segment.parent) {
                segment.parent.remove(segment);
                (segment.geometry as THREE.BufferGeometry).dispose();
                if (Array.isArray(segment.material)) {
                    segment.material.forEach(m => m.dispose());
                } else {
                    segment.material.dispose();
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
    }
} 