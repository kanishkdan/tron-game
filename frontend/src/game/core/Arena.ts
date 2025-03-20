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

        this.createArena();
        this.createLighting();
    }

    private createArena() {
        // Load ground texture
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load(this.config.groundTexturePath);
        groundTexture.wrapS = THREE.RepeatWrapping;
        groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(50, 50); // Adjust for desired grid density
        groundTexture.magFilter = THREE.NearestFilter; // Crisp pixel look
        groundTexture.needsUpdate = true;

        // Create main ground
        const groundGeometry = new THREE.PlaneGeometry(this.config.size, this.config.size);
        const groundMaterial = new THREE.MeshStandardMaterial({
            map: groundTexture,
            transparent: false, // Changed to false for solid ground
            color: 0x000000, // Dark base color
            emissive: new THREE.Color(0x0fbef2),
            emissiveIntensity: 0.1
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add subtle glow plane just above the ground
        const glowGeometry = new THREE.PlaneGeometry(this.config.size, this.config.size);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x0fbef2,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });

        const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
        glowPlane.rotation.x = -Math.PI / 2;
        glowPlane.position.y = 0.1; // Slightly above ground
        this.scene.add(glowPlane);

        // Add ground physics
        const groundShape = new CANNON.Box(new CANNON.Vec3(this.config.size/2, 0.1, this.config.size/2));
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        this.world.addBody(groundBody);

        // Create walls with neon effect
        this.createWalls();
    }

    private createWalls() {
        const wallGeometry = new THREE.BoxGeometry(1, this.config.wallHeight, this.config.size);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x0fbef2,
            emissive: 0x0fbef2,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.5
        });

        // Create wall meshes
        const walls = [
            { pos: [this.config.size/2, this.config.wallHeight/2, 0], rot: [0, 0, 0] },
            { pos: [-this.config.size/2, this.config.wallHeight/2, 0], rot: [0, 0, 0] },
            { pos: [0, this.config.wallHeight/2, this.config.size/2], rot: [0, Math.PI/2, 0] },
            { pos: [0, this.config.wallHeight/2, -this.config.size/2], rot: [0, Math.PI/2, 0] }
        ];

        walls.forEach(({ pos, rot }) => {
            // Main wall
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(pos[0], pos[1], pos[2]);
            wall.rotation.set(rot[0], rot[1], rot[2]);
            wall.castShadow = true;
            this.scene.add(wall);

            // Add neon glow effect
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0x0fbef2,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide
            });

            const glowWall = new THREE.Mesh(wallGeometry.clone(), glowMaterial);
            glowWall.scale.multiplyScalar(1.05);
            glowWall.position.copy(wall.position);
            glowWall.rotation.copy(wall.rotation);
            this.scene.add(glowWall);

            // Add wall physics
            const wallShape = new CANNON.Box(new CANNON.Vec3(0.5, this.config.wallHeight/2, this.config.size/2));
            const wallBody = new CANNON.Body({ mass: 0 });
            wallBody.addShape(wallShape);
            wallBody.position.set(pos[0], pos[1], pos[2]);
            wallBody.quaternion.setFromEuler(rot[0], rot[1], rot[2]);
            this.world.addBody(wallBody);
        });
    }

    private createLighting() {
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