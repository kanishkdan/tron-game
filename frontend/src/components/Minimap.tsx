import React, { useRef, useEffect } from 'react';
import { FpsCounter } from './FpsCounter';

interface MinimapProps {
    playerPosition: { x: number; z: number };
    arenaSize: number;
    trailPoints?: { x: number; z: number }[];
}

export const Minimap = ({ playerPosition, arenaSize, trailPoints = [] }: MinimapProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const MINIMAP_SIZE = 150;
    const PLAYER_DOT_SIZE = 4;
    const TRAIL_WIDTH = 2;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Draw border
        ctx.strokeStyle = '#0fbef2';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Convert world coordinates to minimap coordinates
        // This scaling factor is critical - need to use the actual arena size
        const scale = MINIMAP_SIZE / arenaSize;
        const worldToMinimap = (pos: { x: number; z: number }) => ({
            x: (pos.x + arenaSize / 2) * scale,
            y: (pos.z + arenaSize / 2) * scale
        });

        // Draw boundaries - this helps visualize the actual play area
        const halfSize = arenaSize / 2;
        const boundaries = [
            { x: -halfSize, z: -halfSize }, // Bottom-left
            { x: halfSize, z: -halfSize },  // Bottom-right
            { x: halfSize, z: halfSize },   // Top-right
            { x: -halfSize, z: halfSize },  // Top-left
            { x: -halfSize, z: -halfSize }  // Back to start
        ];

        // Draw boundary
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000'; // Red to distinguish from trail
        ctx.lineWidth = 1;
        
        const startBoundary = worldToMinimap(boundaries[0]);
        ctx.moveTo(startBoundary.x, startBoundary.y);
        
        for (let i = 1; i < boundaries.length; i++) {
            const point = worldToMinimap(boundaries[i]);
            ctx.lineTo(point.x, point.y);
        }
        
        ctx.stroke();

        // Draw trail
        if (trailPoints.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#0fbef2';
            ctx.lineWidth = TRAIL_WIDTH;
            
            const startPoint = worldToMinimap(trailPoints[0]);
            ctx.moveTo(startPoint.x, startPoint.y);
            
            for (let i = 1; i < trailPoints.length; i++) {
                const point = worldToMinimap(trailPoints[i]);
                ctx.lineTo(point.x, point.y);
            }
            
            ctx.stroke();
        }

        // Draw player position
        const minimapPos = worldToMinimap(playerPosition);
        ctx.fillStyle = '#0fbef2';
        ctx.beginPath();
        ctx.arc(minimapPos.x, minimapPos.y, PLAYER_DOT_SIZE, 0, Math.PI * 2);
        ctx.fill();

        // Add debug info
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px Arial';
        ctx.fillText(`Arena: ${arenaSize}x${arenaSize}`, 5, 10);
        ctx.fillText(`Player: ${Math.round(playerPosition.x)},${Math.round(playerPosition.z)}`, 5, 20);

    }, [playerPosition, arenaSize, trailPoints]);

    return (
        <>
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                border: '2px solid #0fbef2',
                borderRadius: '5px',
                padding: '5px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
            }}>
                <canvas
                    ref={canvasRef}
                    width={MINIMAP_SIZE}
                    height={MINIMAP_SIZE}
                    style={{ display: 'block' }}
                />
            </div>
            <FpsCounter />
        </>
    );
}; 