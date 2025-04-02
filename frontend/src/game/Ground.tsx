import { usePlane, useSphere, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, LinearFilter, BackSide, LinearMipmapLinearFilter } from 'three';
import { useEffect, useRef } from 'react';

export const Ground = () => {
  const groundRef = useRef<THREE.Mesh>(null);
  const domeRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();

  // Load and configure the grid texture
  const texture = useLoader(TextureLoader, '/textures/tron_tile.png', undefined, (error) => {
    console.error('Error loading texture:', error);
  });
  
  useEffect(() => {
    if (texture) {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(30, 30);
      texture.magFilter = LinearFilter;
      texture.minFilter = LinearMipmapLinearFilter;
      
      // Enable Anisotropic Filtering
      const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
      texture.anisotropy = maxAnisotropy;
      
      texture.needsUpdate = true;
    }
  }, [texture, gl]);

  const SIZE_MULTIPLIER = 5;
  const groundSize = 500 * SIZE_MULTIPLIER;
  const domeHeight = groundSize * 0.8; // Dome height relative to ground size
  const domeRadius = groundSize * 0.7; // Slightly larger than the ground to ensure coverage

  // Ground physics
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: 'Static',
    args: [groundSize, groundSize],
  }));

  // Materials
  const groundMaterial = new THREE.MeshPhysicalMaterial({
    map: texture,
    color: 0x111111,
    emissive: 0x0fbef2,
    emissiveMap: texture,
    emissiveIntensity: 0.2,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 0.8
  });

  // Create a more realistic dome material with hexagonal pattern
  const domeGeometry = new THREE.IcosahedronGeometry(domeRadius, 4);
  const hexPattern = new THREE.DataTexture(
    (() => {
      const size = 256;
      const data = new Uint8Array(size * size * 4);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const hex = ((i ^ j) % 16 === 0) ? 255 : 0;
          const idx = (i * size + j) * 4;
          data[idx] = hex * 0.1;     // R
          data[idx + 1] = hex * 0.6;  // G
          data[idx + 2] = hex;        // B
          data[idx + 3] = 255;        // A
        }
      }
      return data;
    })(),
    256,
    256,
    THREE.RGBAFormat
  );
  hexPattern.needsUpdate = true;

  const domeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000d1a,
    emissive: 0x0fbef2,
    emissiveIntensity: 0.1,
    metalness: 0.9,
    roughness: 0.3,
    transparent: true,
    opacity: 0.95,
    side: BackSide,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    alphaMap: hexPattern,
  });
  
  // Translucent layer material
  const lowerLayerMaterial = new THREE.MeshPhysicalMaterial({
    map: texture,
    color: 0x111111,
    emissive: 0x0fbef2,
    emissiveMap: texture,
    emissiveIntensity: 0.3,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 0.5
  });

  useEffect(() => {
    if (ref.current && groundRef.current) {
      groundRef.current.position.copy(ref.current.position);
      groundRef.current.rotation.copy(ref.current.rotation);
    }
  }, [ref]);

  return (
    <>
      {/* Ground with holes */}
      <mesh ref={groundRef} receiveShadow>
        <planeGeometry args={[groundSize, groundSize, 8, 8]} />
        <primitive object={groundMaterial} />
      </mesh>

      {/* Just one lower layer for effect without performance hit */}
      <mesh 
        position={[0, -40, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundSize, groundSize, 8, 8]} />
        <primitive object={lowerLayerMaterial} />
      </mesh>


      {/* Dome */}
      <mesh ref={domeRef} receiveShadow>
        <primitive object={domeGeometry} />
        <primitive object={domeMaterial} />

        {/* Grid lines on dome */}
        <mesh scale={[1.001, 1.001, 1.001]}>
          <primitive object={domeGeometry} />
          <meshBasicMaterial
            color={0x0fbef2}
            wireframe
            transparent
            opacity={1}
          />
        </mesh>
      </mesh>

    </>
  );
}; 