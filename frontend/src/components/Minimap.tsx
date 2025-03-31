import React, { useRef, useEffect } from 'react';
import { FpsCounter } from './FpsCounter';

interface MinimapProps {
    playerPosition: { x: number; z: number };
    arenaSize: number;
    trailPoints?: { x: number; z: number }[];
    enemyPositions?: { id: string, position: { x: number; z: number } }[];
    portalPosition?: { x: number; z: number } | null;
}

export const Minimap = ({
    playerPosition,
    arenaSize,
    trailPoints = [],
    enemyPositions = [],
    portalPosition = null
}: MinimapProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const MINIMAP_SIZE = 150;
    const PLAYER_DOT_SIZE = 4;
    const ENEMY_DOT_SIZE = 3;
    const PORTAL_DOT_SIZE = 5;
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
        const scale = MINIMAP_SIZE / arenaSize;
        const worldToMinimap = (pos: { x: number; z: number }) => ({
            x: (pos.x + arenaSize / 2) * scale,
            y: (pos.z + arenaSize / 2) * scale
        });

        // Draw boundaries
        const halfSize = arenaSize / 2;
        const boundaries = [
            { x: -halfSize, z: -halfSize },
            { x: halfSize, z: -halfSize },
            { x: halfSize, z: halfSize },
            { x: -halfSize, z: halfSize },
            { x: -halfSize, z: -halfSize }
        ];

        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
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

        // Draw enemy positions
        if (enemyPositions.length > 0) {
            ctx.fillStyle = '#ff3333';
            enemyPositions.forEach(enemy => {
                if (Math.abs(enemy.position.x) < 1 && Math.abs(enemy.position.z) < 1) {
                    return;
                }
                const enemyPos = worldToMinimap(enemy.position);
                ctx.beginPath();
                ctx.arc(enemyPos.x, enemyPos.y, ENEMY_DOT_SIZE, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw portal position
        if (portalPosition) {
            const portalPosMinimap = worldToMinimap(portalPosition);
            ctx.fillStyle = '#00ffff'; // Cyan color for portal
            ctx.strokeStyle = '#ffffff'; // White border
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(portalPosMinimap.x, portalPosMinimap.y, PORTAL_DOT_SIZE, 0, Math.PI * 2);
            ctx.fill();
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
        ctx.fillText(`Enemies: ${enemyPositions.length}`, 5, 30);

    }, [playerPosition, arenaSize, trailPoints, enemyPositions, portalPosition]);

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