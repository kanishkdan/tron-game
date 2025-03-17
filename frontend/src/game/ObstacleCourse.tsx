import { useRef } from 'react';
import { useBox, useCylinder } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Mesh } from 'three';

// Platform dimensions and positions
const START_PLATFORM_POS: [number, number, number] = [0, 10, -15];
const FINISH_PLATFORM_POS: [number, number, number] = [0, 25, 65];  // Higher and further
const COURSE_HEIGHT = 10;

interface PlatformProps {
  position: [number, number, number];
  size?: [number, number, number];
  color?: string;
  rotation?: [number, number, number];
}

const Platform = ({ position, size = [4, 0.5, 4], color = '#4CAF50', rotation = [0, 0, 0] }: PlatformProps) => {
  const [ref] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    rotation,
    args: size,
  }));

  return (
    <mesh ref={ref} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

interface RotatingPlatformProps {
  position: [number, number, number];
  speed?: number;
}

const RotatingPlatform = ({ position, speed = 1 }: RotatingPlatformProps) => {
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: [8, 0.5, 1] as [number, number, number],
  }));

  useFrame((state) => {
    api.rotation.set(0, state.clock.elapsedTime * speed, 0);
  });

  return (
    <mesh ref={ref} receiveShadow castShadow>
      <boxGeometry args={[8, 0.5, 1]} />
      <meshStandardMaterial color="#FF9800" />
    </mesh>
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
    <mesh ref={ref} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#E91E63" />
    </mesh>
  );
};

interface CheckpointProps {
  position: [number, number, number];
  index: number;
}

const Checkpoint = ({ position, index }: CheckpointProps) => {
  const [ref] = useCylinder<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    args: [1, 1, 0.1, 16],
    isTrigger: true,
  }));

  return (
    <mesh ref={ref} receiveShadow castShadow>
      <cylinderGeometry args={[1, 1, 0.1, 16]} />
      <meshStandardMaterial color="#2196F3" transparent opacity={0.6} />
    </mesh>
  );
};

interface RampProps extends PlatformProps {
  speedMultiplier?: number;
}

const Ramp = ({ position, size = [4, 0.5, 8], color = '#FF9800', rotation = [0, 0, 0], speedMultiplier = 1 }: RampProps) => {
  const [ref] = useBox<THREE.Mesh>(() => ({
    type: 'Static',
    position,
    rotation,
    args: size,
  }));

  return (
    <mesh ref={ref} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

export const ObstacleCourse = () => {
  return (
    <group>
      {/* Start Area */}
      <Platform position={START_PLATFORM_POS} size={[8, 0.5, 8]} color="#4CAF50" />
      
      {/* Initial Path - Tutorial Section */}
      <Platform position={[0, COURSE_HEIGHT, -8]} size={[4, 0.5, 6]} />
      
      {/* Basic Platforms - Closer Together */}
      <Platform position={[0, COURSE_HEIGHT, -2]} size={[4, 0.5, 4]} />
      <Platform position={[0, COURSE_HEIGHT, 4]} size={[4, 0.5, 4]} />
      
      {/* First Split Path - More Connected */}
      <Platform position={[-3, COURSE_HEIGHT, 10]} size={[4, 0.5, 4]} />
      <Platform position={[3, COURSE_HEIGHT, 10]} size={[4, 0.5, 4]} />
      
      {/* Left Path - Moving Platforms */}
      <MovingPlatform 
        position={[-3, COURSE_HEIGHT, 16]} 
        range={2}
        speed={1}
        size={[4, 0.5, 4]}
        axis="y"
      />
      <Platform position={[-3, COURSE_HEIGHT + 2, 22]} size={[4, 0.5, 4]} />
      
      {/* Right Path - Ramps */}
      <Ramp 
        position={[3, COURSE_HEIGHT + 1, 16]} 
        rotation={[-Math.PI / 12, 0, 0]}
        size={[4, 0.5, 6]}
      />
      <Platform position={[3, COURSE_HEIGHT + 3, 22]} size={[4, 0.5, 4]} />
      
      {/* Paths Converge - Central Platform */}
      <Platform position={[0, COURSE_HEIGHT + 4, 28]} size={[10, 0.5, 6]} />
      
      {/* Final Stretch */}
      <RotatingPlatform position={[0, COURSE_HEIGHT + 4, 35]} speed={0.6} />
      
      {/* Moving Platform Challenge */}
      <MovingPlatform 
        position={[0, COURSE_HEIGHT + 4, 42]} 
        range={3}
        speed={1.2}
        size={[4, 0.5, 4]}
        axis="x"
      />
      
      {/* Final Approach */}
      <Ramp 
        position={[0, COURSE_HEIGHT + 6, 49]} 
        rotation={[-Math.PI / 12, 0, 0]}
        size={[4, 0.5, 8]}
      />
      
      {/* Finish Platform */}
      <Platform position={FINISH_PLATFORM_POS} size={[8, 0.5, 8]} color="#F44336" />
      
      {/* Safety Nets - Larger and More Visible */}
      <Platform position={[0, 5, 15]} size={[40, 0.5, 40]} color="#B0BEC5" />
      <Platform position={[0, 5, 45]} size={[40, 0.5, 40]} color="#B0BEC5" />
      
      {/* Guide Rails - Higher and More Protective */}
      {/* Left Side */}
      <Platform position={[-8, COURSE_HEIGHT + 3, 20]} size={[0.5, 6, 50]} color="#90A4AE" />
      {/* Right Side */}
      <Platform position={[8, COURSE_HEIGHT + 3, 20]} size={[0.5, 6, 50]} color="#90A4AE" />
      
      {/* Additional Guide Rails for Start Area */}
      <Platform position={[-4, COURSE_HEIGHT + 1, -8]} size={[0.5, 4, 8]} color="#90A4AE" />
      <Platform position={[4, COURSE_HEIGHT + 1, -8]} size={[0.5, 4, 8]} color="#90A4AE" />
    </group>
  );
}; 