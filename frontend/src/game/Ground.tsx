import { usePlane, useSphere, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, LinearFilter, BackSide } from 'three';
import { useEffect, useRef } from 'react';

export const Ground = () => {
  const groundRef = useRef<THREE.Mesh>(null);
  const domeRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);

  // Load and configure the grid texture
  const texture = useLoader(TextureLoader, '/textures/tron_tile.png', undefined, (error) => {
    console.error('Error loading texture:', error);
  });
  
  useEffect(() => {
    if (texture) {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(50, 50);
      texture.magFilter = LinearFilter;
      texture.minFilter = LinearFilter;
      texture.needsUpdate = true;
    }
  }, [texture]);

  const SIZE_MULTIPLIER = 4;
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

  // Dome physics (simple sphere collider)
  const [domePhysics] = useSphere<THREE.Mesh>(() => ({
    type: 'Static',
    args: [domeRadius],
    position: [0, domeHeight/2, 0],
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

  // Moon material with glow effect
  const moonMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0x0fbef2,
    emissiveIntensity: 1.0,
    metalness: 0.0,
    roughness: 0.5,
    transparent: true,
    opacity: 0.9,
  });

  const moonGlowMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0fbef2,
    emissive: 0x0fbef2,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });

  // Materials for ramps, jumps and structures
  const structureMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    emissive: 0x0fbef2,
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.2,
    transparent: false,
    opacity: 1.0
  });

  const glowEdgeMaterial = new THREE.MeshBasicMaterial({
    color: 0x0fbef2,
    transparent: true,
    opacity: 0.8,
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

    // Animate moon glow
    const animate = () => {
      if (moonRef.current) {
        moonRef.current.rotation.y += 0.001;
      }
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      // Cleanup animation on unmount
      if (moonRef.current) {
        moonRef.current.rotation.y = 0;
      }
    };
  }, [ref]);

  // Create ramp physics bodies - reduced number and simplified
  const rampPositions = [
    { position: [groundSize * 0.2, 5, groundSize * 0.2] as [number, number, number], rotation: [0, Math.PI / 4, 0] as [number, number, number], size: [30, 10, 80] as [number, number, number] },
    { position: [-groundSize * 0.3, 5, -groundSize * 0.25] as [number, number, number], rotation: [0, -Math.PI / 6, 0] as [number, number, number], size: [40, 15, 100] as [number, number, number] },
  ];

  // Create floor gaps (holes)
  const holePositions = [
    { position: [0, -5, groundSize * 0.1] as [number, number, number], size: [60, 10, 120] as [number, number, number] },
  ];

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

      {/* Ramps and jumps - optimized */}
      {rampPositions.map((ramp, index) => {
        // Physics for ramp
        const [rampRef] = useBox<THREE.Mesh>(() => ({
          mass: 0,
          type: 'Static',
          position: ramp.position,
          rotation: ramp.rotation,
          args: ramp.size,
        }));

        return (
          <group key={`ramp-${index}`}>
            {/* Main ramp structure */}
            <mesh 
              ref={rampRef}
              position={ramp.position}
              rotation={ramp.rotation}
              castShadow 
              receiveShadow
            >
              <boxGeometry args={ramp.size} />
              <primitive object={structureMaterial} />
            </mesh>
            
            {/* Glowing edges */}
            <mesh 
              position={ramp.position}
              rotation={ramp.rotation}
              scale={[1.01, 1.01, 1.01]}
            >
              <boxGeometry args={ramp.size} />
              <meshBasicMaterial 
                color={0x0fbef2} 
                wireframe 
                transparent 
                opacity={0.6}
              />
            </mesh>
          </group>
        );
      })}

      {/* Floor gaps/holes */}
      {holePositions.map((hole, index) => (
        <group key={`hole-${index}`}>
          {/* Hole outline glow */}
          <mesh
            position={[hole.position[0], 0.1, hole.position[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[hole.size[0] * 0.5 - 2, hole.size[0] * 0.5, 24]} />
            <meshBasicMaterial color={0x0fbef2} transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

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
            opacity={0.1}
          />
        </mesh>
      </mesh>

      {/* Moon */}
      <group position={[domeRadius * 0.5, domeHeight * 0.7, -domeRadius * 0.3]} ref={moonRef}>
        {/* Moon core */}
        <mesh castShadow>
          <sphereGeometry args={[domeRadius * 0.05, 32, 32]} />
          <primitive object={moonMaterial} />
        </mesh>

        {/* Moon glow */}
        <mesh scale={[1.5, 1.5, 1.5]}>
          <sphereGeometry args={[domeRadius * 0.05, 32, 32]} />
          <primitive object={moonGlowMaterial} />
        </mesh>

        {/* Moon light */}
        <pointLight
          intensity={2}
          distance={domeRadius * 2}
          decay={2}
          color={0x0fbef2}
        />
      </group>

      {/* Ambient lighting */}
      <ambientLight intensity={0.2} />

      {/* Ground accent lighting - reduced count */}
      <pointLight
        position={[0, domeHeight * 0.1, 0]}
        intensity={0.8}
        color={0x0fbef2}
        distance={groundSize * 0.7}
        decay={2}
      />
    </>
  );
}; 