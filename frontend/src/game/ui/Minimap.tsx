import React, { useRef, useEffect } from 'react';
import { LightCycle } from '../core/LightCycle';
import * as THREE from 'three';

interface MinimapProps {
    // Original format with player objects
    players?: Map<string, LightCycle>;
    localPlayer?: LightCycle;
    
    // New simplified format using positions
    playerPosition?: { x: number; y: number; z: number };
    enemyPositions?: { id: string; position: { x: number; z: number } }[];
    trailPoints?: { x: number; z: number }[];
    
    // Common props
    arenaSize: number;
}

// Utility function to convert world coordinates to canvas coordinates
function worldToCanvas(point: { x: number; z?: number; y?: number }, canvasSize: number, arenaSize: number): { x: number; y: number } {
    const z = 'z' in point ? point.z : point.y;
    return {
        x: (point.x + arenaSize / 2) * (canvasSize / arenaSize),
        y: (z! + arenaSize / 2) * (canvasSize / arenaSize)
    };
}

export const Minimap: React.FC<MinimapProps> = ({ 
    players, 
    localPlayer, 
    playerPosition, 
    enemyPositions, 
    trailPoints, 
    arenaSize
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            // Clear canvas
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw grid
            ctx.strokeStyle = 'rgba(30, 30, 30, 0.5)';
            ctx.lineWidth = 1;
            
            const gridSize = arenaSize / 20;
            for (let x = 0; x <= canvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y <= canvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Handle original format (with LightCycle objects)
            if (players && localPlayer) {
                // Draw local player's trail
                const localTrail = localPlayer.getTrailPoints();
                if (localTrail.length > 0) {
                    ctx.beginPath();
                    ctx.strokeStyle = `#${localPlayer.getBikeColor().toString(16).padStart(6, '0')}`;
                    ctx.lineWidth = 2;
                    
                    const firstPoint = worldToCanvas(localTrail[0], canvas.width, arenaSize);
                    ctx.moveTo(firstPoint.x, firstPoint.y);
                    
                    for (let i = 1; i < localTrail.length; i++) {
                        const point = worldToCanvas(localTrail[i], canvas.width, arenaSize);
                        ctx.lineTo(point.x, point.y);
                    }
                    ctx.stroke();
                }

                // Draw other players and their trails
                players.forEach((player, id) => {
                    if (player === localPlayer) return;

                    const trail = player.getTrailPoints();
                    if (trail.length > 0) {
                        ctx.beginPath();
                        ctx.strokeStyle = `#${player.getBikeColor().toString(16).padStart(6, '0')}`;
                        ctx.lineWidth = 2;
                        
                        const firstPoint = worldToCanvas(trail[0], canvas.width, arenaSize);
                        ctx.moveTo(firstPoint.x, firstPoint.y);
                        
                        for (let i = 1; i < trail.length; i++) {
                            const point = worldToCanvas(trail[i], canvas.width, arenaSize);
                            ctx.lineTo(point.x, point.y);
                        }
                        ctx.stroke();
                    }

                    // Draw player position
                    const pos = player.getPosition();
                    const canvasPos = worldToCanvas(pos, canvas.width, arenaSize);
                    
                    ctx.beginPath();
                    ctx.fillStyle = `#${player.getBikeColor().toString(16).padStart(6, '0')}`;
                    ctx.arc(canvasPos.x, canvasPos.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                });

                // Draw local player position
                const localPos = localPlayer.getPosition();
                const canvasPos = worldToCanvas(localPos, canvas.width, arenaSize);
                
                ctx.beginPath();
                ctx.fillStyle = `#${localPlayer.getBikeColor().toString(16).padStart(6, '0')}`;
                ctx.arc(canvasPos.x, canvasPos.y, 4, 0, Math.PI * 2);
                ctx.fill();
            } 
            // Handle simplified format (with position arrays)
            else if (playerPosition) {
                // Draw player position
                const canvasPos = worldToCanvas(playerPosition, canvas.width, arenaSize);
                ctx.beginPath();
                ctx.fillStyle = '#0fbef2'; // Default blue for player
                ctx.arc(canvasPos.x, canvasPos.y, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw player trail
                if (trailPoints && trailPoints.length > 0) {
                    ctx.beginPath();
                    ctx.strokeStyle = '#0fbef2'; // Default blue for player trail
                    ctx.lineWidth = 2;
                    
                    const firstPoint = worldToCanvas(trailPoints[0], canvas.width, arenaSize);
                    ctx.moveTo(firstPoint.x, firstPoint.y);
                    
                    for (let i = 1; i < trailPoints.length; i++) {
                        const point = worldToCanvas(trailPoints[i], canvas.width, arenaSize);
                        ctx.lineTo(point.x, point.y);
                    }
                    ctx.stroke();
                }
                
                // Draw enemy positions
                if (enemyPositions) {
                    enemyPositions.forEach(enemy => {
                        const canvasPos = worldToCanvas(enemy.position, canvas.width, arenaSize);
                        ctx.beginPath();
                        ctx.fillStyle = '#ff0044'; // Red for enemies
                        ctx.arc(canvasPos.x, canvasPos.y, 4, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            }

            requestAnimationFrame(draw);
        };

        draw();
    }, [players, localPlayer, playerPosition, enemyPositions, trailPoints, arenaSize]);

    return (
        <canvas
            ref={canvasRef}
            width={200}
            height={200}
            style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                border: '2px solid rgba(15, 190, 242, 0.5)',
                borderRadius: '5px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)'
            }}
        />
    );
} 