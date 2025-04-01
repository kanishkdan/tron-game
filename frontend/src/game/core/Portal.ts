import * as THREE from 'three';

interface PortalConfig {
    position: THREE.Vector3;
    rotation?: THREE.Euler;
    radius: number;
    color: number;
    targetUrl: string;
    label?: string;
    hostUrl?: string;
}

export class Portal {
    private static isRedirecting: boolean = false;
    private scene: THREE.Scene;
    private config: PortalConfig;
    private portalGroup: THREE.Group;
    private portalRing!: THREE.Mesh;
    private portalInner!: THREE.Mesh;
    private particleSystem!: THREE.Points;
    private collisionBox!: THREE.Box3;
    private animationId!: number;
    private lastCheckTime: number = 0;
    private readonly CHECK_INTERVAL: number = 250;
    
    constructor(scene: THREE.Scene, config: PortalConfig) {
        this.scene = scene;
        this.config = config;
        this.portalGroup = new THREE.Group();
        
        // Set portal position and rotation
        this.portalGroup.position.copy(config.position);
        if (config.rotation) {
            this.portalGroup.rotation.copy(config.rotation);
        } else {
            // Default rotation from example.js
            this.portalGroup.rotation.x = 0.35;
            this.portalGroup.rotation.y = 0;
        }
        
        // Create the portal visuals
        this.createPortalVisuals();
        
        // Start animation
        this.animate();
    }
    
    private createPortalVisuals() {
        // Create portal ring (torus) - matching example.js geometry
        const ringGeometry = new THREE.TorusGeometry(this.config.radius, 2, 16, 100);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: this.config.color,
            emissive: this.config.color,
            transparent: true,
            opacity: 0.8
        });
        this.portalRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.portalGroup.add(this.portalRing);
        
        // Create portal inner surface - matching example.js
        const innerGeometry = new THREE.CircleGeometry(this.config.radius * 0.87, 32);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: this.config.color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.portalInner = new THREE.Mesh(innerGeometry, innerMaterial);
        this.portalGroup.add(this.portalInner);
        
        // Add portal label if provided
        if (this.config.label) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
                console.warn('Could not get 2D context for portal label');
                return;
            }
            canvas.width = 512;
            canvas.height = 64;
            context.fillStyle = `#${this.config.color.toString(16).padStart(6, '0')}`;
            context.font = 'bold 32px Arial';
            context.textAlign = 'center';
            context.fillText(this.config.label, canvas.width/2, canvas.height/2);
            const texture = new THREE.CanvasTexture(canvas);
            const labelGeometry = new THREE.PlaneGeometry(30, 5);
            const labelMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            });
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            label.position.y = 20;
            this.portalGroup.add(label);
        }
        
        // Create particle system - matching example.js
        const particleCount = 1000;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        const color = new THREE.Color(this.config.color);
        const rColor = color.r;
        const gColor = color.g;
        const bColor = color.b;
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            const angle = Math.random() * Math.PI * 2;
            const radius = this.config.radius + (Math.random() - 0.5) * 4;
            positions[i] = Math.cos(angle) * radius;
            positions[i + 1] = Math.sin(angle) * radius;
            positions[i + 2] = (Math.random() - 0.5) * 4;

            colors[i] = rColor * (0.8 + Math.random() * 0.2);
            colors[i + 1] = gColor * (0.8 + Math.random() * 0.2);
            colors[i + 2] = bColor * (0.8 + Math.random() * 0.2);
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
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
    
    // Animate the portal particles for a dynamic effect - with performance optimizations
    private animate() {
        const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;
        
        const updateParticles = () => {
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
            }
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            
            // Update portal shader time if uniforms exist
            if (this.portalInner.material instanceof THREE.ShaderMaterial && 
                this.portalInner.material.uniforms && 
                this.portalInner.material.uniforms.time) {
                this.portalInner.material.uniforms.time.value = Date.now() * 0.001;
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
        
        // Simple distance check to portal center
        const portalCenter = this.portalGroup.position;
        const distance = position.distanceTo(portalCenter);
        
        // Log distance when player is close to portal
        if (distance < 150) {
            console.log(`Player distance to portal: ${distance.toFixed(1)} units, portal target: ${this.config.targetUrl}`);
        }
        
        // Extra large collision radius for much easier entry (no physics blocking)
        return distance < 40;
    }
    
    // Get the target URL with query parameters
    getTargetUrl(username: string, color: string): string {
        // Get the base URL from the config
        let baseUrl = this.config.targetUrl;
        
        // Check if the URL is empty or invalid
        if (!baseUrl || baseUrl === 'null' || baseUrl === 'undefined') {
            console.warn('Invalid target URL:', baseUrl);
            return window.location.href; // Return current URL as fallback
        }
        
        // Remove any leading/trailing whitespace
        baseUrl = baseUrl.trim();
        
        // If the URL doesn't start with a protocol, add https://
        if (!baseUrl.match(/^https?:\/\//i)) {
            baseUrl = 'https://' + baseUrl;
        }
        
        try {
            // Create URL object to properly parse and format the URL
            const url = new URL(baseUrl);
            
            // Add the parameters
            url.searchParams.append('username', username);
            url.searchParams.append('color', color);
            
            // Always set ref to tron.kanishkdan.com
            url.searchParams.append('ref', 'https://tron.kanishkdan.com');
            
            console.log(`[Portal] Generated target URL: ${url.toString()}`);
            return url.toString();
        } catch (error) {
            console.error('[Portal] Error constructing URL:', error);
            // If URL construction fails, try to construct a basic URL
            return `${baseUrl}?username=${encodeURIComponent(username)}&color=${encodeURIComponent(color)}&ref=https://tron.kanishkdan.com`;
        }
    }
    
    // Teleport the player to the target URL
    teleport(username: string, color: string): void {
        // Prevent multiple redirects
        if (Portal.isRedirecting) {
            console.log('[Portal] Already redirecting, ignoring teleport request');
            return;
        }

        try {
            Portal.isRedirecting = true;
            const url = this.getTargetUrl(username, color);
            console.log(`[Portal] Teleporting player ${username} to URL: ${url}`);
            window.location.href = url;
        } catch (error) {
            console.error(`[Portal] Error during teleportation:`, error);
            Portal.isRedirecting = false;
            // As a fallback, try to redirect to the original URL without parameters
            try {
                console.log(`[Portal] Fallback: Redirecting to base URL: ${this.config.targetUrl}`);
                window.location.href = this.config.targetUrl;
            } catch (fallbackError) {
                console.error(`[Portal] Even fallback redirection failed:`, fallbackError);
                Portal.isRedirecting = false;
                // Last resort
                window.location.reload();
            }
        }
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
    }
    
    getPosition(): THREE.Vector3 {
        return this.portalGroup.position;
    }
} 