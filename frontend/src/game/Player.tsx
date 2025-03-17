import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSphere } from '@react-three/cannon';
import { useKeyboardControls, Html } from '@react-three/drei';
import * as THREE from 'three';

const JUMP_FORCE = 7.5; // Increased jump force
const MOVE_SPEED = 4;
const BALL_RADIUS = 0.4;
const RESPAWN_HEIGHT = -1; // Raised respawn height to match ocean level
const START_POSITION: [number, number, number] = [0, 10.25, -15];

// Define respawn points throughout the course
export const RESPAWN_POINTS: [number, number, number][] = [
  START_POSITION,
  [0, 12, -5],  // After start platform
  [0, 12, 3],   // Mid course
  [0, 12, 11],  // After rotating platform
  [0, 12, 19],  // After first moving platform
  [0, 12, 27],  // Near finish
];

// Function to find nearest respawn point
const findNearestRespawnPoint = (currentPos: [number, number, number]): [number, number, number] => {
  let nearestPoint = RESPAWN_POINTS[0];
  let minDistance = Infinity;
  
  RESPAWN_POINTS.forEach(point => {
    const distance = Math.sqrt(
      Math.pow(currentPos[0] - point[0], 2) +
      Math.pow(currentPos[2] - point[2], 2)  // Only consider X and Z for distance
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  });
  
  return nearestPoint;
};

interface PlayerProps {
  playerName?: string;
}

export interface PlayerRef {
  respawn: () => void;
  getPosition: () => THREE.Vector3;
}

export const Player = forwardRef<PlayerRef, PlayerProps>(({ playerName }, ref) => {
  const [meshRef, api] = useSphere<THREE.Mesh>(() => ({
    mass: 0,
    type: 'Dynamic',
    position: START_POSITION,
    args: [BALL_RADIUS],
    material: {
      friction: 0.3,
      restitution: 0.05,
    },
  }));

  const velocity = useRef<[number, number, number]>([0, 0, 0]);
  const position = useRef<[number, number, number]>(START_POSITION);
  const isGrounded = useRef(false);
  const gameStarted = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownStarted = useRef(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    respawn: respawnPlayer,
    getPosition: () => new THREE.Vector3(...position.current),
  }));

  // Helper function for consistent respawn behavior
  const respawnPlayer = () => {
    console.log("Respawning player"); // Debug log
    api.position.set(...START_POSITION);
    api.velocity.set(0, 0, 0);
    api.mass.set(1); // Ensure mass is set after respawn
    isGrounded.current = false;
  };

  // Start countdown when name is set
  useEffect(() => {
    if (playerName && !countdownStarted.current) {
      countdownStarted.current = true;
      setCountdown(3);
      
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownInterval);
            api.mass.set(1);
            gameStarted.current = true;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Keep ball static at start
      api.mass.set(0);
      api.position.set(...START_POSITION);
      api.velocity.set(0, 0, 0);

      return () => clearInterval(countdownInterval);
    }
  }, [playerName, api]);

  // Subscribe to physics updates
  useEffect(() => {
    const unsubscribeVelocity = api.velocity.subscribe((v) => (velocity.current = v));
    const unsubscribePosition = api.position.subscribe((p) => (position.current = p));
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        respawnPlayer();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      unsubscribeVelocity();
      unsubscribePosition();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [api.velocity, api.position]);

  // Handle keyboard controls
  const [, get] = useKeyboardControls();

  useFrame(() => {
    if (!gameStarted.current) return;

    const { forward, backward, leftward, rightward, jump } = get();
    
    // Check if player fell off
    if (position.current[1] <= RESPAWN_HEIGHT) {
      console.log("Player fell below respawn height");
      respawnPlayer();
      return;
    }

    // Calculate movement direction
    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3(0, 0, Number(forward) - Number(backward));
    const sideVector = new THREE.Vector3(Number(leftward) - Number(rightward), 0, 0);
    
    direction
      .addVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(MOVE_SPEED);

    // Apply movement
    api.velocity.set(direction.x, velocity.current[1], direction.z);

    // Update grounded state
    isGrounded.current = Math.abs(velocity.current[1]) < 0.1;

    // Simpler jump logic - just check if grounded and jump is pressed
    if (jump && isGrounded.current) {
      api.velocity.set(velocity.current[0], JUMP_FORCE, velocity.current[2]);
    }
  });

  return (
    <>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="hotpink"
          roughness={0.3}
          metalness={0.2}
        />
        {playerName && (
          <Html
            position={[0, BALL_RADIUS + 0.5, 0]}
            center
            style={{
              background: 'rgba(0,0,0,0.8)',
              padding: '2px 8px',
              borderRadius: '4px',
              color: 'white',
              fontSize: '14px',
              pointerEvents: 'none',
            }}
          >
            {playerName}
          </Html>
        )}
      </mesh>
      {countdown !== null && countdown > 0 && (
        <Html
          position={[0, 2, 0]}
          center
          style={{
            background: 'rgba(0,0,0,0.8)',
            padding: '20px 40px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '32px',
            fontWeight: 'bold',
            pointerEvents: 'none',
          }}
        >
          {countdown}
        </Html>
      )}
    </>
  );
}); 