import pytest
from app.game.game_state import GameState
from app.models.player import Player

@pytest.fixture
def game_state():
    return GameState()

def test_add_player(game_state):
    # Test adding a valid player
    assert game_state.add_player("player1") is True
    assert "player1" in game_state.players
    
    # Test adding too many players
    for i in range(game_state.max_players):
        game_state.add_player(f"player{i+1}")
    assert game_state.add_player("extra_player") is False

def test_remove_player(game_state):
    game_state.add_player("player1")
    game_state.remove_player("player1")
    assert "player1" not in game_state.players

def test_update_player_position(game_state):
    game_state.add_player("player1")
    position = {"x": 1.0, "y": 2.0, "z": 3.0}
    game_state.update_player_position("player1", position)
    assert game_state.players["player1"].position.dict() == position

def test_eliminate_player(game_state):
    game_state.add_player("player1")
    game_state.eliminate_player("player1")
    assert "player1" in game_state.eliminated_players

def test_get_state(game_state):
    game_state.add_player("player1")
    state = game_state.get_state()
    assert "players" in state
    assert "eliminated_players" in state
    assert "game_phase" in state
    assert "player_count" in state
    assert state["player_count"] == 1

def test_can_start_game(game_state):
    # Test with insufficient players
    assert game_state.can_start_game() is False
    
    # Test with enough players
    for i in range(game_state.min_players):
        game_state.add_player(f"player{i+1}")
    assert game_state.can_start_game() is True

def test_start_game(game_state):
    # Add minimum required players
    for i in range(game_state.min_players):
        game_state.add_player(f"player{i+1}")
    
    game_state.start_game()
    assert game_state.game_phase == "playing"
    assert game_state.current_round == 1
    assert len(game_state.eliminated_players) == 0 