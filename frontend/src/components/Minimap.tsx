import React, { useRef, useEffect } from 'react';

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
        const worldToMinimap = (pos: { x: number; z: number }) => ({
            x: (pos.x + arenaSize / 2) * (MINIMAP_SIZE / arenaSize),
            y: (pos.z + arenaSize / 2) * (MINIMAP_SIZE / arenaSize)
        });

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

    }, [playerPosition, arenaSize, trailPoints]);

    return (
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
    );
}; 