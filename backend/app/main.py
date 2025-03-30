from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
import json
import asyncio
from .game.game_state import GameState
from .models.player import Player
from .game.performance_config import BOT_COUNT, ENABLE_BOT_LIGHT_TRAILS, update_config
from pydantic import BaseModel

# Define request model for settings update
class PerformanceSettings(BaseModel):
    bot_count: Optional[int] = None
    enable_light_trails: Optional[bool] = None
    bot_config: Optional[Dict] = None

app = FastAPI()

# Configure CORS with specific origins
origins = [
    "http://localhost:3000",
    "http://localhost:5173",  # Vite's default dev server port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://tron-game-production.up.railway.app",  # Railway frontend domain
    "https://tron-backend-production.up.railway.app",  # Railway backend domain
    "https://tron.kanishkdan.com",  # Production domain
    "http://tron.kanishkdan.com"  # In case HTTP is used
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

# API endpoint to update performance settings
@app.post("/performance/settings")
async def update_performance_settings(settings: PerformanceSettings):
    """Update performance testing settings"""
    # Update the configuration
    updated_config = update_config(
        bot_count=settings.bot_count,
        enable_trails=settings.enable_light_trails,
        config_updates=settings.bot_config
    )
    
    # If bot count is changed, remove all bots and add the new amount
    if settings.bot_count is not None:
        # Remove existing bots
        await remove_bots()
        
        # Add new bots with current settings
        await add_bots(
            count=updated_config["bot_count"], 
            use_light_trails=updated_config["enable_light_trails"]
        )
        
    # If only trail setting changed, update existing bots
    elif settings.enable_light_trails is not None:
        # Update trails on existing bots
        for bot_id, bot in game_state.bots.items():
            bot.use_light_trails = settings.enable_light_trails
            if bot.position:
                bot.position["useTrails"] = settings.enable_light_trails
                
            # Broadcast updated trail setting
            await broadcast({
                "type": "player_updated",
                "data": {
                    "player_id": bot_id,
                    "use_light_trails": settings.enable_light_trails
                }
            })
    
    return updated_config

# API endpoints for bot control
@app.post("/bots/add")
async def add_bots(count: int = BOT_COUNT, use_light_trails: bool = ENABLE_BOT_LIGHT_TRAILS):
    """Add bots to the game with configurable settings"""
    print(f"ADMIN: Adding {count} bots with light trails={use_light_trails}")
    game_state.add_bots(count, use_light_trails)
    
    # Start bot updates if they're not already running
    if not game_state.bot_update_task:
        await game_state.start_bot_updates(broadcast)
    
    # Broadcast bot join events to all connected players
    for bot_id, bot in game_state.bots.items():
        print(f"ADMIN: Broadcasting bot join for {bot_id}")
        await broadcast({
            "type": "player_joined",
            "data": {
                "player_id": bot_id,
                "is_bot": True,
                "use_light_trails": bot.use_light_trails
            }
        })
    
    return {"message": f"Added {count} bots with light trails: {use_light_trails}",
            "bot_count": len(game_state.bots)}

@app.post("/bots/remove")
async def remove_bots():
    """Remove all bots from the game"""
    bot_ids = list(game_state.bots.keys())
    game_state.remove_all_bots()
    
    # Stop bot updates if we have no bots
    if game_state.bot_update_task and len(game_state.bots) == 0:
        game_state.stop_bot_updates()
    
    # Broadcast bot removal events
    for bot_id in bot_ids:
        await broadcast({
            "type": "player_left",
            "data": {"player_id": bot_id}
        })
    
    return {"message": "All bots removed"}

@app.get("/")
async def root():
    return {"message": "Girgaya Game Server"}

@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    print(f"[WebSocket] Connection attempt from player {player_id}")
    try:
        print(f"[WebSocket] Accepting connection for player {player_id}")
        await websocket.accept()
        print(f"[WebSocket] Player {player_id} connected successfully")
        
        # Check if player already exists, if so, handle as a reconnection
        is_reconnection = player_id in active_connections
        print(f"[WebSocket] Is reconnection: {is_reconnection}")
        
        # First update the connection reference (regardless of reconnection status)
        old_connection = active_connections.get(player_id)
        active_connections[player_id] = websocket
        
        # Close old connection if it exists to prevent duplicate connections
        if is_reconnection and old_connection != websocket:
            try:
                print(f"[WebSocket] Closing old connection for reconnecting player {player_id}")
                await old_connection.close()
            except Exception as e:
                print(f"[WebSocket] Error closing old connection for {player_id}: {str(e)}")
        
        # Add player to game state (or update if reconnecting)
        if is_reconnection:
            print(f"[WebSocket] Player {player_id} is reconnecting")
            # Refresh the player state but don't broadcast a new join event
            game_state.update_player(player_id)
        else:
            # For new players, add them to game state
            print(f"[WebSocket] Adding new player {player_id} to game state")
            game_state.add_player(player_id)
            # Broadcast new player to others
            await broadcast({
                "type": "player_joined",
                "data": {"player_id": player_id}
            }, exclude=player_id)
        
        # Get current state to send to the player
        current_state = game_state.get_state()
        print(f"[WebSocket] Sending game state to {player_id}: {len(current_state['players'])} players")
        
        try:
            # Send initial game state to the player
            await websocket.send_json({
                "type": "game_state",
                "data": current_state
            })
            print(f"[WebSocket] Initial game state sent to {player_id}")
        except Exception as e:
            print(f"[WebSocket] Error sending initial game state to {player_id}: {str(e)}")
            raise
        
        # Handle messages from the player
        while True:
            try:
                data = await websocket.receive_text()
                print(f"[WebSocket] Received message from {player_id}: {data[:100]}...")  # Log first 100 chars
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
                
                # Handle player kill events
                elif message["type"] == "player_kill":
                    killer = message["data"].get("killer", "Unknown")
                    victim = message["data"].get("victim", "Unknown")
                    # Extract just the player names, removing any ID suffixes
                    killer_name = killer.split('-')[0] if '-' in killer else killer
                    victim_name = victim.split('-')[0] if '-' in victim else victim
                    
                    print(f"Kill event: {killer_name} killed {victim_name}")
                    
                    # Broadcast kill event to all players
                    await broadcast({
                        "type": "player_kill",
                        "data": {
                            "killer": killer_name,
                            "victim": victim_name
                        }
                    })
                
                # Handle chat messages
                elif message["type"] == "chat_message":
                    player_id = message["data"].get("player_id", "Unknown")
                    player_name = message["data"].get("player_name", "Unknown")
                    chat_message = message["data"].get("message", "")
                    
                    print(f"Chat message from {player_name}: {chat_message}")
                    
                    # Broadcast chat message to all players
                    await broadcast({
                        "type": "chat_message",
                        "data": {
                            "player_id": player_id,
                            "player_name": player_name,
                            "message": chat_message
                        }
                    })
                
                # Handle explicit player disconnect
                elif message["type"] == "player_disconnect":
                    print(f"Player {player_id} sent explicit disconnect")
                    break
                    
            except WebSocketDisconnect:
                print(f"[WebSocket] Player {player_id} disconnected")
                break
            except Exception as e:
                print(f"[WebSocket] Error processing message from {player_id}: {str(e)}")
                break
                
    except WebSocketDisconnect:
        print(f"[WebSocket] WebSocket disconnect in message loop for {player_id}")
    except Exception as e:
        print(f"[WebSocket] Error handling WebSocket for {player_id}: {str(e)}")
    finally:
        # Cleanup
        if player_id in active_connections and active_connections[player_id] == websocket:
            print(f"[WebSocket] Cleaning up connection for {player_id}")
            del active_connections[player_id]
            game_state.remove_player(player_id)
            await broadcast({
                "type": "player_left",
                "data": {"player_id": player_id}
            })
            
        # Start a delayed removal task 
        asyncio.create_task(delayed_player_removal(player_id))

# Add a delayed player removal function to handle temporary disconnections
async def delayed_player_removal(player_id: str, delay_seconds: int = 5):
    """Remove player after a delay to allow for reconnections"""
    try:
        await asyncio.sleep(delay_seconds)
        
        # If player hasn't reconnected after the delay, remove them
        if player_id not in active_connections:
            print(f"Player {player_id} didn't reconnect within {delay_seconds}s, removing")
            game_state.remove_player(player_id)
            await broadcast({
                "type": "player_left",
                "data": {"player_id": player_id}
            })
            print(f"Active players: {len(active_connections)}")
            
            # If no real players left, stop bot updates
            if len(active_connections) == 0 and game_state.bot_update_task:
                print("DEBUG: No players left, stopping bot updates")
                game_state.stop_bot_updates()
    except Exception as e:
        print(f"Error in delayed player removal for {player_id}: {str(e)}")

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
    
    # Schedule cleanup for any disconnected players (don't remove immediately)
    for player_id in disconnected_players:
        if player_id in active_connections:
            del active_connections[player_id]
            # Create a task to handle delayed removal
            asyncio.create_task(delayed_player_removal(player_id))

# Startup event to initialize the app
@app.on_event("startup")
async def startup_event():
    print(f"Server starting with BOT_COUNT={BOT_COUNT}, ENABLE_BOT_LIGHT_TRAILS={ENABLE_BOT_LIGHT_TRAILS}")

# Add bots when the server starts for immediate testing
@app.on_event("startup")
async def add_initial_bots():
    print(f"Adding {BOT_COUNT} initial bots for testing")
    game_state.add_bots(BOT_COUNT, ENABLE_BOT_LIGHT_TRAILS)
    print(f"Added {len(game_state.bots)} bots on startup")
    
    # NOTE: We can't start updates here because we don't have the broadcast function yet
    # Updates will start when first player connects

@app.get("/api/player-count")
async def get_player_count():
    """Get the current player count"""
    # Count real players and bots
    real_players = len(active_connections)
    bot_players = len(game_state.bots)
    total_players = real_players + bot_players
    print(f"Player count requested: real={real_players}, bots={bot_players}, total={total_players}")
    return {"count": total_players}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 