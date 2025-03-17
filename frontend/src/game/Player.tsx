import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSphere } from '@react-three/cannon';
import { useKeyboardControls, Html } from '@react-three/drei';
import * as THREE from 'three';

const JUMP_FORCE = 7.5;
const MOVE_SPEED = 4;
const BALL_RADIUS = 0.4;
const RESPAWN_HEIGHT = -1;
const START_POSITION: [number, number, number] = [0, 10.5, -28];
const ROTATION_SPEED = 15; // Speed multiplier for ball rotation

interface PlayerProps {
  playerName?: string;
}

export interface PlayerRef {
  respawn: () => void;
  getPosition: () => THREE.Vector3;
}

const BALL_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: '#FF1493', // Deep pink
  metalness: 0.9,
  roughness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  reflectivity: 1.0,
  envMapIntensity: 1.0,
});

// Trail effect for the ball
const BallTrail = ({ position }: { position: THREE.Vector3 }) => {
  return (
    <mesh position={position}>
      <sphereGeometry args={[BALL_RADIUS * 1.2, 32, 32]} />
      <meshBasicMaterial color="#FF69B4" transparent opacity={0.2} />
    </mesh>
  );
};

export const Player = forwardRef<PlayerRef, PlayerProps>(({ playerName }, ref) => {
  const [meshRef, api] = useSphere<THREE.Mesh>(() => ({
    mass: 1,
    type: 'Dynamic',
    position: START_POSITION,
    args: [BALL_RADIUS],
    material: {
      friction: 0.5,
      restitution: 0.3,
    },
    linearDamping: 0.7,
    angularDamping: 0.2,
    allowSleep: false,
  }));

  const velocity = useRef<[number, number, number]>([0, 0, 0]);
  const position = useRef<[number, number, number]>(START_POSITION);
  const rotation = useRef<THREE.Euler>(new THREE.Euler());
  const isGrounded = useRef(false);
  const gameStarted = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownStarted = useRef(false);
  const trailPositions = useRef<THREE.Vector3[]>([]);
  const previousPosition = useRef<THREE.Vector3>(new THREE.Vector3());

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    respawn: respawnPlayer,
    getPosition: () => new THREE.Vector3(...position.current),
  }));

  // Helper function for consistent respawn behavior
  const respawnPlayer = () => {
    console.log("Respawning player at start position"); // Debug log
    api.position.set(...START_POSITION);
    api.velocity.set(0, 0, 0);
    api.mass.set(1);
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
            gameStarted.current = true;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Keep ball at start position but maintain physics
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
    if (!gameStarted.current || !meshRef.current) return;

    // Update trail positions
    const currentPos = meshRef.current.position.clone();
    trailPositions.current.unshift(currentPos);
    if (trailPositions.current.length > 5) {
      trailPositions.current.pop();
    }

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

    // Calculate rotation based on movement
    if (meshRef.current && (direction.x !== 0 || direction.z !== 0)) {
      const movement = new THREE.Vector3(
        currentPos.x - previousPosition.current.x,
        0,
        currentPos.z - previousPosition.current.z
      );
      
      // Calculate rotation axis perpendicular to movement
      const rotationAxis = new THREE.Vector3(-movement.z, 0, movement.x).normalize();
      const distance = movement.length();
      
      // Apply rotation based on movement distance
      meshRef.current.rotateOnAxis(
        rotationAxis,
        distance * ROTATION_SPEED
      );
    }

    // Update previous position
    previousPosition.current.copy(currentPos);

    // Update grounded state
    isGrounded.current = Math.abs(velocity.current[1]) < 0.1;

    // Jump logic
    if (jump && isGrounded.current) {
      api.velocity.set(velocity.current[0], JUMP_FORCE, velocity.current[2]);
    }
  });

  return (
    <>
      {/* Ball trails */}
      {trailPositions.current.map((pos, index) => (
        <BallTrail
          key={index}
          position={pos}
        />
      ))}
      
      {/* Main ball */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <primitive object={BALL_MATERIAL} attach="material" />
        
        {/* Inner glow */}
        <mesh scale={[0.8, 0.8, 0.8]}>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshBasicMaterial color="#FF69B4" transparent opacity={0.3} />
        </mesh>
        
        {/* Outer glow */}
        <mesh scale={[1.1, 1.1, 1.1]}>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshBasicMaterial color="#FF1493" transparent opacity={0.1} />
        </mesh>
      </mesh>

      {/* Player name with enhanced styling */}
      {playerName && (
        <Html
          position={[0, BALL_RADIUS * 2.5, 0]}
          center
          occlude={[meshRef]}
          style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(255,20,147,0.8)',
            pointerEvents: 'none',
            transform: 'none !important', // Prevent rotation
            userSelect: 'none',
          }}
        >
          {playerName}
        </Html>
      )}

      {/* Enhanced countdown display */}
      {countdown !== null && countdown > 0 && (
        <Html
          position={[0, 2, 0]}
          center
          style={{
            background: 'linear-gradient(45deg, rgba(0,0,0,0.9), rgba(255,20,147,0.6))',
            padding: '30px 50px',
            borderRadius: '20px',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
            textShadow: '0 0 20px rgba(255,20,147,0.8)',
            pointerEvents: 'none',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.1)',
            boxShadow: '0 0 30px rgba(255,20,147,0.3)',
          }}
        >
          {countdown}
        </Html>
      )}
    </>
  );
}); 