import { create } from 'zustand';
import { GameState, Player } from '../network/gameClient';

interface GameStore {
  gameState: GameState | null;
  localPlayer: Player | null;
  setGameState: (state: GameState) => void;
  setLocalPlayer: (player: Player) => void;
  updatePlayerPosition: (playerId: string, position: { x: number; y: number; z: number }) => void;
  eliminatePlayer: (playerId: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  localPlayer: null,
  
  setGameState: (state) => set({ gameState: state }),
  
  setLocalPlayer: (player) => set({ localPlayer: player }),
  
  updatePlayerPosition: (playerId, position) =>
    set((state) => {
      if (!state.gameState) return state;
      
      const updatedPlayers = { ...state.gameState.players };
      if (updatedPlayers[playerId]) {
        updatedPlayers[playerId] = {
          ...updatedPlayers[playerId],
          position,
        };
      }
      
      return {
        gameState: {
          ...state.gameState,
          players: updatedPlayers,
        },
      };
    }),
    
  eliminatePlayer: (playerId) =>
    set((state) => {
      if (!state.gameState) return state;
      
      const updatedPlayers = { ...state.gameState.players };
      if (updatedPlayers[playerId]) {
        updatedPlayers[playerId] = {
          ...updatedPlayers[playerId],
          is_eliminated: true,
        };
      }
      
      return {
        gameState: {
          ...state.gameState,
          players: updatedPlayers,
          eliminated_players: [...state.gameState.eliminated_players, playerId],
        },
      };
    }),
    
  reset: () => set({ gameState: null, localPlayer: null }),
})); 