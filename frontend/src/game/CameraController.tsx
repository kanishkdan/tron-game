import { useThree, useFrame } from '@react-three/fiber';
import { useRef, MutableRefObject } from 'react';
import * as THREE from 'three';
import { PlayerRef } from './Player';

interface CameraControllerProps {
  target: MutableRefObject<PlayerRef | null>;
}

export const CameraController = ({ target }: CameraControllerProps) => {
  const { camera } = useThree();
  const offset = useRef(new THREE.Vector3(0, 5, -10));
  const smoothedPosition = useRef(new THREE.Vector3());
  const smoothedLookAt = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!target.current) return;

    const playerPosition = target.current.getPosition();
    if (!playerPosition) return;

    // Calculate desired camera position
    const desiredPosition = playerPosition.clone().add(offset.current);
    
    // Smooth camera movement
    smoothedPosition.current.lerp(desiredPosition, 0.1);
    smoothedLookAt.current.lerp(playerPosition, 0.1);

    // Update camera
    camera.position.copy(smoothedPosition.current);
    camera.lookAt(smoothedLookAt.current);
  });

  return null;
}; 