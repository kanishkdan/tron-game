import { useRef, useMemo } from 'react';
import { extend, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Water } from 'three/examples/jsm/objects/Water';
import * as THREE from 'three';

extend({ Water });

interface OceanProps {
  onCollision?: () => void;
}

export const Ocean = ({ onCollision }: OceanProps) => {
  const ref = useRef<Water>(null);
  const { scene } = useThree();
  
  // Create water parameters
  const waterGeometry = useMemo(() => new THREE.PlaneGeometry(10000, 10000), []);
  
  // Create water material parameters
  const waterOptions = useMemo(() => ({
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x0064b5,
    distortionScale: 3.7,
    fog: scene.fog !== undefined
  }), [scene.fog]);

  // Create water mesh
  const water = useMemo(() => {
    const waterMesh = new Water(waterGeometry, waterOptions);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -2; // Position below the course
    return waterMesh;
  }, [waterGeometry, waterOptions]);

  // Animate water
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.material.uniforms.time.value += delta;
    }
  });

  return <primitive object={water} ref={ref} />;
}; 