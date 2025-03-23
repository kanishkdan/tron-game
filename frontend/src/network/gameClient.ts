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
    rotation?: number;
  } | null;
  is_eliminated: boolean;
  score: number;
};

export type GameEvent = {
  type: 'game_state' | 'player_joined' | 'player_left' | 'player_moved' | 'player_eliminated';
  data: any;
};

export class GameClient {
  private socket: WebSocket | null = null;
  private playerId: string | null = null;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number = 1000; // Start with 1 second
  private sessionStorageKey = 'tron_game_player_session';
  private serverUrl: string;

  constructor(serverUrl?: string) {
    // Use provided server URL, environment variable, or fallback to local development
    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else if (import.meta.env.VITE_WS_URL) {
      // Remove trailing slash if present
      this.serverUrl = import.meta.env.VITE_WS_URL.replace(/\/$/, '');
    } else if (import.meta.env.VITE_API_URL) {
      // Convert HTTP(S) URL to WebSocket URL
      const apiUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
      this.serverUrl = apiUrl.replace(/^http/, 'ws');
    } else {
      // In development, use localhost
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = '8000'; // Backend port
      this.serverUrl = `${protocol}//${host}:${port}`;
    }
    console.log(`Using WebSocket server URL: ${this.serverUrl}`);
  }

  connect(playerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check for existing player ID in session storage
        const storedPlayerId = localStorage.getItem(this.sessionStorageKey);
        
        // Use stored ID or generate a new one with the player name
        this.playerId = storedPlayerId || `${playerName}-${this.generateSessionId()}`;
        
        // Store the player ID for future sessions
        localStorage.setItem(this.sessionStorageKey, this.playerId);
        
        console.log(`Connecting with player ID: ${this.playerId}`);
        
        this.socket = new WebSocket(`${this.serverUrl}/ws/${this.playerId}`);

        this.socket.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectTimeout = 1000;
          resolve();
        };

        this.socket.onclose = (event) => {
          console.log('WebSocket closed:', event);
          this.handleDisconnect();
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleGameEvent(message);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate a random session ID
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 12);
  }

  // Clear session (useful for testing)
  clearSession(): void {
    localStorage.removeItem(this.sessionStorageKey);
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.playerId) {
      console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.reconnectAttempts++;
        const playerName = this.playerId?.split('-')[0];
        if (playerName) {
          this.connect(playerName).catch(() => {
            // Exponential backoff
            this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, 10000);
          });
        }
      }, this.reconnectTimeout);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.playerId = null;
    }
  }

  getPlayerId(): string | null {
    return this.playerId;
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

  updatePosition(position: { x: number; y: number; z: number; rotation?: number }) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.playerId) {
      this.socket.send(JSON.stringify({
        type: 'player_move',
        data: {
          player_id: this.playerId,
          position
        }
      }));
    }
  }

  private handleGameEvent(event: GameEvent) {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event.data));
    }
  }
} 