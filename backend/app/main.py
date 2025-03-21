from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json
import asyncio
from .game.game_state import GameState
from .models.player import Player

app = FastAPI()

# Configure CORS with specific origins
origins = [
    "http://localhost:3000",
    "http://localhost:5173",  # Vite's default dev server port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "*",  # Allow all origins for testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections and game state
active_connections: Dict[str, WebSocket] = {}
game_state = GameState()

@app.get("/")
async def root():
    return {"message": "Girgaya Game Server"}

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    try:
        await websocket.accept()
        print(f"Player {player_id} connected")
        active_connections[player_id] = websocket
        
        # Add player to game state
        game_state.add_player(player_id)
        
        # Get current state to send to the new player
        current_state = game_state.get_state()
        print(f"Sending game state to {player_id}: {len(current_state['players'])} players")
        
        # Send initial game state to the new player
        await websocket.send_json({
            "type": "game_state",
            "data": current_state
        })
        
        # Broadcast new player to others
        await broadcast({
            "type": "player_joined",
            "data": {"player_id": player_id}
        }, exclude=player_id)
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle player movement
                if message["type"] == "player_move":
                    position_data = message["data"]["position"]
                    game_state.update_player_position(
                        player_id,
                        position_data
                    )
                    
                    # Create a message with complete position data
                    move_data = {
                        "player_id": player_id,
                        "position": position_data
                    }
                    
                    # Broadcast movement to other players
                    await broadcast({
                        "type": "player_moved",
                        "data": move_data
                    }, exclude=player_id)
                
                # Handle player elimination
                elif message["type"] == "player_eliminated":
                    game_state.eliminate_player(player_id)
                    await broadcast({
                        "type": "player_eliminated",
                        "data": {"player_id": player_id}
                    })
                    
            except json.JSONDecodeError:
                print(f"Invalid JSON received from {player_id}")
                continue
                
    except WebSocketDisconnect:
        print(f"Client {player_id} disconnected")
    except Exception as e:
        print(f"Error handling WebSocket for {player_id}: {str(e)}")
    finally:
        # Always clean up the connection and remove player from game state
        if player_id in active_connections:
            del active_connections[player_id]
        game_state.remove_player(player_id)
        print(f"Player {player_id} removed, broadcasting departure")
        await broadcast({
            "type": "player_left",
            "data": {"player_id": player_id}
        })
        print(f"Active players: {len(active_connections)}")

async def broadcast(message: dict, exclude: str = None):
    disconnected_players = []
    for player_id, connection in active_connections.items():
        if player_id != exclude:
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                disconnected_players.append(player_id)
            except Exception as e:
                print(f"Error broadcasting to {player_id}: {str(e)}")
                disconnected_players.append(player_id)
    
    # Clean up any disconnected players
    for player_id in disconnected_players:
        if player_id in active_connections:
            del active_connections[player_id]
        game_state.remove_player(player_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 