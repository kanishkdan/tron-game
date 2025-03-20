import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { createGridTexture } from '../../utils/createGridTexture';

export class Arena {
    private scene: THREE.Scene;
    private world: CANNON.World;
    private floor!: THREE.Group;
    private gridSegments: THREE.Group[] = [];
    private lastGridZ: number = 0;
    private readonly SEGMENT_DEPTH = 400; 
    private readonly VISIBLE_SEGMENTS = 100;
    private readonly GRID_WIDTH = 800;
    private arenaModel: THREE.Group | null = null;
    private readonly GENERATE_THRESHOLD = 200;
    private gridTexture: THREE.Texture | null = null;

    constructor(scene: THREE.Scene, world: CANNON.World) {
        this.scene = scene;
        this.world = world;

        // Set darker background color
        this.scene.background = new THREE.Color(0x000000);

        // Add fog to scene - more intense for TRON effect
        this.scene.fog = new THREE.FogExp2(0x000000, 0.002);
        
        // Create starry background
        const stars = this.createStarfield();
        const distantStars = this.createDistantStarfield();
        this.scene.add(stars);
        this.scene.add(distantStars);

        // Create floor group
        this.floor = new THREE.Group();
        this.scene.add(this.floor);
        
        // Load arena texture
        const textureLoader = new THREE.TextureLoader();
        const arenaTexture = textureLoader.load('/textures/arena.jpeg', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.encoding = THREE.sRGBEncoding;
            texture.anisotropy = 16; // High anisotropy for better texture quality at angles
            texture.needsUpdate = true;
        });
        
        // Create and load grid texture for overlay
        const gridTextureDataUrl = createGridTexture(512);
        this.gridTexture = textureLoader.load(gridTextureDataUrl);
        this.gridTexture.wrapS = THREE.RepeatWrapping;
        this.gridTexture.wrapT = THREE.RepeatWrapping;
        this.gridTexture.repeat.set(50, 50);
        this.gridTexture.needsUpdate = true;

