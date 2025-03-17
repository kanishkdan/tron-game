import { useBox } from '@react-three/cannon';

const obstacles = [
  { position: [5, 1, 0], size: [1, 2, 1] },
  { position: [-5, 1, 0], size: [1, 2, 1] },
  { position: [0, 1, 5], size: [1, 2, 1] },
  { position: [0, 1, -5], size: [1, 2, 1] },
];

const Obstacle = ({ position, size }: { position: [number, number, number]; size: [number, number, number] }) => {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    args: size,
  }));

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#ff6b6b" />
    </mesh>
  );
};

export const Obstacles = () => {
  return (
    <>
      {obstacles.map((obstacle, index) => (
        <Obstacle key={index} position={obstacle.position} size={obstacle.size} />
      ))}
    </>
  );
}; 