import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Portal } from './Portal';

interface ArenaConfig {
    size: number;
    wallHeight: number;
    groundTexturePath: string;
}

export class Arena {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private config: ArenaConfig;
    private portal: Portal | null = null;

    constructor(scene: THREE.Scene, world: CANNON.World, config: ArenaConfig) {
        this.scene = scene;
        this.world = world;
        this.config = config;

        // Set darker background color
        this.scene.background = new THREE.Color(0x000000);

        // Add fog for depth effect
        this.scene.fog = new THREE.FogExp2(0x000000, 0.002);

        // We only set up lighting here - ground is handled by Ground.tsx
        this.createLighting();
        
        // Create the portal
        this.createPortal();
    }

    getConfig(): ArenaConfig {
        return this.config;
    }
    
    getPortal(): Portal | null {
        return this.portal;
    }

    createLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x111111);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
        directionalLight.position.set(0, 100, 0);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Add point lights for neon effect
        const pointLights = [
            { pos: [0, this.config.wallHeight, 0], intensity: 2 },
            { pos: [this.config.size/2, this.config.wallHeight/2, this.config.size/2], intensity: 1.5 },
            { pos: [-this.config.size/2, this.config.wallHeight/2, -this.config.size/2], intensity: 1.5 },
        ];

        pointLights.forEach(light => {
            const pointLight = new THREE.PointLight(0x0fbef2, light.intensity, this.config.size/2);
            const [x, y, z] = light.pos;
            pointLight.position.set(x, y, z);
            this.scene.add(pointLight);
        });
    }
    
    private createPortal() {
        // New radius for the portal
        const portalRadius = 30;
        
        // Create a portal positioned at the edge of the arena, touching the floor
        const portalPosition = new THREE.Vector3(
            this.config.size / 850, // Position at 1/3 of the arena size on X axis
            portalRadius - 25, // Set Y position so the bottom touches the ground (y=0)
            this.config.size / 2.5 // Position at 1/3 of the arena size on Z axis
        );
        
        // Create portal with blue glow, larger size, and no rotation
        const portalConfig = {
            position: portalPosition,
            rotation: new THREE.Euler(0, 0, 0), // No rotation, portal stands straight
            radius: portalRadius, // Increased portal radius
            color: 0x0fbef2, // Tron blue color
            targetUrl: 'http://portal.pieter.com'
        };
        
        this.portal = new Portal(this.scene, this.world, portalConfig);
    }

    dispose() {
        // Clean up resources
        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        // Dispose portal if it exists
        if (this.portal) {
            this.portal.dispose();
            this.portal = null;
        }
    }
} 