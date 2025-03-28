"""
Configuration file for game performance testing.
Controls the number of bots and whether they have light trails.
"""

# Number of AI bots to add to the game
BOT_COUNT = 0

# Whether bots should have light trails (can impact performance)
ENABLE_BOT_LIGHT_TRAILS = True

# Bot configuration can be adjusted here
BOT_CONFIG = {
    "prefix": "Bot_",  # Prefix for bot IDs
    "speed_multiplier": 5.0,  # Bot speed multiplier (default: 1.0)
    "turn_probability": 0.01,  # Probability of bot making a turn in each update
}

# Function to update configuration at runtime
def update_config(bot_count=None, enable_trails=None, config_updates=None):
    """
    Update performance configuration at runtime.
    Returns the updated configuration.
    """
    global BOT_COUNT, ENABLE_BOT_LIGHT_TRAILS, BOT_CONFIG
    
    if bot_count is not None:
        BOT_COUNT = bot_count
        
    if enable_trails is not None:
        ENABLE_BOT_LIGHT_TRAILS = enable_trails
        
    if config_updates and isinstance(config_updates, dict):
        BOT_CONFIG.update(config_updates)
        
    # Return current configuration
    return {
        "bot_count": BOT_COUNT,
        "enable_light_trails": ENABLE_BOT_LIGHT_TRAILS,
        "bot_config": BOT_CONFIG
    } 