from typing import Dict, List, Any
from ..models.player import Player
from ..models.bot_player import BotPlayer
import time
import asyncio
from .performance_config import BOT_COUNT, ENABLE_BOT_LIGHT_TRAILS, BOT_CONFIG

class GameState:
    def __init__(self):
        self.players: Dict[str, Player] = {}
        self.bots: Dict[str, BotPlayer] = {}  # Separate dict for bots
        self.eliminated_players: List[str] = []
        self.game_phase = "waiting"  # waiting, playing, finished
        self.current_round = 0
        self.min_players = 2  # Reduced for easier testing
        self.last_bot_update = time.time()
        self.bot_update_task = None
        print("GameState initialized")
        
    def add_player(self, player_id: str) -> bool:
        self.players[player_id] = Player(id=player_id)
        print(f"Added player {player_id}, total players: {len(self.players)}")
        return True
    
    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
            print(f"Removed player {player_id}, remaining players: {len(self.players)}")
        if player_id in self.eliminated_players:
            self.eliminated_players.remove(player_id)
    
    def update_player_position(self, player_id: str, position: Dict[str, Any]):
        if player_id in self.players:
            # Update using the player's update_position method
            self.players[player_id].update_position(position)
    
    def eliminate_player(self, player_id: str):
        if player_id in self.players and player_id not in self.eliminated_players:
            self.players[player_id].eliminate()
            self.eliminated_players.append(player_id)
            print(f"Player {player_id} eliminated")
        elif player_id in self.bots and player_id not in self.eliminated_players:
            self.bots[player_id].eliminate()
            self.eliminated_players.append(player_id)
            print(f"Bot {player_id} eliminated")
    
    def get_state(self) -> dict:
        # Combine players and bots
        all_players = {
            **{player_id: player.to_dict() for player_id, player in self.players.items()},
            **{bot_id: bot.to_dict() for bot_id, bot in self.bots.items()}
        }
        
        return {
            "players": all_players,
            "eliminated_players": self.eliminated_players,
            "game_phase": self.game_phase,
            "current_round": self.current_round,
            "player_count": len(self.players) + len(self.bots),
            "min_players": self.min_players,
            "bot_count": len(self.bots)
        }
    
    def can_start_game(self) -> bool:
        total_players = len(self.players) + len(self.bots)
        return total_players >= self.min_players
    
    def start_game(self):
        if self.can_start_game():
            self.game_phase = "playing"
            self.current_round = 1
            self.eliminated_players = []
            print(f"Game started with {len(self.players)} players and {len(self.bots)} bots")
    
    def end_game(self):
        self.game_phase = "finished"
        print("Game ended")
        
    # Bot-related methods
    
    def add_bots(self, count: int = BOT_COUNT, use_light_trails: bool = ENABLE_BOT_LIGHT_TRAILS):
        """Add a specified number of bots to the game"""
        prefix = BOT_CONFIG.get("prefix", "Bot_")
        
        print(f"Adding {count} bots with light trails={use_light_trails}, prefix={prefix}")
        bot_count_before = len(self.bots)
        
        for i in range(count):
            bot_id = f"{prefix}{i+1}"
            # Skip if bot already exists
            if bot_id in self.bots:
                print(f"Bot {bot_id} already exists, skipping")
                continue
                
            # Create bot with configured light trail setting
            bot = BotPlayer(id=bot_id, use_light_trails=use_light_trails)
            self.bots[bot_id] = bot
            print(f"Created bot {bot_id} at position {bot.position['x']:.1f}, {bot.position['z']:.1f}")
            
        bot_count_after = len(self.bots)
        bots_added = bot_count_after - bot_count_before
        print(f"Added {bots_added} bots. Total bots: {bot_count_after}")
        
    def remove_all_bots(self):
        """Remove all bots from the game"""
        bot_count = len(self.bots)
        self.bots.clear()
        # Remove any eliminated bots from the list
        self.eliminated_players = [p for p in self.eliminated_players if p in self.players]
        print(f"All {bot_count} bots removed")
    
    async def start_bot_updates(self, broadcast_callback=None):
        """Start the bot update loop"""
        if self.bot_update_task is not None:
            print("Bot update task already running, not starting again")
            return  # Already running
            
        self.last_bot_update = time.time()
        print(f"Starting bot update loop for {len(self.bots)} bots")
        
        async def bot_update_loop():
            update_count = 0
            while True:
                try:
                    current_time = time.time()
                    delta_time = current_time - self.last_bot_update
                    self.last_bot_update = current_time
                    
                    turn_probability = BOT_CONFIG.get("turn_probability", 0.05)
                    
                    # Update each bot
                    bot_updates = {}
                    for bot_id, bot in list(self.bots.items()):
                        if bot_id in self.eliminated_players:
                            continue
                            
                        # Update bot position
                        position_changed = bot.update_bot(delta_time, turn_probability)
                        
                        # If position changed, add to updates
                        if position_changed and broadcast_callback:
                            bot_updates[bot_id] = bot.position
                    
                    # Broadcast bot updates if callback provided
                    if broadcast_callback and bot_updates:
                        for bot_id, position in bot_updates.items():
                            await broadcast_callback({
                                "type": "player_moved",
                                "data": {
                                    "player_id": bot_id,
                                    "position": position
                                }
                            })
                    
                    # Log updates periodically (every 50 updates)
                    update_count += 1
                    if update_count % 50 == 0:
                        print(f"Bot update #{update_count}: Updated {len(bot_updates)} bot positions")
                    
                    # Sleep to prevent CPU overload
                    await asyncio.sleep(0.1)  # 10 updates per second is plenty for bots
                    
                except Exception as e:
                    print(f"Error in bot update loop: {str(e)}")
                    await asyncio.sleep(1)  # Longer sleep on error
        
        # Start the update task
        self.bot_update_task = asyncio.create_task(bot_update_loop())
        print("Bot update task started")
        
    def stop_bot_updates(self):
        """Stop the bot update loop"""
        if self.bot_update_task:
            self.bot_update_task.cancel()
            self.bot_update_task = None
            print("Bot update task stopped") 