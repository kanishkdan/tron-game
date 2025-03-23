import React, { useState, useEffect } from 'react';
import { TrailActivationEvent } from '../game/core/TronGame';

interface TrailActivationDisplayProps {
  trailActivationEvents: Map<string, number>;
}

export const TrailActivationDisplay: React.FC<TrailActivationDisplayProps> = ({ 
  trailActivationEvents 
}) => {
  // Filter out completed activations (0 seconds remaining)
  const activeCountdowns = Array.from(trailActivationEvents.entries())
    .filter(([_, seconds]) => seconds > 0);
  
  if (activeCountdowns.length === 0) {
    return null;
  }
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '10px',
        padding: '15px',
        color: '#0fbef2',
        textAlign: 'center',
        fontFamily: 'monospace',
        zIndex: 1000,
        display: activeCountdowns.length > 0 ? 'block' : 'none',
        boxShadow: '0 0 20px rgba(15, 190, 242, 0.5)',
        border: '2px solid #0fbef2'
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
        Light Trail Activation
      </h3>
      
      {activeCountdowns.map(([playerId, seconds]) => (
        <div key={playerId} style={{ marginBottom: '5px' }}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: seconds <= 3 ? '#ff0044' : '#0fbef2'
          }}>
            {seconds}
          </div>
        </div>
      ))}
    </div>
  );
}; 