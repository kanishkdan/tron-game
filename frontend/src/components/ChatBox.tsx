import React, { useState, useEffect, useRef } from 'react';

type ChatMessage = {
    player_name: string;
    message: string;
    timestamp: number;
};

interface ChatBoxProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isOpen, onClose }) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);

    // Update visible messages when new messages arrive
    useEffect(() => {
        // Add new messages
        setVisibleMessages(prev => [...prev, ...messages.filter(m => 
            !prev.some(p => p.timestamp === m.timestamp)
        )]);
        
        // Set up cleanup of old messages
        const now = Date.now();
        const cleanup = setTimeout(() => {
            setVisibleMessages(prev => 
                prev.filter(m => now - m.timestamp < 4000)
            );
        }, 4000);
        
        return () => clearTimeout(cleanup);
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [visibleMessages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    // Calculate opacity based on how recent the message is
    const getMessageOpacity = (timestamp: number) => {
        const age = Date.now() - timestamp;
        // Fade out over 3 seconds starting after 1 second
        if (age < 1000) return 1;
        if (age > 4000) return 0;
        return 1 - (age - 1000) / 3000;
    };

    return (
        <>
            {/* Notification-style messages */}
            <div style={{
                position: 'fixed',
                left: '20px',
                top: '20%', 
                width: '300px',
                maxWidth: '40%',
                pointerEvents: 'none',
                zIndex: 1000,
            }}>
                {visibleMessages.map((msg, index) => {
                    const opacity = getMessageOpacity(msg.timestamp);
                    // Don't render messages that are fully faded out
                    if (opacity <= 0) return null;
                    
                    return (
                        <div
                            key={`${msg.timestamp}-${index}`}
                            style={{
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                borderLeft: '2px solid #0fbef2',
                                borderRadius: '3px',
                                padding: '8px 12px',
                                marginBottom: '8px',
                                maxWidth: '100%',
                                opacity: opacity,
                                fontSize: '14px',
                                transition: 'opacity 0.3s ease',
                                color: '#fff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            <span style={{ color: '#0fbef2', fontWeight: 'bold' }}>{msg.player_name}: </span>
                            <span>{msg.message}</span>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Input box - only shown when chat is open */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    left: '20px',
                    top: '80px',
                    zIndex: 1000,
                    width: '300px',
                    maxWidth: '40%',
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            style={{
                                width: '100%',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                border: '1px solid #0fbef2',
                                borderRadius: '3px',
                                padding: '8px 12px',
                                color: '#fff',
                                fontSize: '14px',
                                outline: 'none',
                                boxShadow: '0 0 10px rgba(15, 190, 242, 0.3)',
                            }}
                            autoComplete="off"
                        />
                    </form>
                </div>
            )}
        </>
    );
}; 