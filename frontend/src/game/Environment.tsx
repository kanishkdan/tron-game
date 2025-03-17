import { useMemo } from 'react';
import { Sky } from '@react-three/drei';
import { Ocean } from './Ocean';

export const Environment = () => {
  return (
    <>
      {/* Ocean */}
      <Ocean />

      {/* Sky */}
      <Sky
        distance={450000}
        sunPosition={[0, 1, 0]}
        inclination={0.6}
        azimuth={0.1}
      />

      {/* Ambient light */}
      <ambientLight intensity={0.5} />
      
      {/* Directional light (sun) */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
    </>
  );
}; 