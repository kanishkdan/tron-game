import * as THREE from 'three';
import * as CANNON from 'cannon-es';

interface PortalConfig {
    position: THREE.Vector3;
    rotation?: THREE.Euler;
    radius: number;
    color: number;
    targetUrl: string;
}

export class Portal {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private config: PortalConfig;
    private portalGroup: THREE.Group;
    private portalRing!: THREE.Mesh;
    private portalInner!: THREE.Mesh;
    private particleSystem!: THREE.Points;
    private collisionBox!: THREE.Box3;
    private body!: CANNON.Body;
    private animationId!: number;
    private lastCheckTime: number = 0;
    private readonly CHECK_INTERVAL: number = 250; // Check collision every 250ms for performance
    
    constructor(scene: THREE.Scene, world: CANNON.World, config: PortalConfig) {
        this.scene = scene;
        this.world = world;
        this.config = config;
        this.portalGroup = new THREE.Group();
        
        // Set portal position and rotation
        this.portalGroup.position.copy(config.position);
        if (config.rotation) {
            this.portalGroup.rotation.copy(config.rotation);
        }
        
        // Create the portal visuals
        this.createPortalVisuals();
        
        // Add physics body
        this.createPhysicsBody();
        
        // Start animation
        this.animate();
    }
    
    private createPortalVisuals() {
        // Create portal ring (torus) - reduce geometry complexity
        const ringGeometry = new THREE.TorusGeometry(this.config.radius, this.config.radius * 0.1, 12, 48);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: this.config.color,
            emissive: this.config.color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9,
            shininess: 100
        });
        this.portalRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.portalGroup.add(this.portalRing);
        
        // Create portal inner surface with slightly transparent effect
        const innerGeometry = new THREE.CircleGeometry(this.config.radius * 0.9, 24);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: this.config.color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        this.portalInner = new THREE.Mesh(innerGeometry, innerMaterial);
        this.portalGroup.add(this.portalInner);
        
        // Create particle system for portal effect - reduce particle count
        const particleCount = 300; // Reduced from 800
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        // Create a color object from the config color for easier manipulation
        const color = new THREE.Color(this.config.color);
        const rColor = color.r;
        const gColor = color.g;
        const bColor = color.b;
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // Create particles in a ring around the portal with some variation
            const angle = Math.random() * Math.PI * 2;
            const radius = this.config.radius * (0.9 + Math.random() * 0.2);
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = Math.sin(angle) * radius;
            positions[i3 + 2] = (Math.random() - 0.5) * (this.config.radius * 0.1);
            
            // Set color with slight variation
            colors[i3] = rColor * (0.8 + Math.random() * 0.2);
            colors[i3 + 1] = gColor * (0.8 + Math.random() * 0.2);
            colors[i3 + 2] = bColor * (0.8 + Math.random() * 0.2);
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.portalGroup.add(this.particleSystem);
        
        // Add a point light in the center of the portal - reduce light intensity
        const portalLight = new THREE.PointLight(this.config.color, 1.5, this.config.radius * 4);
        portalLight.position.set(0, 0, 0);
        this.portalGroup.add(portalLight);
        
        // Add portal group to scene
        this.scene.add(this.portalGroup);
        
        // Create collision box
        this.collisionBox = new THREE.Box3().setFromObject(this.portalGroup);
    }
    
    private createPhysicsBody() {
        // Create a physics body with zero mass (static body) for collision detection
        const shape = new CANNON.Sphere(this.config.radius);
        this.body = new CANNON.Body({
            mass: 0, // Static body
            position: new CANNON.Vec3(
                this.config.position.x,
                this.config.position.y,
                this.config.position.z
            ),
            shape: shape,
            collisionFilterGroup: 2,  // Assign to group 2
            collisionFilterMask: 1    // Only collide with group 1 (players)
        });
        
        this.world.addBody(this.body);
    }
    
    // Animate the portal particles for a dynamic effect - with performance optimizations
    private animate() {
        const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;
        let frameCount = 0;
        
        const updateParticles = () => {
            // Only update particles every 2 frames for performance
            frameCount++;
            if (frameCount % 2 === 0) {
                for (let i = 0; i < positions.length; i += 9) { // Update only 1/3 of particles each frame
                    // Create a flowing/pulsing effect
                    positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.01;
                    positions[i + 1] += Math.cos(Date.now() * 0.001 + i) * 0.01;
                }
                this.particleSystem.geometry.attributes.position.needsUpdate = true;
            }
            
            // Rotate the portal ring slightly for additional effect - reduced rotation speed
            if (frameCount % 3 === 0) {
                this.portalRing.rotation.z += 0.0005;
            }
            
            this.animationId = requestAnimationFrame(updateParticles);
        };
        
        updateParticles();
    }
    
    // Check if player has entered the portal - with throttling for performance
    checkCollision(position: THREE.Vector3): boolean {
        // Throttle collision checks for performance
        const now = performance.now();
        if (now - this.lastCheckTime < this.CHECK_INTERVAL) {
            return false;
        }
        this.lastCheckTime = now;
        
        // Create a small sphere around the player position
        const playerSphere = new THREE.Sphere(position, 3); // Assuming player radius of 3 units
        
        // Update collision box
        this.collisionBox.setFromObject(this.portalGroup);
        
        // Check if player sphere intersects with portal box
        return this.collisionBox.intersectsSphere(playerSphere);
    }
    
    // Get the target URL with query parameters
    getTargetUrl(username: string, color: string): string {
        const baseUrl = this.config.targetUrl;
        const url = new URL(baseUrl);
        
        // Add query parameters
        url.searchParams.append('username', username);
        url.searchParams.append('color', color);
        url.searchParams.append('ref', window.location.href);
        
        return url.toString();
    }
    
    // Teleport the player to the target URL
    teleport(username: string, color: string): void {
        const url = this.getTargetUrl(username, color);
        window.location.href = url;
    }
    
    // Clean up resources when portal is removed
    dispose() {
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Remove from scene
        this.scene.remove(this.portalGroup);
        
        // Dispose geometries and materials
        this.portalRing.geometry.dispose();
        (this.portalRing.material as THREE.Material).dispose();
        
        this.portalInner.geometry.dispose();
        (this.portalInner.material as THREE.Material).dispose();
        
        this.particleSystem.geometry.dispose();
        (this.particleSystem.material as THREE.Material).dispose();
        
        // Remove physics body
        this.world.removeBody(this.body);
    }
    
    getPosition(): THREE.Vector3 {
        return this.portalGroup.position;
    }
} 