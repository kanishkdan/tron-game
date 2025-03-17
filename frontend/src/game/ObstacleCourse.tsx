import { useRef, useMemo } from 'react';
import { useBox, useCylinder } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, RoundedBox } from '@react-three/drei';

// Platform dimensions and positions
const START_PLATFORM_POS: [number, number, number] = [0, 10.5, -28];
const FINISH_PLATFORM_POS: [number, number, number] = [0, 10, 35];
const COURSE_HEIGHT = 10;

// Create shared materials with high-quality settings
const createPlatformMaterial = (color: string, metalness = 0.7, roughness = 0.2) => {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 1.2,
  });
  return material;
};

// Vibrant Fall Guys color palette
const materials = {
  start: createPlatformMaterial('#2B2B2B', 0.8, 0.2),
  finish: createPlatformMaterial('#F44336', 0.8, 0.2),
  platform: createPlatformMaterial('#007bff', 0.7, 0.2),
  rotating: createPlatformMaterial('#FF9800', 0.8, 0.1),
  moving: createPlatformMaterial('#E91E63', 0.8, 0.1),
  seesaw: createPlatformMaterial('#9C27B0', 0.7, 0.2),
  border: createPlatformMaterial('#FF69B4', 0.8, 0.1),
  rail: createPlatformMaterial('#FF69B4', 0.9, 0.1),
  wall: createPlatformMaterial('#607D8B', 0.8, 0.3),
  elevator: createPlatformMaterial('#4DB6AC', 0.8, 0.2),
};

// Create a checkered texture for the finish line
const createCheckerTexture = () => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const tileSize = size / 8;
  for (let x = 0; x < size; x += tileSize) {
    for (let y = 0; y < size; y += tileSize) {
      ctx.fillStyle = (x + y) % (tileSize * 2) === 0 ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

interface PlatformProps {
  position: [number, number, number];
  size?: [number, number, number];
  material?: THREE.Material;
  rotation?: [number, number, number];
  children?: React.ReactNode;
}

const Platform = ({ position, size = [4, 0.5, 4], material = materials.platform, rotation = [0, 0, 0], children }: PlatformProps) => {
  const [ref] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    rotation,
    args: size,
  }));

  return (
    <RoundedBox
      ref={ref}
      args={size}
      radius={0.2}
      smoothness={4}
      receiveShadow
      castShadow
    >
      {children || <primitive object={material} attach="material" />}
      <mesh scale={[1.02, 1.02, 1.02]}>
        <boxGeometry args={[...size]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
      </mesh>
    </RoundedBox>
  );
};

interface RotatingObstacleProps {
  position: [number, number, number];
  speed?: number;
}

const RotatingObstacle = ({ position, speed = 1 }: RotatingObstacleProps) => {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: [8, 1.5, 1],
  }));

  useFrame((state) => {
    api.rotation.set(0, state.clock.elapsedTime * speed, 0);
  });

  return (
    <RoundedBox
      ref={ref}
      args={[8, 1.5, 1]}
      radius={0.2}
      smoothness={4}
      receiveShadow
      castShadow
    >
      <primitive object={materials.rotating} attach="material" />
      <mesh scale={[1.02, 1.02, 1.02]}>
        <boxGeometry args={[8, 1.5, 1]} />
        <meshBasicMaterial color="#FFA726" transparent opacity={0.2} />
      </mesh>
    </RoundedBox>
  );
};

interface MovingPlatformProps {
  position: [number, number, number];
  range?: number;
  speed?: number;
  size?: [number, number, number];
  axis?: 'x' | 'z' | 'y';
}

const MovingPlatform = ({ 
  position, 
  range = 3, 
  speed = 2, 
  size = [4, 0.5, 4],
  axis = 'x' 
}: MovingPlatformProps) => {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: size,
  }));

  useFrame((state) => {
    const offset = Math.sin(state.clock.elapsedTime * speed) * range;
    const newPosition: [number, number, number] = [
      axis === 'x' ? position[0] + offset : position[0],
      axis === 'y' ? position[1] + offset : position[1],
      axis === 'z' ? position[2] + offset : position[2]
    ];
    api.position.set(...newPosition);
  });

  return (
    <RoundedBox
      ref={ref}
      args={size}
      radius={0.2}
      smoothness={4}
      receiveShadow
      castShadow
    >
      <primitive object={materials.moving} attach="material" />
      <mesh scale={[1.02, 1.02, 1.02]}>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#EC407A" transparent opacity={0.2} />
      </mesh>
    </RoundedBox>
  );
};

interface SeesawProps {
  position: [number, number, number];
  size?: [number, number, number];
}

const Seesaw = ({ position, size = [6, 0.5, 4] }: SeesawProps) => {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    type: 'Dynamic',
    position,
    args: size,
    mass: 1,
    angularDamping: 0.9,
    linearDamping: 0.9,
  }));

  return (
    <RoundedBox
      ref={ref}
      args={size}
      radius={0.2}
      smoothness={4}
      receiveShadow
      castShadow
    >
      <primitive object={materials.seesaw} attach="material" />
      <mesh scale={[1.02, 1.02, 1.02]}>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#CE93D8" transparent opacity={0.2} />
      </mesh>
    </RoundedBox>
  );
};

interface SideRailProps {
  position: [number, number, number];
  length: number;
  radius?: number;
}

const SideRail = ({ position, length, radius = 0.3 }: SideRailProps) => {
  const [ref] = useCylinder<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    rotation: [Math.PI / 2, 0, 0], // Rotate to face forward
    args: [radius, radius, length, 16],
  }));

  return (
    <mesh ref={ref} receiveShadow castShadow>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <primitive object={materials.rail} attach="material" />
    </mesh>
  );
};

