import { usePlane, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, NearestFilter, LinearFilter } from 'three';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { useEffect, useRef } from 'react';

export const Ground = () => {
  const groundRef = useRef<THREE.Mesh>(null);
  const wallsRef = useRef<THREE.Group>(null);

  // Load and configure the grid texture
  const texture = useLoader(TextureLoader, '/textures/tron_tile.png', undefined, (error) => {
    console.error('Error loading texture:', error);
  });
  
  useEffect(() => {
    if (texture) {
      console.log('Texture loaded successfully:', texture);
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(20, 20); // Reduced from 100 to make tiles bigger
      texture.magFilter = LinearFilter;
      texture.minFilter = LinearFilter;
      texture.needsUpdate = true;
    }
  }, [texture]);

  // Load arena materials
  useEffect(() => {
    const mtlLoader = new MTLLoader();
    mtlLoader.load('/models/arena7.mtl', (materials) => {
      materials.preload();
      console.log("Arena materials loaded:", materials);

      // Apply materials to ground
      if (groundRef.current) {
        const material = materials.materials['segment'];
        if (material) {
          const groundMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            color: 0x111111,         // Slightly lighter base color
            emissive: 0x0fbef2,      // Slight blue emission
            emissiveMap: texture,     // Use texture for emissive areas
            emissiveIntensity: 0.2,   // Increased emission
            metalness: 0.7,           // Slightly less metallic
            roughness: 0.3,           // Keep low roughness for shine
            transparent: true,
            opacity: 0.8             // More opacity to make it more visible
          });
          groundRef.current.material = groundMaterial;
        }
      }
    });
  }, [texture]);

  const SIZE_MULTIPLIER = 4; // Standardized multiplier across all components
  const groundSize = 500 * SIZE_MULTIPLIER;
  const wallHeight = 20 * SIZE_MULTIPLIER;
  const wallThickness = 2 * SIZE_MULTIPLIER;

  // Update physics plane to match visual size
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
    args: [groundSize, groundSize],
  }));

  // Add physics walls
  const [frontWall] = useBox<THREE.Group>(() => ({
    type: 'Static',
    position: [0, wallHeight/2, -groundSize/2],
    args: [groundSize, wallHeight, wallThickness],
  }));

  const [backWall] = useBox<THREE.Group>(() => ({
    type: 'Static',
    position: [0, wallHeight/2, groundSize/2],
    args: [groundSize, wallHeight, wallThickness],
  }));

  const [leftWall] = useBox<THREE.Group>(() => ({
    type: 'Static',
    position: [-groundSize/2, wallHeight/2, 0],
    args: [wallThickness, wallHeight, groundSize],
  }));

  const [rightWall] = useBox<THREE.Group>(() => ({
    type: 'Static',
    position: [groundSize/2, wallHeight/2, 0],
    args: [wallThickness, wallHeight, groundSize],
  }));

  // Create neon text material with higher intensity
  const neonTextMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0fbef2',
    emissive: '#0fbef2',
    emissiveIntensity: 2.0, // Increased intensity
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.9,
  });

  // Create wall material with neon effect and higher intensity
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0fbef2',
    emissive: '#0fbef2',
    emissiveIntensity: 1.5, // Increased intensity
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.4, // Increased opacity
  });

  // Create wall edge material with higher intensity
  const wallEdgeMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0fbef2',
    emissive: '#0fbef2',
    emissiveIntensity: 2.0, // Increased intensity
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.9, // Increased opacity
  });
  
  // Use effect to combine the refs
  useEffect(() => {
    if (ref.current && groundRef.current) {
      // Copy position and rotation from physics ref to visual ref
      groundRef.current.position.copy(ref.current.position);
      groundRef.current.rotation.copy(ref.current.rotation);
    }
  }, [ref]);
  
  return (
    <>
      {/* Main ground plane with grid texture */}
      <mesh 
        ref={groundRef}
        receiveShadow
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshPhysicalMaterial 
          map={texture}
          color={0x111111}           // Match the material above
          emissive={0x0fbef2}        // Match the material above
          emissiveMap={texture}
          emissiveIntensity={0.2}
          metalness={0.7}
          roughness={0.3}
          transparent={true}
          opacity={0.8}
        />
      </mesh>
      
      {/* Physics ground (invisible) */}
      <mesh ref={ref} visible={false}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial opacity={0} transparent />
      </mesh>

      {/* Walls container ref */}
      <group ref={wallsRef}>
        {/* Front wall */}
        <group ref={frontWall} position={[0, wallHeight/2, -groundSize/2]}>
          {/* Main wall */}
          <mesh receiveShadow>
            <boxGeometry args={[groundSize, wallHeight, wallThickness]} />
            <primitive object={wallMaterial} />
          </mesh>
          {/* Wall edges */}
          <mesh position={[0, 0, wallThickness/2]}>
            <boxGeometry args={[groundSize, wallHeight, 0.1]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[0, 0, -wallThickness/2]}>
            <boxGeometry args={[groundSize, wallHeight, 0.1]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          {/* Neon text */}
          <mesh position={[0, 0, wallThickness/2 + 0.1]}>
            <planeGeometry args={[groundSize/2, wallHeight/2]} />
            <primitive object={neonTextMaterial} />
          </mesh>
          {/* Add point lights for extra visibility */}
          <pointLight position={[0, 0, wallThickness/2]} intensity={0.5} color={0x0fbef2} distance={10} />
        </group>

        {/* Back wall */}
        <group ref={backWall} position={[0, wallHeight/2, groundSize/2]}>
          <mesh receiveShadow>
            <boxGeometry args={[groundSize, wallHeight, wallThickness]} />
            <primitive object={wallMaterial} />
          </mesh>
          <mesh position={[0, 0, wallThickness/2]}>
            <boxGeometry args={[groundSize, wallHeight, 0.1]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[0, 0, -wallThickness/2]}>
            <boxGeometry args={[groundSize, wallHeight, 0.1]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[0, 0, -wallThickness/2 - 0.1]}>
            <planeGeometry args={[groundSize/2, wallHeight/2]} />
            <primitive object={neonTextMaterial} />
          </mesh>
          <pointLight position={[0, 0, -wallThickness/2]} intensity={0.5} color={0x0fbef2} distance={10} />
        </group>

        {/* Left wall */}
        <group ref={leftWall} position={[-groundSize/2, wallHeight/2, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[wallThickness, wallHeight, groundSize]} />
            <primitive object={wallMaterial} />
          </mesh>
          <mesh position={[wallThickness/2, 0, 0]}>
            <boxGeometry args={[0.1, wallHeight, groundSize]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[-wallThickness/2, 0, 0]}>
            <boxGeometry args={[0.1, wallHeight, groundSize]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[wallThickness/2 + 0.1, 0, 0]}>
            <planeGeometry args={[wallHeight/2, groundSize/2]} />
            <primitive object={neonTextMaterial} />
          </mesh>
          <pointLight position={[wallThickness/2, 0, 0]} intensity={0.5} color={0x0fbef2} distance={10} />
        </group>

        {/* Right wall */}
        <group ref={rightWall} position={[groundSize/2, wallHeight/2, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[wallThickness, wallHeight, groundSize]} />
            <primitive object={wallMaterial} />
          </mesh>
          <mesh position={[wallThickness/2, 0, 0]}>
            <boxGeometry args={[0.1, wallHeight, groundSize]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[-wallThickness/2, 0, 0]}>
            <boxGeometry args={[0.1, wallHeight, groundSize]} />
            <primitive object={wallEdgeMaterial} />
          </mesh>
          <mesh position={[-wallThickness/2 - 0.1, 0, 0]}>
            <planeGeometry args={[wallHeight/2, groundSize/2]} />
            <primitive object={neonTextMaterial} />
          </mesh>
          <pointLight position={[-wallThickness/2, 0, 0]} intensity={0.5} color={0x0fbef2} distance={10} />
        </group>
      </group>
    </>
  );
}; 