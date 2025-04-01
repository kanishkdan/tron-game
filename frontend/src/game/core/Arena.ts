import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Vec3 } from 'cannon-es'; // Explicit import for Vec3
import { Portal } from './Portal';
// Add TextGeometry if you want 3D text, or keep using CanvasTexture for 2D text on planes
// For simplicity, we'll stick with CanvasTexture on the back face for now.

// Interface for redirect shape data - added position
interface RedirectShapeData {
    emoji: string;
    name: string;
    url: string;
    size: number;
    position: THREE.Vector3; // Fixed position for the shape
}

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
    private returnPortal: Portal | null = null;
    // Store multiple ramps
    private ramps: THREE.Group[] = [];
    private rampBodies: CANNON.Body[] = [];
    private redirectShapes: THREE.Group[] = []; // Store redirect shapes
    private redirectShapeBodies: CANNON.Body[] = []; // Store their physics bodies
    // private readonly NUM_RAMPS = 3; // No longer needed

    // Shared material for text planes to save resources
    private textMaterialCache: Map<string, THREE.MeshBasicMaterial> = new Map();

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

        // Define URLs, sizes, and FIXED POSITIONS for redirect shapes
        const redirectTargets: { [id: string]: RedirectShapeData } = {
            "google": { emoji: "🔍", name: "Google", url: "https://google.com", size: 30, position: new THREE.Vector3(150, 0, 150) },
            "github": { emoji: "🐙", name: "GitHub", url: "https://github.com", size: 50, position: new THREE.Vector3(-150, 0, -150) },
            "vercel": { emoji: "▲", name: "Vercel", url: "https://vercel.com", size: 40, position: new THREE.Vector3(150, 0, -150) },
            // Add more here with fixed positions
        };

        // --- Create Ramps at Fixed Positions/Rotations ---
        const arenaHalfSize = this.config.size / 2 * 0.7; // Use 70% to place inwards
        this.createRamp(new THREE.Vector3(0, 0, arenaHalfSize), new THREE.Euler(0, 0, 0)); // Facing North
        this.createRamp(new THREE.Vector3(0, 0, -arenaHalfSize), new THREE.Euler(0, Math.PI, 0)); // Facing South
        this.createRamp(new THREE.Vector3(arenaHalfSize, 0, 0), new THREE.Euler(0, -Math.PI / 2, 0)); // Facing East
        this.createRamp(new THREE.Vector3(-arenaHalfSize, 0, 0), new THREE.Euler(0, Math.PI / 2, 0)); // Facing West
        // --- End Ramp Creation ---
        
        this.createRedirectShapes(redirectTargets);
    }

    getConfig(): ArenaConfig {
        return this.config;
    }
    
    getPortal(): Portal | null {
        return this.portal;
    }
    
    getReturnPortal(): Portal | null {
        return this.returnPortal;
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
            portalRadius + 20, // Set Y position so the bottom touches the ground (y=0)
            this.config.size / 2.5 // Position at 1/3 of the arena size on Z axis
        );
        
        // Create portal with blue glow, larger size, and no rotation
        const portalConfig = {
            position: portalPosition,
            rotation: new THREE.Euler(0, 0, 0), // No rotation, portal stands straight
            radius: portalRadius, // Increased portal radius
            color: 0x0fbef2, // Tron blue color
            targetUrl: 'https://portal.pieter.com',
            hostUrl: 'https://tron.kanishkdan.com',
            label: 'EXIT'
        };
        
        this.portal = new Portal(this.scene, portalConfig);
        console.log('[Arena] Main portal created successfully at', portalPosition.x, portalPosition.y, portalPosition.z);
    }

    createReturnPortal(targetUrl: string) {
        console.log('[Arena] Creating return portal with URL:', targetUrl);
        
        // Create a return portal on the opposite side of the arena from the main portal
        // Position it in the opposite quadrant
        const portalRadius = 30;
        
        // Create a portal positioned at the opposite edge of the arena
        const portalPosition = new THREE.Vector3(
            -this.config.size / 850, // Position at opposite 1/3 of the arena size on X axis
            portalRadius + 20, // Set Y position so the bottom touches the ground (y=0)
            -this.config.size / 2.5 // Position at opposite 1/3 of the arena size on Z axis
        );
        
        console.log('[Arena] Creating return portal at position:', portalPosition.x, portalPosition.y, portalPosition.z);
        
        // Create portal with red glow, same size, and no rotation
        const portalConfig = {
            position: portalPosition,
            rotation: new THREE.Euler(0, 0, 0), // No rotation, portal stands straight
            radius: portalRadius, // Same portal radius
            color: 0xff3333, // Red color
            targetUrl: targetUrl,
            label: 'RETURN'
        };
        
        try {
            this.returnPortal = new Portal(this.scene, portalConfig);
            console.log('[Arena] Return portal created successfully');
            console.log('[Arena] Return portal position:', this.returnPortal.getPosition().x, this.returnPortal.getPosition().y, this.returnPortal.getPosition().z);
        } catch (error) {
            console.error('[Arena] Error creating return portal:', error);
        }
    }

    // --- Helper: Generate Text Texture ---
    private generateTextTexture(emoji: string, name: string): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const font = 'bold 40px Arial'; // Slightly smaller font
        const text = `${emoji} ${name}`;
        
        if (!context) {
            // Fallback if canvas context is not supported
            console.error("Canvas 2D context not supported!");
            return new THREE.CanvasTexture(document.createElement('canvas')); 
        }

        // Measure text to dynamically size canvas (optional, can use fixed size)
        context.font = font;
        const textMetrics = context.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 40 * 1.2; // Approx height based on font size
        const padding = 20;

        canvas.width = THREE.MathUtils.ceilPowerOfTwo(textWidth + padding * 2);
        canvas.height = THREE.MathUtils.ceilPowerOfTwo(textHeight + padding * 2);

        // Re-apply font after resize
        context.font = font;
        context.fillStyle = '#0fbef2'; // Blue text
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = '#000000';
        context.lineWidth = 6; // Slightly thinner outline

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        context.strokeText(text, centerX, centerY);
        context.fillText(text, centerX, centerY);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace; // Correct colorspace
        return texture;
    }
    // --- End Helper ---

     // --- Helper: Get or Create Text Material ---
    private getTextMaterial(emoji: string, name: string): THREE.MeshBasicMaterial {
        const key = `${emoji}_${name}`;
        if (this.textMaterialCache.has(key)) {
            return this.textMaterialCache.get(key)!;
        }
        const texture = this.generateTextTexture(emoji, name);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false, // Render text on top
            depthTest: true,
        });
        this.textMaterialCache.set(key, material);
        return material;
    }
    // --- End Helper ---

    // --- createRamp - Remove emoji, name, url args, use default/none ---
    private createRamp(
        position: THREE.Vector3,
        rotation: THREE.Euler
        // Removed: emoji, name, redirectUrl
    ) {
        const rampGroup = new THREE.Group();
        this.scene.add(rampGroup);

        const rampWidth = 50;
        const rampHeight = 25;
        const rampLength = 75;
        const hw = rampWidth / 2;
        const hh = rampHeight;
        const hl = rampLength / 2;
        // const offset = 0.1; // No longer needed for text

        // --- Physics (Identical, no URL in userData) ---
        const vertices = [
            new CANNON.Vec3(-hw, 0, -hl), new CANNON.Vec3(hw, 0, -hl), new CANNON.Vec3(hw, 0, hl),
            new CANNON.Vec3(-hw, 0, hl), new CANNON.Vec3(-hw, hh, hl), new CANNON.Vec3(hw, hh, hl)
        ];
        const faces = [
            [0, 4, 5, 1], [1, 5, 2], [2, 5, 4, 3], [3, 4, 0], [0, 1, 2, 3]
        ];
        const shape = new CANNON.ConvexPolyhedron({ vertices, faces });
        const rampPosition = new CANNON.Vec3(position.x, position.y, position.z);
        const rampBody = new CANNON.Body({ mass: 0, position: rampPosition, shape: shape, material: new CANNON.Material({ friction: 0.6, restitution: 0.1 }), });
        (rampBody as any).userData = { isRamp: true, type: 'ramp' }; // No URL needed for default ramps
        rampBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        this.world.addBody(rampBody);
        // --- End Physics ---

        // --- Visual Mesh (Identical) ---
        const geometry = new THREE.BufferGeometry();
        const posAttr = new Float32Array([ -hw, 0, -hl, hw, 0, -hl, hw, 0, hl, -hw, 0, hl, -hw, hh, hl, hw, hh, hl ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(posAttr, 3));
        geometry.setIndex([ 0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3 ]);
        geometry.computeVertexNormals();
        const rampMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const rampMesh = new THREE.Mesh(geometry, rampMaterial);
        const edges = new THREE.EdgesGeometry(geometry, 30);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x0fbef2, transparent: true, opacity: 0.8, linewidth: 1 });
        const edgesMesh = new THREE.LineSegments(edges, edgesMaterial);
        rampGroup.add(rampMesh);
        rampGroup.add(edgesMesh);
        // --- End Visual Mesh ---

        // --- Remove Text Creation for default ramps ---
        // --- End Text ---

        rampGroup.position.copy(rampPosition as any);
        rampGroup.rotation.copy(rotation);
        this.ramps.push(rampGroup);
        this.rampBodies.push(rampBody);
    }

    // --- createRedirectShapes - Use fixed position from data ---
    private createRedirectShapes(targets: { [id: string]: RedirectShapeData }) {
        const arenaHalfSize = this.config.size / 2 * 0.8;
        const shapeMaterial = new CANNON.Material({ friction: 0.3, restitution: 0.2 });
        const offset = 0.1; // Offset for text planes

        Object.values(targets).forEach((data) => {
            const { emoji, name, url, size, position } = data; // Destructure, including position
            const shapeGroup = new THREE.Group();
            const shapeSize = size;

            // Use the provided fixed position, ensure base is at Y=0
            const fixedPosition = new CANNON.Vec3(
                 position.x, 
                 shapeSize / 2, // Adjust Y based on size so bottom is at Y=0
                 position.z 
            );

            // Always Block
            const shapeGeometry = new THREE.BoxGeometry(shapeSize, shapeSize, shapeSize);
            const physicsShape = new CANNON.Box(new CANNON.Vec3(shapeSize / 2, shapeSize / 2, shapeSize / 2));

            // Physics Body
            const shapeBody = new CANNON.Body({ mass: 0, position: fixedPosition, shape: physicsShape, material: shapeMaterial });
            (shapeBody as any).userData = { isRedirectShape: true, type: 'block', redirectUrl: url };
            this.world.addBody(shapeBody);

            // Visual Mesh (Identical)
            const visualMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.9 });
            const shapeMesh = new THREE.Mesh(shapeGeometry, visualMaterial);
            const edges = new THREE.EdgesGeometry(shapeGeometry, 30);
            const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x0fbef2, linewidth: 2 });
            const edgesMesh = new THREE.LineSegments(edges, edgesMaterial);
            shapeGroup.add(shapeMesh);
            shapeGroup.add(edgesMesh);

            // --- Add Text to All 6 Sides (Identical) ---
            const textMaterial = this.getTextMaterial(emoji, name);
            const textSize = shapeSize * 0.8; 
            const textGeo = new THREE.PlaneGeometry(textSize, textSize / 2); 
            const halfSize = shapeSize / 2 + offset;
            const positionsAndRotations = [
                { pos: [halfSize, 0, 0], rot: [0, Math.PI / 2, 0] }, // +X
                { pos: [-halfSize, 0, 0], rot: [0, -Math.PI / 2, 0] },// -X
                { pos: [0, halfSize, 0], rot: [-Math.PI / 2, 0, 0] }, // +Y
                { pos: [0, -halfSize, 0], rot: [Math.PI / 2, 0, 0] }, // -Y
                { pos: [0, 0, halfSize], rot: [0, 0, 0] },          // +Z
                { pos: [0, 0, -halfSize], rot: [0, Math.PI, 0] }    // -Z
            ];
            positionsAndRotations.forEach(({ pos, rot }) => {
                const textMesh = new THREE.Mesh(textGeo.clone(), textMaterial); // Clone geometry for text
                textMesh.position.set(pos[0], pos[1], pos[2]);
                textMesh.rotation.set(rot[0], rot[1], rot[2]);
                shapeGroup.add(textMesh);
            });
            // --- End Text ---

            shapeGroup.position.copy(fixedPosition as any);
            this.scene.add(shapeGroup);
            this.redirectShapes.push(shapeGroup);
            this.redirectShapeBodies.push(shapeBody);
        });
    }

    dispose() {
        // Clean up THREE.js resources (lights, fog, etc.)
        // Traverse scene to dispose materials/geometries if necessary
        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                // Dispose geometry if not shared (like textGeo)
                if (object.geometry && !object.geometry.userData.isShared) { 
                   object.geometry.dispose();
                }
                // Material disposal (handled by cache disposal)
             } else if (object instanceof THREE.LineSegments) {
                 object.geometry.dispose(); // Dispose edges geometry
                 if (Array.isArray(object.material)) { object.material.forEach(m=>m.dispose()); } else { object.material.dispose(); }
             }
        });

        // Dispose cached materials and textures
        this.textMaterialCache.forEach(material => {
            if (material.map) material.map.dispose();
            material.dispose();
        });
        this.textMaterialCache.clear();

        // Dispose portals
        if (this.portal) this.portal.dispose();
        if (this.returnPortal) this.returnPortal.dispose();
        this.portal = null;
        this.returnPortal = null;

        // Remove ramps from physics world and scene
        this.rampBodies.forEach(body => {
             if (body.world) { // Check if body is still in the world
                 this.world.removeBody(body);
             }
        });
        // Ramps (THREE.Group) will be removed by scene traversal/clearing
        this.rampBodies = [];
        this.ramps = []; // Clear the array holding groups

        // Remove redirect shape bodies
        this.redirectShapeBodies.forEach(body => {
            if (body.world) { this.world.removeBody(body); }
        });
        this.redirectShapeBodies = [];
        this.redirectShapes = []; // Visual groups removed by scene clear/traversal
    }
} 