import React from 'react';
import styled, { keyframes } from 'styled-components';

const pulse = keyframes`
  0% { box-shadow: 0 0 5px #0fbef2, 0 0 10px #0fbef2; }
  50% { box-shadow: 0 0 10px #0fbef2, 0 0 20px #0fbef2; }
  100% { box-shadow: 0 0 5px #0fbef2, 0 0 10px #0fbef2; }
`;

const Container = styled.div`
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 10, 20, 0.7);
  border: 2px solid #0fbef2;
  border-radius: 5px;
  padding: 10px 20px;
  text-align: center;
  color: #0fbef2;
  font-family: 'Orbitron', sans-serif;
  animation: ${pulse} 1.5s infinite;
  z-index: 100;
  pointer-events: none;
  min-width: 200px;
`;

const Title = styled.div`
  font-size: 14px;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const CountdownValue = styled.div`
  font-size: 32px;
  font-weight: bold;
`;

interface LightTrailActivationProps {
  secondsRemaining?: number;
  localPlayerId: string;
  playerId: string;
}

export const LightTrailActivation: React.FC<LightTrailActivationProps> = ({
  secondsRemaining,
  localPlayerId,
  playerId
}) => {
  // Only show for the local player
  if (playerId !== localPlayerId || secondsRemaining === undefined) {
    return null;
  }

  return (
    <Container>
      <Title>Light Trail Activation</Title>
      <CountdownValue>{Math.ceil(secondsRemaining)}</CountdownValue>
    </Container>
  );
}; 