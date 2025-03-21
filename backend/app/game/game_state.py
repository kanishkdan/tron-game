from typing import Dict, List, Any
from ..models.player import Player

class GameState:
    def __init__(self):
        self.players: Dict[str, Player] = {}
        self.eliminated_players: List[str] = []
        self.game_phase = "waiting"  # waiting, playing, finished
        self.current_round = 0
        self.max_players = 16
        self.min_players = 2  # Reduced for easier testing
        
    def add_player(self, player_id: str) -> bool:
        if len(self.players) >= self.max_players:
            return False
        self.players[player_id] = Player(id=player_id)
        return True
    
    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]
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
    
    def get_state(self) -> dict:
        return {
            "players": {
                player_id: player.to_dict()
                for player_id, player in self.players.items()
            },
            "eliminated_players": self.eliminated_players,
            "game_phase": self.game_phase,
            "current_round": self.current_round,
            "player_count": len(self.players),
            "max_players": self.max_players,
            "min_players": self.min_players
        }
    
    def can_start_game(self) -> bool:
        return len(self.players) >= self.min_players
    
    def start_game(self):
        if self.can_start_game():
            self.game_phase = "playing"
            self.current_round = 1
            self.eliminated_players = []
    
    def end_game(self):
        self.game_phase = "finished" 