        // Create initial floor with arena texture
        const floorGeometry = new THREE.PlaneGeometry(this.GRID_WIDTH, this.SEGMENT_DEPTH * 3);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: arenaTexture,
            normalScale: new THREE.Vector2(1, 1),
            roughness: 0.4,
            metalness: 0.6,
            emissive: new THREE.Color(0x0fbef2),
            emissiveIntensity: 0.2
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -10, this.SEGMENT_DEPTH);
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Add grid overlay
        const gridGeometry = new THREE.PlaneGeometry(this.GRID_WIDTH, this.SEGMENT_DEPTH * 3);
        const gridMaterial = new THREE.MeshStandardMaterial({
            map: this.gridTexture,
            transparent: true,
            opacity: 0.3,
            emissive: new THREE.Color(0x0fbef2),
            emissiveIntensity: 0.1,
            blending: THREE.AdditiveBlending
        });

        const grid = new THREE.Mesh(gridGeometry, gridMaterial);
        grid.rotation.x = -Math.PI / 2;
        grid.position.set(0, -9.9, this.SEGMENT_DEPTH);
        grid.receiveShadow = true;
        this.scene.add(grid);

        // Add floor collision
        const floorShape = new CANNON.Box(new CANNON.Vec3(this.GRID_WIDTH/2, 0.1, this.SEGMENT_DEPTH * 1.5));
        const floorBody = new CANNON.Body({ mass: 0 });
        floorBody.addShape(floorShape);
        floorBody.position.set(0, -10, this.SEGMENT_DEPTH);
        this.world.addBody(floorBody);

        // Add lighting
        this.createLighting();
    }

    private loadArenaModel(arenaTexture: THREE.Texture) {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        mtlLoader.load('/models/arena7.mtl', (materials) => {
            materials.preload();
            objLoader.setMaterials(materials);
            objLoader.load('/models/arena7.obj', (object) => {
                this.arenaModel = object;
                
                // Apply TRON materials to arena model
                this.arenaModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    mat.map = arenaTexture;
                                    mat.color = new THREE.Color(0x0a0a0a);
                                    mat.emissive = new THREE.Color(0x0fbef2);
                                    mat.emissiveIntensity = 0.5;
                                    mat.needsUpdate = true;
                                });
                            } else {
                                child.material.map = arenaTexture;
                                child.material.color = new THREE.Color(0x0a0a0a);
                                child.material.emissive = new THREE.Color(0x0fbef2);
                                child.material.emissiveIntensity = 0.5;
                                child.material.needsUpdate = true;
                            }
                        }
                        child.receiveShadow = true;
                        child.castShadow = true;
                    }
                });
                
                // Scale and position the arena model
                this.arenaModel.scale.set(50, 50, 50);
                this.arenaModel.position.set(0, -10, 0);
                this.scene.add(this.arenaModel);
                
                // Create initial arena segments
                this.createInitialArenaSegments();
            });
        });
    }

    private createInitialArenaSegments() {
        // Create multiple arena segments for continuous play
        for (let i = 0; i < 3; i++) {
            const clone = this.arenaModel!.clone();
            clone.position.z = i * 800;
            this.scene.add(clone);
            
            // Create physics for each segment
            const arenaShape = new CANNON.Box(new CANNON.Vec3(400, 1, 400));
            const arenaBody = new CANNON.Body({ mass: 0 });
            arenaBody.addShape(arenaShape);
            arenaBody.position.set(0, -10, i * 800);
            this.world.addBody(arenaBody);

            // Add glowing grid to each segment
            this.createGridOverlay(i * 800);
        }
    }

    private createGridOverlay(zPosition: number) {
        const gridGeometry = new THREE.PlaneGeometry(this.GRID_WIDTH, this.SEGMENT_DEPTH);
        
        // Create multi-material for floor
        const materials = [
            new THREE.MeshStandardMaterial({
                map: this.gridTexture,
                transparent: true,
                opacity: 0.3,
                emissive: new THREE.Color(0x0fbef2),
                emissiveIntensity: 0.2
            }),
            new THREE.MeshStandardMaterial({
                color: 0x000000,
                emissive: new THREE.Color(0x0fbef2),
                emissiveIntensity: 0.1,
                transparent: true,
                opacity: 0.8
            })
        ];

        const grid = new THREE.Mesh(gridGeometry, materials[0]);
        grid.rotation.x = -Math.PI / 2;
        grid.position.set(0, -9.9, zPosition);
        grid.receiveShadow = true;
        this.scene.add(grid);

        // Add glow plane slightly below
        const glowGrid = new THREE.Mesh(gridGeometry, materials[1]);
        glowGrid.rotation.x = -Math.PI / 2;
        glowGrid.position.set(0, -10, zPosition);
        this.scene.add(glowGrid);
    }

    private createStarfield(): THREE.Points {
        const starsGeometry = new THREE.BufferGeometry();
        const starCount = 15000;
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 8000;
            positions[i + 1] = Math.random() * 4000;
            positions[i + 2] = (Math.random() - 0.5) * 8000;
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2.5,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });
        
        return new THREE.Points(starsGeometry, starsMaterial);
    }

    private createDistantStarfield(): THREE.Points {
        const starsGeometry = new THREE.BufferGeometry();
        const starCount = 20000;
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 12000;
            positions[i + 1] = Math.random() * 6000;
            positions[i + 2] = (Math.random() - 0.5) * 12000;
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            color: 0x8888ff,
            size: 1.5,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        });
        
        return new THREE.Points(starsGeometry, starsMaterial);
    }

    private createGridSegment(zPosition: number): void {
        const segment = new THREE.Group();
        
        // Create grid lines
        const width = this.GRID_WIDTH;
        const depth = this.SEGMENT_DEPTH;

        // Add ground plane with TRON material
        const groundGeometry = new THREE.PlaneGeometry(width, depth);
        const groundMaterial = new THREE.MeshStandardMaterial({
            map: this.gridTexture,
            color: 0x000000,
            emissive: new THREE.Color(0x0fbef2),
            emissiveIntensity: 0.2,
            transparent: true,
            opacity: 0.3,
        });
        const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(0, -0.1, zPosition - depth/2);
        groundPlane.receiveShadow = true;
        segment.add(groundPlane);

        this.floor.add(segment);
        this.gridSegments.push(segment);
        this.lastGridZ = zPosition - depth;

        // Add floor collision
        const floorShape = new CANNON.Box(new CANNON.Vec3(width/2, 0.1, depth/2));
        const floorBody = new CANNON.Body({ mass: 0 });
        floorBody.addShape(floorShape);
        floorBody.position.set(0, -0.1, zPosition - depth/2);
        this.world.addBody(floorBody);
    }

    private createLighting() {
        // Add ambient light - darker for TRON effect
        const ambientLight = new THREE.AmbientLight(0x111111);
        this.scene.add(ambientLight);

        // Add directional light for shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(0, 100, 0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Add point lights for TRON-style glow
        const pointLight1 = new THREE.PointLight(0x0fbef2, 2, 100);
        pointLight1.position.set(0, 20, 0);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x0fbef2, 2, 100);
        pointLight2.position.set(0, 20, -50);
        this.scene.add(pointLight2);

        // Add volumetric light beams
        this.createVolumetricLights();
    }

    private createVolumetricLights() {
        // Create volumetric light beam material
        const beamGeometry = new THREE.CylinderGeometry(0.1, 5, 50, 32);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: 0x0fbef2,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });

        // Add multiple light beams
        for (let i = 0; i < 8; i++) {
            const beam = new THREE.Mesh(beamGeometry, beamMaterial);
            const angle = (i / 8) * Math.PI * 2;
            beam.position.set(
                Math.cos(angle) * 100,
                25,
                Math.sin(angle) * 100
            );
            beam.rotation.x = Math.PI / 2;
            this.scene.add(beam);
        }
    }

    update(deltaTime: number, playerZ: number) {
        // Generate new segments if needed
        if (playerZ < this.lastGridZ + this.GENERATE_THRESHOLD) {
            this.createGridSegment(this.lastGridZ);
        }

        // Remove old segments
        while (this.gridSegments.length > this.VISIBLE_SEGMENTS) {
            const oldSegment = this.gridSegments.shift();
            if (oldSegment) {
                this.floor.remove(oldSegment);
                oldSegment.traverse((child) => {
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

    dispose() {
        // Clean up all resources
        this.gridSegments.forEach(segment => {
            segment.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });

        if (this.gridTexture) {
            this.gridTexture.dispose();
        }

        if (this.arenaModel) {
            this.arenaModel.traverse((child) => {
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