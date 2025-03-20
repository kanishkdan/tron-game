import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const MinimapContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  width: 200px;
  height: 200px;
  background-color: rgba(0, 0, 0, 0.7);
  border: 2px solid #0fbef2;
  border-radius: 5px;
  overflow: hidden;
  z-index: 1000;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
`;

interface MinimapProps {
  playerPosition: { x: number; z: number };
  arenaSize: number;
}

export const Minimap: React.FC<MinimapProps> = ({ playerPosition, arenaSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set actual canvas size (for sharp rendering)
    canvas.width = 200;
    canvas.height = 200;

    // Clear the canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw arena boundary
    ctx.strokeStyle = '#0fbef2';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Calculate player position on minimap
    const scale = (canvas.width - 20) / arenaSize;
    const playerX = (playerPosition.x + arenaSize / 2) * scale + 10;
    const playerY = (playerPosition.z + arenaSize / 2) * scale + 10;

    // Draw player dot
    ctx.beginPath();
    ctx.arc(playerX, playerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0fbef2';
    ctx.fill();

    // Add glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0fbef2';
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

  }, [playerPosition, arenaSize]);

  return (
    <MinimapContainer>
      <Canvas ref={canvasRef} />
    </MinimapContainer>
  );
}; 