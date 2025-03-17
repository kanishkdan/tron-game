from typing import Dict, Optional
from pydantic import BaseModel

class Position(BaseModel):
    x: float
    y: float
    z: float

class Player(BaseModel):
    id: str
    position: Optional[Position] = Position(x=0, y=1, z=0)
    is_eliminated: bool = False
    score: int = 0
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "position": self.position.dict() if self.position else None,
            "is_eliminated": self.is_eliminated,
            "score": self.score
        }
    
    def update_position(self, x: float, y: float, z: float):
        self.position = Position(x=x, y=y, z=z)
    
    def eliminate(self):
        self.is_eliminated = True
    
    def add_score(self, points: int):
        self.score += points 