import { usePlane } from '@react-three/cannon';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, NearestFilter } from 'three';

export const Ground = () => {
  // Load and configure the grid texture
  const texture = useLoader(TextureLoader, '/segment.jpg');
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(100, 100); // More dense grid pattern
  texture.magFilter = NearestFilter; // Crisp pixel texture
  texture.needsUpdate = true;

  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
  }));

  // Create a larger ground plane and add visible boundaries
  const groundSize = 500;
  const wallHeight = 20;
  
  return (
    <>
      {/* Main ground plane with grid texture */}
      <mesh ref={ref} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial 
          map={texture}
          transparent
          opacity={0.8}
          emissive="#0fbef2"
          emissiveIntensity={0.2}
          color="#ffffff"
        />
      </mesh>

      {/* Glow plane slightly below main ground */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial
          color="#0fbef2"
          transparent
          opacity={0.1}
          emissive="#0fbef2"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Boundary walls */}
      {/* Front wall */}
      <mesh position={[0, wallHeight/2, -groundSize/2]} receiveShadow>
        <boxGeometry args={[groundSize, wallHeight, 1]} />
        <meshStandardMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, wallHeight/2, groundSize/2]} receiveShadow>
        <boxGeometry args={[groundSize, wallHeight, 1]} />
        <meshStandardMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Left wall */}
      <mesh position={[-groundSize/2, wallHeight/2, 0]} receiveShadow>
        <boxGeometry args={[1, wallHeight, groundSize]} />
        <meshStandardMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Right wall */}
      <mesh position={[groundSize/2, wallHeight/2, 0]} receiveShadow>
        <boxGeometry args={[1, wallHeight, groundSize]} />
        <meshStandardMaterial 
          color="#0fbef2" 
          transparent 
          opacity={0.3}
          emissive="#0fbef2"
          emissiveIntensity={0.5}
        />
      </mesh>
    </>
  );
}; 