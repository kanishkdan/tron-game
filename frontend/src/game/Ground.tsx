import { usePlane, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, NearestFilter, LinearFilter } from 'three';

export const Ground = () => {
  // Load and configure the grid texture
  const texture = useLoader(TextureLoader, '/segment.jpg');
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(50, 50); // Adjusted for better tiling
  texture.magFilter = LinearFilter; // Smoother texture
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  const SIZE_MULTIPLIER = 2; // Match the multiplier from LightCycle.ts
  const groundSize = 5000 * SIZE_MULTIPLIER;
  const wallHeight = 20 * SIZE_MULTIPLIER;

  // Update physics plane to match visual size
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
    args: [groundSize, groundSize], // Add size arguments to the physics plane
  }));

  // Add physics walls
  const [frontWall] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position: [0, wallHeight/2, -groundSize/2],
    args: [groundSize, wallHeight, 1],
  }));

  const [backWall] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position: [0, wallHeight/2, groundSize/2],
    args: [groundSize, wallHeight, 1],
  }));

  const [leftWall] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position: [-groundSize/2, wallHeight/2, 0],
    args: [1, wallHeight, groundSize],
  }));

  const [rightWall] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position: [groundSize/2, wallHeight/2, 0],
    args: [1, wallHeight, groundSize],
  }));
  
  return (
    <>
      {/* Main ground plane with grid texture */}
      <mesh ref={ref} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshPhysicalMaterial 
          map={texture}
          transparent
          opacity={0.9}
          emissive="#0fbef2"
          emissiveIntensity={0.3}
          color="#ffffff"
          metalness={0.8}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Reflection plane slightly below main ground */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshPhysicalMaterial
          color="#0fbef2"
          transparent
          opacity={0.15}
          emissive="#0fbef2"
          emissiveIntensity={0.8}
          metalness={0.9}
          roughness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Boundary walls with improved materials */}
      {/* Front wall */}
      <mesh ref={frontWall} position={[0, wallHeight/2, -groundSize/2]} receiveShadow>
        <boxGeometry args={[groundSize, wallHeight, 1]} />
        <meshPhysicalMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.8}
          metalness={0.8}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Back wall */}
      <mesh ref={backWall} position={[0, wallHeight/2, groundSize/2]} receiveShadow>
        <boxGeometry args={[groundSize, wallHeight, 1]} />
        <meshPhysicalMaterial 
          color="#0fbef2" 
          transparent
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.8}
          metalness={0.8}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Left wall */}
      <mesh ref={leftWall} position={[-groundSize/2, wallHeight/2, 0]} receiveShadow>
        <boxGeometry args={[1, wallHeight, groundSize]} />
        <meshPhysicalMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.8}
          metalness={0.8}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>

      {/* Right wall */}
      <mesh ref={rightWall} position={[groundSize/2, wallHeight/2, 0]} receiveShadow>
        <boxGeometry args={[1, wallHeight, groundSize]} />
        <meshPhysicalMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.8}
          metalness={0.8}
          roughness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          envMapIntensity={1.0}
        />
      </mesh>
    </>
  );
}; 