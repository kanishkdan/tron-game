from typing import Dict, Optional, Any
from pydantic import BaseModel, Field

class Position(BaseModel):
    x: float
    y: float
    z: float
    rotation: Optional[float] = None

class Player(BaseModel):
    id: str
    position: Optional[Dict[str, Any]] = None
    is_eliminated: bool = False
    score: int = 0
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "position": self.position,
            "is_eliminated": self.is_eliminated,
            "score": self.score
        }
    
    def update_position(self, position_data: Dict[str, Any]):
        self.position = position_data
    
    def eliminate(self):
        self.is_eliminated = True
    
    def add_score(self, points: int):
        self.score += points 