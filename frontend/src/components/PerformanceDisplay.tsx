import React, { useState, useEffect } from 'react';
import { PerformanceManager } from '../game/core/PerformanceManager';

/**
 * Component that displays current FPS and resolution scale in the corner of the screen
 */
export const PerformanceDisplay: React.FC = () => {
    const [fps, setFps] = useState(60);
    const [resScale, setResScale] = useState(100);
    const [visible, setVisible] = useState(true);
    
    useEffect(() => {
        // Update stats every 500ms
        const interval = setInterval(() => {
            const manager = PerformanceManager.getInstance();
            setFps(manager.getCurrentFps());
            setResScale(Math.round(manager.getResolutionScale() * 100));
        }, 500);
        
        return () => clearInterval(interval);
    }, []);
    
    // Toggle visibility when clicking the display
    const toggleVisibility = () => {
        setVisible(!visible);
    };
    
    // Color coding based on performance
    const getFpsColor = () => {
        if (fps >= 55) return '#4CAF50'; // Green for good FPS
        if (fps >= 30) return '#FF9800'; // Orange for acceptable FPS
        return '#F44336'; // Red for poor FPS
    };
    
    if (!visible) {
        return (
            <div 
                onClick={toggleVisibility}
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    color: 'white',
                    fontSize: '12px',
                    cursor: 'pointer',
                    zIndex: 1000
                }}
            >
                Show Stats
            </div>
        );
    }
    
    return (
        <div 
            onClick={toggleVisibility}
            style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '10px 15px',
                borderRadius: '5px',
                color: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span>FPS:</span>
                <span style={{ color: getFpsColor(), fontWeight: 'bold' }}>{fps}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <span>Resolution:</span>
                <span>{resScale}%</span>
            </div>
        </div>
    );
}; 