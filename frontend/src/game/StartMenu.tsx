import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 5px #0fbef2, 0 0 10px #0fbef2, 0 0 15px #0fbef2; }
  50% { box-shadow: 0 0 10px #0fbef2, 0 0 20px #0fbef2, 0 0 30px #0fbef2; }
  100% { box-shadow: 0 0 5px #0fbef2, 0 0 10px #0fbef2, 0 0 15px #0fbef2; }
`;

const scanline = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
`;

const MenuContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  font-family: 'Orbitron', sans-serif;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      transparent 0%,
      rgba(15, 190, 242, 0.1) 50%,
      transparent 100%
    );
    animation: ${scanline} 4s linear infinite;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
      circle at center,
      transparent 0%,
      rgba(0, 0, 0, 0.8) 100%
    );
    pointer-events: none;
  }
`;

const MenuContent = styled.div`
  background: rgba(0, 8, 20, 0.9);
  padding: 40px;
  border: 2px solid #0fbef2;
  border-radius: 5px;
  text-align: center;
  position: relative;
  animation: ${pulseGlow} 5s infinite;
  max-width: 400px;
  width: 90%;
  z-index: 1;

  &::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    z-index: -1;
    border-radius: 7px;
  }
`;

const Title = styled.h1`
  color: #0fbef2;
  font-size: 3em;
  margin: 0 0 30px 0;
  text-transform: uppercase;
  letter-spacing: 4px;
  text-shadow: 0 0 10px #0fbef2;
  font-family: 'Tr2n', 'Orbitron', sans-serif;
`;

const Input = styled.input`
  background: rgba(15, 190, 242, 0.1);
  border: 1px solid #0fbef2;
  color: #0fbef2;
  padding: 10px 20px;
  font-size: 1.2em;
  width: 100%;
  margin-bottom: 20px;
  outline: none;
  border-radius: 3px;
  font-family: 'Orbitron', sans-serif;

  &:focus {
    box-shadow: 0 0 10px #0fbef2;
  }

  &::placeholder {
    color: rgba(15, 190, 242, 0.5);
  }
`;

const StartButton = styled.button`
  background: transparent;
  color: #0fbef2;
  border: 2px solid #0fbef2;
  padding: 12px 30px;
  font-size: 1.2em;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: 'Orbitron', sans-serif;
  position: relative;
  overflow: hidden;

  &:hover {
    background: rgba(15, 190, 242, 0.2);
    box-shadow: 0 0 20px #0fbef2;
  }

  &:active {
    transform: scale(0.98);
  }

  &::before {
    content: '';
    position: absolute;
    top: -100%;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      transparent,
      rgba(15, 190, 242, 0.2),
      transparent
    );
    animation: ${scanline} 2s linear infinite;
  }
`;

const Instructions = styled.p`
  color: #0fbef2;
  font-size: 0.9em;
  margin: 20px 0;
  opacity: 0.8;
  line-height: 1.5;
`;

const CompetitionInfo = styled.div`
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(15, 190, 242, 0.3);
  font-size: 0.85em;
  color: rgba(15, 190, 242, 0.8);
  line-height: 1.6;
`;

const Footer = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(15, 190, 242, 0.3);
  font-size: 0.85em;
  color: rgba(15, 190, 242, 0.8);
  line-height: 1.6;
  
  a {
    color: #0fbef2;
    text-decoration: none;
    transition: all 0.3s ease;
    border-bottom: 1px solid transparent;
    padding-bottom: 2px;
    
    &:hover {
      border-bottom: 1px solid #0fbef2;
      text-shadow: 0 0 5px #0fbef2;
    }
  }
`;

const SocialLinks = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
  margin-bottom: 10px;
`;

interface StartMenuProps {
  onStart: (playerName: string) => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ onStart }) => {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onStart(playerName.trim());
    }
  };

  return (
    <MenuContainer>
      <MenuContent>
        <Title>TRON</Title>
        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter Name"
            maxLength={15}
            required
          />
          <StartButton type="submit">Enter The Grid</StartButton>
        </form>
        <Instructions>
          Use ⬅︎➡︎ or AD to control your light cycle. Press SPACEBAR to jump.<br />
          Use your light trail to eliminate opponents.<br />
        </Instructions>
        
        {/* <CompetitionInfo>
          Built for the 2025 Vibe Coding Competition<br/>
          Organised by Pieter Levels (Levelsio)<br/>
          Powered by Bolt
        </CompetitionInfo> */}
        
        <Footer>
          Made with ❤️ by <a href="https://x.com/kanishk_razdan" target="_blank" rel="noopener noreferrer">Kanishk Razdan</a>
        </Footer>
      </MenuContent>
    </MenuContainer>
  );
};

export default StartMenu; 