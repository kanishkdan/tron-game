import * as THREE from 'three';
import * as CANNON from 'cannon-es';

interface ArenaConfig {
    size: number;
    wallHeight: number;
    groundTexturePath: string;
}

export class Arena {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private config: ArenaConfig;

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
    }

    getConfig(): ArenaConfig {
        return this.config;
    }

    createLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x111111);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
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
    }
} 