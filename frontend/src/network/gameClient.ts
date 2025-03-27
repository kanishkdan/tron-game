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
  private lastConnectTime: number = 0;

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
    console.log(`[DEBUG] GameClient.connect called for player ${playerName}`);
    
    // Check if already connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(`[DEBUG] Already connected with ID ${this.playerId}, reusing connection`);
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Check for existing player ID in session storage
        const storedPlayerId = localStorage.getItem(this.sessionStorageKey);
        
        // Use stored ID or generate a new one with the player name
        this.playerId = storedPlayerId || `${playerName}-${this.generateSessionId()}`;
        
        // Store the player ID for future sessions
        localStorage.setItem(this.sessionStorageKey, this.playerId);
        
        console.log(`[DEBUG] Connecting with player ID: ${this.playerId}, stored ID was: ${storedPlayerId || 'none'}`);
        
        this.socket = new WebSocket(`${this.serverUrl}/ws/${this.playerId}`);

        this.socket.onopen = () => {
          console.log('[DEBUG] WebSocket connection established successfully');
          this.reconnectAttempts = 0;
          this.reconnectTimeout = 1000;
          this.lastConnectTime = performance.now();
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

  handleDisconnect() {
    try {
      const playerId = this.playerId;
      console.log(`[DEBUG] Handling disconnect for player ${playerId}, attempts: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.socket = null;

      // Don't attempt to reconnect if we've reached the maximum attempts or just connected
      const timeSinceLastConnect = performance.now() - this.lastConnectTime;
      
      // If we disconnected very shortly after connecting, likely a server issue
      if (timeSinceLastConnect < 1000) {
        console.log(`[DEBUG] Disconnected shortly after connecting (${Math.round(timeSinceLastConnect)}ms). Waiting longer before reconnect.`);
        // First wait a bit longer to let server stabilize
        setTimeout(() => {
          if (this.playerId) {
            this.reconnect();
          }
        }, 2000);
        return;
      }

      // For other cases, use regular exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.playerId) {
        // Exponential backoff: increase timeout for each attempt
        const timeout = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectTimeout = Math.min(timeout, 10000); // Cap at 10 seconds
        this.reconnectAttempts++;
        
        console.log(`[DEBUG] Reconnecting attempt ${this.reconnectAttempts} in ${this.reconnectTimeout}ms`);
        
        setTimeout(() => {
          if (this.playerId) {
            this.reconnect();
          }
        }, this.reconnectTimeout);
      } else {
        console.log(`[DEBUG] Maximum reconnect attempts reached or no player ID. Giving up.`);
        // Trigger disconnect event to clean up any ghost bikes
        if (playerId) {
          this.dispatchEvent('player_left', { player_id: playerId });
        }
      }
    } catch (error) {
      console.error("Error in handleDisconnect:", error);
    }
  }

  private reconnect() {
    if (!this.playerId) return;
    
    console.log(`[DEBUG] Attempting to reconnect player ${this.playerId}`);
    
    try {
      // Clean up old connection explicitly
      if (this.socket) {
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        this.socket.onopen = null;
        this.socket.close();
        this.socket = null;
      }
      
      // Create a new connection
      this.socket = new WebSocket(`${this.serverUrl}/ws/${this.playerId}`);
      
      this.socket.onopen = () => {
        console.log(`[DEBUG] Reconnection successful for player ${this.playerId}`);
        this.lastConnectTime = performance.now();
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;
        
        // Trigger sync event to ensure game state is current
        this.dispatchEvent('reconnected', { player_id: this.playerId });
      };
      
      this.socket.onclose = (event) => {
        console.log('WebSocket reconnection closed:', event);
        this.handleDisconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket reconnection error:', error);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleGameEvent(message);
        } catch (error) {
          console.error('Error parsing message during reconnection:', error);
        }
      };
    } catch (error) {
      console.error(`Error during reconnection:`, error);
      this.handleDisconnect();
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
    
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.push(handler);
    }
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

  private handleGameEvent(message: any) {
    const { type, data } = message;
    
    // Inform any registered handlers
    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => handler(data));
  }
  
  /**
   * Manually dispatch an event to handlers
   */
  private dispatchEvent(type: string, data: any) {
    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach(handler => handler(data));
  }
} 