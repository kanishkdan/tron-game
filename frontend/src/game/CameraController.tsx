import { useThree, useFrame } from '@react-three/fiber';
import { useRef, MutableRefObject, useEffect } from 'react';
import * as THREE from 'three';
import { PlayerRef } from './Player';

interface CameraControllerProps {
  target: MutableRefObject<PlayerRef | null>;
}

export const CameraController = ({ target }: CameraControllerProps) => {
  const { camera, gl } = useThree();
  const offset = useRef(new THREE.Vector3(0, 5, -10));
  const smoothedPosition = useRef(new THREE.Vector3());
  const smoothedLookAt = useRef(new THREE.Vector3());
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const cameraRotation = useRef(new THREE.Euler(0, 0, 0));
  const targetRotation = useRef(new THREE.Euler(0, 0, 0));

  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      targetRotation.current.y -= deltaX * 0.005;
      targetRotation.current.x = THREE.MathUtils.clamp(
        targetRotation.current.x - deltaY * 0.005,
        -Math.PI / 4, // Limit vertical rotation
        Math.PI / 4
      );

      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    // Add touch support
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.current.y;

      targetRotation.current.y -= deltaX * 0.005;
      targetRotation.current.x = THREE.MathUtils.clamp(
        targetRotation.current.x - deltaY * 0.005,
        -Math.PI / 4,
        Math.PI / 4
      );

      previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [gl]);

  useFrame(() => {
    if (!target.current) return;

    const playerPosition = target.current.getPosition();
    if (!playerPosition) return;

    // Smoothly interpolate camera rotation
    cameraRotation.current.x = THREE.MathUtils.lerp(
      cameraRotation.current.x,
      targetRotation.current.x,
      0.1
    );
    cameraRotation.current.y = THREE.MathUtils.lerp(
      cameraRotation.current.y,
      targetRotation.current.y,
      0.1
    );

    // Calculate rotated offset
    const rotatedOffset = offset.current.clone()
      .applyEuler(new THREE.Euler(cameraRotation.current.x, cameraRotation.current.y, 0));

    // Calculate desired camera position
    const desiredPosition = playerPosition.clone().add(rotatedOffset);
    
    // Smooth camera movement
    smoothedPosition.current.lerp(desiredPosition, 0.1);
    smoothedLookAt.current.lerp(playerPosition, 0.1);

    // Update camera
    camera.position.copy(smoothedPosition.current);
    camera.lookAt(smoothedLookAt.current);
  });

  return null;
}; 