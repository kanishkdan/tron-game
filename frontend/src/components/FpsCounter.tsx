import React, { useEffect, useState } from 'react';

export const FpsCounter = () => {
    const [fps, setFps] = useState(0);
    const [frames, setFrames] = useState(0);
    const [lastTime, setLastTime] = useState(performance.now());

    useEffect(() => {
        let animationFrameId: number;

        const updateFps = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;

            if (deltaTime >= 1000) {
                setFps(Math.round((frames * 1000) / deltaTime));
                setFrames(0);
                setLastTime(currentTime);
            }

            setFrames(prev => prev + 1);
            animationFrameId = requestAnimationFrame(updateFps);
        };

        animationFrameId = requestAnimationFrame(updateFps);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [frames, lastTime]);

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
            textAlign: 'center'
        }}>
            FPS: {fps}
        </div>
    );
}; 