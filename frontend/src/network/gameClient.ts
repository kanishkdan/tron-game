import { io, Socket } from 'socket.io-client';

export type GameState = {
  players: Record<string, Player>;
  eliminated_players: string[];
  game_phase: 'waiting' | 'playing' | 'finished';
  current_round: number;
  player_count: number;
  max_players: number;
  min_players: number;
};

export type Player = {
  id: string;
  position: {
    x: number;
    y: number;
    z: number;
  } | null;
  is_eliminated: boolean;
  score: number;
};

export type GameEvent = {
  type: 'game_state' | 'player_joined' | 'player_left' | 'player_moved' | 'player_eliminated';
  data: any;
};

export class GameClient {
  private socket: Socket | null = null;
  private playerId: string | null = null;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor(private serverUrl: string = 'http://localhost:8000') {}

  connect(playerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket'],
        query: { player_id: playerId },
      });

      this.socket.on('connect', () => {
        this.playerId = playerId;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        reject(error);
      });

      this.socket.on('game_event', (event: GameEvent) => {
        this.handleGameEvent(event);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.playerId = null;
    }
  }

  on(event: string, handler: (data: any) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  off(event: string, handler: (data: any) => void) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  updatePosition(position: { x: number; y: number; z: number }) {
    if (this.socket && this.playerId) {
      this.socket.emit('player_move', {
        player_id: this.playerId,
        position,
      });
    }
  }

  private handleGameEvent(event: GameEvent) {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event.data));
    }
  }
} 