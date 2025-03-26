import React, { useState, useEffect } from 'react';

type KillMessage = {
    killer: string;
    victim: string;
    timestamp: number;
};

interface KillFeedProps {
    messages: KillMessage[];
}

export const KillFeed: React.FC<KillFeedProps> = ({ messages }) => {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            maxWidth: '300px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '5px',
            padding: '10px',
            color: '#fff',
            fontFamily: 'monospace',
            zIndex: 1000,
        }}>
            {messages.map((msg, index) => (
                <div
                    key={`${msg.timestamp}-${index}`}
                    style={{
                        marginBottom: '5px',
                        fontSize: '14px',
                        opacity: Math.max(0, 1 - (Date.now() - msg.timestamp) / 5000), // Fade out over 5 seconds
                    }}
                >
                    <span style={{ color: '#ff0066' }}>{msg.killer}</span>
                    {msg.killer === "Arena" ? " eliminated " : " killed "}
                    <span style={{ color: '#00ff66' }}>{msg.victim}</span>
                </div>
            ))}
        </div>
    );
}; 