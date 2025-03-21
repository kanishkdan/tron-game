import React, { useEffect, useState } from 'react';
import { PerformanceManager } from '../game/core/PerformanceManager';

export const FpsCounter = () => {
    const [fps, setFps] = useState(0);
    const [frames, setFrames] = useState(0);
    const [lastTime, setLastTime] = useState(performance.now());
    const [resScale, setResScale] = useState(100);

    useEffect(() => {
        let animationFrameId: number;

        const updateFps = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;

            if (deltaTime >= 1000) {
                setFps(Math.round((frames * 1000) / deltaTime));
                setFrames(0);
                setLastTime(currentTime);
                
                // Update resolution scale from performance manager
                const manager = PerformanceManager.getInstance();
                setResScale(Math.round(manager.getResolutionScale() * 100));
            }

            setFrames(prev => prev + 1);
            animationFrameId = requestAnimationFrame(updateFps);
        };

        animationFrameId = requestAnimationFrame(updateFps);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [frames, lastTime]);

    // Color coding based on performance
    const getFpsColor = () => {
        if (fps >= 55) return '#4CAF50'; // Green for good FPS
        if (fps >= 30) return '#FF9800'; // Orange for acceptable FPS
        return '#F44336'; // Red for poor FPS
    };

    return (
        <div style={{
            position: 'absolute',
            top: '190px', // Position below minimap (150px + 20px padding + 20px gap)
            right: '20px',
            padding: '5px 10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: '2px solid #0fbef2',
            borderRadius: '5px',
            color: '#0fbef2',
            fontFamily: 'monospace',
            fontSize: '14px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                <span>FPS:</span>
                <span style={{ color: getFpsColor() }}>{fps}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                <span>RES:</span>
                <span>{resScale}%</span>
            </div>
        </div>
    );
}; 