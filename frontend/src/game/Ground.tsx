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
  const texture = useLoader(TextureLoader, '/segment.jpg');
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(50, 50); // Adjusted for better tiling
  texture.magFilter = LinearFilter; // Smoother texture
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  const SIZE_MULTIPLIER = 4; // Match the SIZE_MULTIPLIER from LightCycle.ts
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
  
  // Load arena7.mtl for materials
  useEffect(() => {
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();
    
    mtlLoader.load('/models/arena7.mtl', (materials) => {
      materials.preload();
      console.log("Arena materials loaded", materials);
      
      // Apply materials to ground
      if (groundRef.current) {
        const material = materials.materials['Material.001'];
        if (material) {
          // Convert to MeshPhysicalMaterial to use advanced properties
          const physicalMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x0fbef2, // Bright cyan
            emissive: 0x0fbef2,
            emissiveIntensity: 1.0,
            opacity: 0.8,
            transparent: true,
            metalness: 0.9,
            roughness: 0.1
          });
          
          // Apply to ground
          groundRef.current.material = physicalMaterial;
        }
      }
      
      // Apply segment material to walls if available
      if (wallsRef.current) {
        const segmentMaterial = materials.materials['segment'];
        if (segmentMaterial) {
          // Create new material based on segment material properties
          const wallsMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            color: 0x0fbef2,
            emissive: 0x0fbef2,
            emissiveIntensity: 1.0,
            metalness: 0.9,
            roughness: 0.1
          });
          
          // Apply to all wall children
          wallsRef.current.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = wallsMaterial.clone();
            }
          });
        }
      }
    });
  }, [texture]);

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
          transparent
          opacity={0.9}
          emissive="#0fbef2"
          emissiveIntensity={0.8} // Increased intensity
          color="#ffffff"
          metalness={0.8}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>
      
      {/* Physics ground (invisible) */}
      <mesh ref={ref} visible={false}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial opacity={0} transparent />
      </mesh>

      {/* Reflection plane slightly below main ground */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshPhysicalMaterial
          color="#0fbef2"
          transparent
          opacity={0.2} // Increased opacity
          emissive="#0fbef2"
          emissiveIntensity={1.2} // Increased intensity
          metalness={0.9}
          roughness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
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