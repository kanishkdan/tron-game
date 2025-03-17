import { RESPAWN_POINTS } from './Player';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const RespawnPoints = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Make the points bob up and down
      groupRef.current.children.forEach((child, i) => {
        child.position.y = Math.sin(state.clock.elapsedTime + i) * 0.2 + 12.5;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {RESPAWN_POINTS.map((point, index) => (
        <mesh key={index} position={[point[0], point[1] + 0.5, point[2]]}>
          <cylinderGeometry args={[0.5, 0.5, 0.1, 16]} />
          <meshStandardMaterial 
            color="#00ff00"
            transparent
            opacity={0.6}
            emissive="#00ff00"
            emissiveIntensity={0.5}
          />
          <pointLight
            color="#00ff00"
            intensity={0.5}
            distance={3}
          />
        </mesh>
      ))}
    </group>
  );
}; 