import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const ControlsContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  gap: 20px;
  z-index: 1000;
  pointer-events: none;
`;

const JumpButtonContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  pointer-events: none;
`;

const ControlButton = styled.button<{ isActive?: boolean }>`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${props => props.isActive ? 'rgba(15, 190, 242, 0.3)' : 'rgba(15, 190, 242, 0.1)'};
  border: 2px solid #0fbef2;
  color: #0fbef2;
  font-size: 24px;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(15, 190, 242, 0.2);

  &:active {
    background: rgba(15, 190, 242, 0.4);
    transform: scale(0.95);
  }

  @media (min-width: 768px) {
    display: none;
  }
`;

const JumpButton = styled(ControlButton)`
  background: ${props => props.isActive ? 'rgba(255, 0, 68, 0.3)' : 'rgba(255, 0, 68, 0.1)'};
  border-color: #ff0044;
  color: #ff0044;
  box-shadow: 0 0 10px rgba(255, 0, 68, 0.2);

  &:active {
    background: rgba(255, 0, 68, 0.4);
  }
`;

interface MobileControlsProps {
  onLeftPress: () => void;
  onRightPress: () => void;
  onLeftRelease: () => void;
  onRightRelease: () => void;
  onJumpPress: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onLeftPress,
  onRightPress,
  onLeftRelease,
  onRightRelease,
  onJumpPress
}) => {
  const [isLeftPressed, setIsLeftPressed] = useState(false);
  const [isRightPressed, setIsRightPressed] = useState(false);
  const [isJumpPressed, setIsJumpPressed] = useState(false);

  const handleLeftPress = () => {
    setIsLeftPressed(true);
    onLeftPress();
  };

  const handleRightPress = () => {
    setIsRightPressed(true);
    onRightPress();
  };

  const handleLeftRelease = () => {
    setIsLeftPressed(false);
    onLeftRelease();
  };

  const handleRightRelease = () => {
    setIsRightPressed(false);
    onRightRelease();
  };

  const handleJumpPress = () => {
    setIsJumpPressed(true);
    onJumpPress();
  };

  // Handle touch events for better mobile support
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      
      if (target?.closest('[data-control="left"]')) {
        handleLeftPress();
      } else if (target?.closest('[data-control="right"]')) {
        handleRightPress();
      } else if (target?.closest('[data-control="jump"]')) {
        handleJumpPress();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      
      if (target?.closest('[data-control="left"]')) {
        handleLeftRelease();
      } else if (target?.closest('[data-control="right"]')) {
        handleRightRelease();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <>
      <ControlsContainer>
        <ControlButton
          data-control="left"
          isActive={isLeftPressed}
          onMouseDown={handleLeftPress}
          onMouseUp={handleLeftRelease}
          onMouseLeave={handleLeftRelease}
        >
          ←
        </ControlButton>
        <ControlButton
          data-control="right"
          isActive={isRightPressed}
          onMouseDown={handleRightPress}
          onMouseUp={handleRightRelease}
          onMouseLeave={handleRightRelease}
        >
          →
        </ControlButton>
      </ControlsContainer>
      <JumpButtonContainer>
        <JumpButton
          data-control="jump"
          isActive={isJumpPressed}
          onMouseDown={handleJumpPress}
          onMouseUp={() => setIsJumpPressed(false)}
          onMouseLeave={() => setIsJumpPressed(false)}
        >
          ⬆
        </JumpButton>
      </JumpButtonContainer>
    </>
  );
}; 