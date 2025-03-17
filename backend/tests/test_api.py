import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Girgaya Game Server"}

def test_websocket_connection():
    with client.websocket_connect("/ws/test-player") as websocket:
        # Test receiving initial game state
        data = websocket.receive_json()
        assert data["type"] == "game_state"
        assert "players" in data["data"]
        assert "eliminated_players" in data["data"]
        assert "game_phase" in data["data"]
        
        # Test sending player movement
        websocket.send_json({
            "type": "player_move",
            "data": {
                "position": {"x": 1.0, "y": 2.0, "z": 3.0}
            }
        })
        
        # Test sending player elimination
        websocket.send_json({
            "type": "player_eliminated",
            "data": {}
        }) 