interface ElevatorProps {
  position: [number, number, number];
  index: number;
  totalElevators: number;
}

const Elevator = ({ position, index, totalElevators }: ElevatorProps) => {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: [4, 0.5, 4],
  }));

  useFrame((state) => {
    // Each elevator moves with a different phase to create a wave pattern
    const phase = (index / totalElevators) * Math.PI * 2;
    // Use (sin + 1) / 2 to keep values between 0 and 1, then scale to desired range
    const height = ((Math.sin(state.clock.elapsedTime * 0.5 + phase) + 1) / 2) * 12;
    api.position.set(position[0], COURSE_HEIGHT + height, position[2]);
  });

  return (
    <RoundedBox
      ref={ref}
      args={[4, 0.5, 4]}
      radius={0.2}
      smoothness={4}
      receiveShadow
      castShadow
    >
      <primitive object={materials.elevator} attach="material" />
      <mesh scale={[1.02, 1.02, 1.02]}>
        <boxGeometry args={[4, 0.5, 4]} />
        <meshBasicMaterial color="#80CBC4" transparent opacity={0.2} />
      </mesh>
    </RoundedBox>
  );
};

interface HurdleProps {
  position: [number, number, number];
  width?: number;
  height?: number;
}

const Hurdle = ({ position, width = 6, height = 1.5 }: HurdleProps) => {
  // Create a single solid barrier for the entire hurdle
  const [barrierRef] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: [width - 0.4, height, 0.2],
  }));

  return (
    <group>
      {/* Solid barrier */}
      <RoundedBox
        ref={barrierRef}
        args={[width - 0.4, height, 0.2]}
        radius={0.05}
        smoothness={4}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#FF69B4" metalness={0.9} roughness={0.1} />
      </RoundedBox>

      {/* Decorative posts and bar */}
      <mesh position={[-width/2, height/2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, height, 8]} />
        <primitive object={materials.rail} attach="material" />
      </mesh>
      
      <mesh position={[width/2, height/2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, height, 8]} />
        <primitive object={materials.rail} attach="material" />
      </mesh>
      
      <mesh position={[0, height, 0]} rotation={[0, 0, Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, width, 8]} />
        <primitive object={materials.rail} attach="material" />
      </mesh>
    </group>
  );
};

export const ObstacleCourse = () => {
  const checkerTexture = useMemo(() => createCheckerTexture(), []);

  // Constants for the first obstacle
  const PLATFORM_LENGTH = 30;
  const PLATFORM_WIDTH = 8;
  const WALL_HEIGHT = 15;
  const NUM_ELEVATORS = 3;
  const NUM_HURDLES = 5;

  // Calculate hurdle positions with better spacing
  const startOffset = 5; // Distance from start
  const endOffset = 8;   // Distance from wall
  const usableLength = PLATFORM_LENGTH - startOffset - endOffset;
  const hurdleSpacing = usableLength / (NUM_HURDLES + 1);
  
  const hurdles = Array.from({ length: NUM_HURDLES }).map((_, i) => ({
    position: [
      0, 
      COURSE_HEIGHT, 
      -PLATFORM_LENGTH + startOffset + ((i + 1) * hurdleSpacing)
    ] as [number, number, number],
  }));

  return (
    <group>
      {/* Start Platform with 3D Text */}
      <group>
        <Platform position={START_PLATFORM_POS} size={[8, 0.5, 8]} material={materials.start} />
        <Text3D
          font="/fonts/helvetiker_regular.typeface.json"
          position={[START_PLATFORM_POS[0] + 2, START_PLATFORM_POS[1] + 1, START_PLATFORM_POS[2] - 3]}
          size={1}
          height={0.2}
          rotation={[0, Math.PI, 0]}
        >
          START
          <meshStandardMaterial color="#FF69B4" metalness={0.8} roughness={0.2} />
        </Text3D>
      </group>
      
      {/* Long Rectangle Platform */}
      <Platform 
        position={[0, COURSE_HEIGHT, -PLATFORM_LENGTH/2]} 
        size={[PLATFORM_WIDTH, 0.5, PLATFORM_LENGTH]} 
        material={materials.platform} 
      />
      
      {/* Side Rails - Horizontal along the platform */}
      <SideRail 
        position={[-PLATFORM_WIDTH/2, COURSE_HEIGHT + 1, -PLATFORM_LENGTH/2]}
        length={PLATFORM_LENGTH}
      />
      <SideRail 
        position={[PLATFORM_WIDTH/2, COURSE_HEIGHT + 1, -PLATFORM_LENGTH/2]}
        length={PLATFORM_LENGTH}
      />
      
      {/* Hurdles with better spacing */}
      {hurdles.map((hurdle, index) => (
        <Hurdle 
          key={`hurdle-${index}`}
          position={hurdle.position}
          width={PLATFORM_WIDTH - 1} // Slightly narrower than platform
          height={1.5}
        />
      ))}
      
      {/* Wall at the end */}
      <Platform 
        position={[0, COURSE_HEIGHT + WALL_HEIGHT/2, 0]} 
        size={[PLATFORM_WIDTH, WALL_HEIGHT, 1]} 
        material={materials.wall} 
      />
      
      {/* Elevators - Positioned in front of the wall */}
      {Array.from({ length: NUM_ELEVATORS }).map((_, i) => (
        <Elevator
          key={`elevator-${i}`}
          position={[(i - 1) * 4.5, COURSE_HEIGHT, -1]} // Moved slightly away from wall
          index={i}
          totalElevators={NUM_ELEVATORS}
        />
      ))}
    </group>
  );
}; 