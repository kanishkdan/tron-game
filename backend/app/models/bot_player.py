"""
Bot player model for performance testing.
"""
from typing import Dict, Any, List, Optional
import random
import math
import time
from pydantic import Field
from .player import Player

class BotPlayer(Player):
    """
    Bot player that moves automatically in the game world.
    Used for performance testing with configurable parameters.
    """
    use_light_trails: bool = Field(default=False)  # Default to no trails for performance
    speed: float = Field(default=0.0)
    direction: float = Field(default=0.0)
    next_turn_time: float = Field(default=0.0)
    last_update_time: float = Field(default=0.0)
    active: bool = Field(default=False)
    spawn_time: float = Field(default=0.0)
    update_frequency: float = Field(default=0.1)  # Only update position every 100ms
    last_position_update: float = Field(default=0.0)
    
    def __init__(self, id: str, use_light_trails: bool = False, spawn_delay: float = 0.0):
        super().__init__(id=id)
        self.use_light_trails = use_light_trails
        self.speed = random.uniform(40, 80)  # Increased speed range
        self.direction = random.uniform(0, 2 * math.pi)  # Random initial direction
        self.next_turn_time = random.uniform(1, 5)  # Time until next turn
        self.last_update_time = 0
        self.last_position_update = 0
        self.active = spawn_delay <= 0
        self.spawn_time = time.time() + spawn_delay
        
        # Initial position in a random location
        arena_size = 500
        self.position = {
            "x": random.uniform(-arena_size/2, arena_size/2),
            "y": 0.25,  # Standard height
            "z": random.uniform(-arena_size/2, arena_size/2),
            "rotation": self.direction,
            "speed": self.speed,
            "useTrails": self.use_light_trails
        }
        
        log_msg = f"Bot {id} created: speed={self.speed:.1f}, trails={use_light_trails}, pos=({self.position['x']:.1f}, {self.position['z']:.1f})"
        if not self.active:
            log_msg += f", will spawn in {spawn_delay:.1f}s"
        print(log_msg)
    
    def update_bot(self, delta_time: float, turn_probability: float = 0.01) -> bool:
        """
        Update bot position based on its current direction and speed.
        Returns True if position was changed, False otherwise.
        """
        # Check if bot should be activated based on server time
        current_time = time.time()
        if not self.active:
            if current_time >= self.spawn_time:
                self.active = True
                print(f"Bot {self.id} activated")
                return True
            return False
            
        # Throttle updates to reduce CPU usage
        self.last_update_time += delta_time
        if current_time - self.last_position_update < self.update_frequency:
            return False
            
        self.last_position_update = current_time
        position_changed = False
        
        # Check if it's time to change direction
        if self.last_update_time >= self.next_turn_time:
            # Randomly decide to turn left or right
            turn_direction = random.choice([-1, 1])
            turn_amount = random.uniform(math.pi/4, math.pi/2)  # 45-90 degree turn
            self.direction += turn_direction * turn_amount
            
            # Normalize direction to 0-2π
            self.direction = self.direction % (2 * math.pi)
            
            # Set time for next turn
            self.next_turn_time = self.last_update_time + random.uniform(1, 5)
            position_changed = True
        
        # Random chance to make an additional turn (for more natural movement)
        # Reduced probability to decrease calculation load
        elif random.random() < turn_probability:
            turn_direction = random.choice([-1, 1])
            turn_amount = random.uniform(math.pi/8, math.pi/4)  # 22.5-45 degree turn
            self.direction += turn_direction * turn_amount
            self.direction = self.direction % (2 * math.pi)
            position_changed = True
        
        # Update position based on direction and speed
        old_x = self.position["x"]
        old_z = self.position["z"]
        
        self.position["x"] += math.sin(self.direction) * self.speed * delta_time
        self.position["z"] += math.cos(self.direction) * self.speed * delta_time
        self.position["rotation"] = self.direction
        
        # Boundary check (arena bounds)
        arena_size = 500
        half_size = arena_size / 2
        
        # If hitting a boundary, bounce with a random angle
        if abs(self.position["x"]) > half_size:
            self.position["x"] = half_size * (1 if self.position["x"] > 0 else -1)
            self.direction = math.pi - self.direction + random.uniform(-0.2, 0.2)
            position_changed = True
            
        if abs(self.position["z"]) > half_size:
            self.position["z"] = half_size * (1 if self.position["z"] > 0 else -1)
            self.direction = -self.direction + random.uniform(-0.2, 0.2)
            position_changed = True
            
        # Normalize direction after bounces
        self.direction = self.direction % (2 * math.pi)
        
        # Calculate distance moved
        distance_moved = math.sqrt((self.position["x"] - old_x)**2 + (self.position["z"] - old_z)**2)
        if distance_moved > 0:
            position_changed = True
        
        return position_changed
    
    def to_dict(self) -> Dict:
        """Return bot data including trail settings"""
        # Only return data if the bot is active
        if not self.active:
            return None
            
        data = super().to_dict()
        data["is_bot"] = True
        data["use_light_trails"] = self.use_light_trails
        data["active"] = self.active
        
        # Ensure position includes useTrails property
        if self.position and "useTrails" not in self.position:
            self.position["useTrails"] = self.use_light_trails
            
        return data

