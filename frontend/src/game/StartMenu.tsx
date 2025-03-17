import { useState } from 'react';
import styled from 'styled-components';

const MenuOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const MenuContainer = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  max-width: 400px;
  width: 90%;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 1.5rem;
  font-family: Arial, sans-serif;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.8rem;
  margin-bottom: 1rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  &:focus {
    border-color: #4CAF50;
    outline: none;
  }
`;

const StartButton = styled.button`
  background: #4CAF50;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 4px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: #45a049;
  }
`;

interface StartMenuProps {
  onStart: (playerName: string) => void;
}

const StartMenu = ({ onStart }: StartMenuProps) => {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onStart(playerName.trim());
    }
  };

  return (
    <MenuOverlay>
      <MenuContainer>
        <Title>Girgaya</Title>
        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            required
          />
          <StartButton type="submit">Start Game</StartButton>
        </form>
      </MenuContainer>
    </MenuOverlay>
  );
};

export default StartMenu; 