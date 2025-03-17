from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json
import asyncio
from .game.game_state import GameState
from .models.player import Player

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
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
    await websocket.accept()
    active_connections[player_id] = websocket
    
    try:
        # Add player to game state
        game_state.add_player(player_id)
        
        # Send initial game state to the new player
        await websocket.send_json({
            "type": "game_state",
            "data": game_state.get_state()
        })
        
        # Broadcast new player to others
        await broadcast({
            "type": "player_joined",
            "data": {"player_id": player_id}
        }, exclude=player_id)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle player movement
            if message["type"] == "player_move":
                game_state.update_player_position(
                    player_id,
                    message["data"]["position"]
                )
                # Broadcast movement to other players
                await broadcast({
                    "type": "player_moved",
                    "data": {
                        "player_id": player_id,
                        "position": message["data"]["position"]
                    }
                }, exclude=player_id)
            
            # Handle player elimination
            elif message["type"] == "player_eliminated":
                game_state.eliminate_player(player_id)
                await broadcast({
                    "type": "player_eliminated",
                    "data": {"player_id": player_id}
                })
                
    except WebSocketDisconnect:
        # Handle player disconnection
        if player_id in active_connections:
            del active_connections[player_id]
        game_state.remove_player(player_id)
        await broadcast({
            "type": "player_left",
            "data": {"player_id": player_id}
        })

async def broadcast(message: dict, exclude: str = None):
    for player_id, connection in active_connections.items():
        if player_id != exclude:
            await connection.send_json(message)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 