class BotManager:
    """Manages bot spawning and lifecycle with performance optimizations"""
    
    def __init__(self):
        self.bots: List[BotPlayer] = []
        self.max_active_trails = 2  # Further reduce max trail bots for performance
        self.max_concurrent_spawns = 3  # Maximum bots that can spawn simultaneously
        self.last_spawn_check = 0
        self.spawn_check_interval = 1.0  # Check for new spawns every second
    
    def create_bots(self, count: int, spawn_interval: float = 5.0) -> List[BotPlayer]:
        """Create multiple bots with staggered spawn times"""
        new_bots = []
        
        # Count existing bots with trails
        trails_count = sum(1 for bot in self.bots if bot.use_light_trails)
        
        for i in range(count):
            # Add randomness to spawn time to prevent multiple bots from spawning exactly together
            # Stagger with base interval plus small random offset
            spawn_delay = i * spawn_interval + random.uniform(0.5, 2.0)
            
            # Determine if this bot should use trails based on performance constraints
            # Very limited number of trail bots for performance
            use_trails = (trails_count < self.max_active_trails)
            
            # Create bot with appropriate settings
            bot_id = f"bot_{len(self.bots) + i + 1}"
            bot = BotPlayer(id=bot_id, use_light_trails=use_trails, spawn_delay=spawn_delay)
            
            if use_trails:
                trails_count += 1
                
            new_bots.append(bot)
            
        self.bots.extend(new_bots)
        return new_bots
    
    def update_all_bots(self, delta_time: float) -> List[str]:
        """Update all bots and return IDs of bots that changed position"""
        changed_bots = []
        current_time = time.time()
        
        # Throttle spawn checks to reduce CPU load
        if current_time - self.last_spawn_check >= self.spawn_check_interval:
            self.last_spawn_check = current_time
            
            # Count bots activated in the last spawn interval
            recent_spawns = 0
            for bot in self.bots:
                if not bot.active and current_time - bot.spawn_time < self.spawn_check_interval:
                    recent_spawns += 1
            
            # If too many bots scheduled to spawn at once, postpone some
            if recent_spawns > self.max_concurrent_spawns:
                postponed = 0
                for bot in self.bots:
                    if not bot.active and current_time - bot.spawn_time < self.spawn_check_interval:
                        # Delay this bot's spawn time
                        if postponed < (recent_spawns - self.max_concurrent_spawns):
                            bot.spawn_time += self.spawn_check_interval * 2
                            postponed += 1
                            print(f"Postponed bot {bot.id} spawn to avoid concurrent spawns")
        
        # Only update active bots
        for bot in self.bots:
            if bot.active or current_time >= bot.spawn_time:
                if bot.update_bot(delta_time):
                    changed_bots.append(bot.id)
                
        return changed_bots
        
    def get_active_bots(self) -> List[Dict]:
        """Return only active bots for rendering"""
        return [bot.to_dict() for bot in self.bots if bot.active] 