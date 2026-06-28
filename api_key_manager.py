import os
import time
import logging
import random
import threading
from typing import Dict, List, Optional, Tuple

# Initialize logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ApiKeyManager:
    """
    Manages multiple API keys across different providers for load distribution
    and handling rate limits or failures.
    """
    
    def __init__(self):
        self.openai_keys = self._load_api_keys("OPENAI_API_KEY")
        self.anthropic_keys = self._load_api_keys("ANTHROPIC_API_KEY")
        self.perplexity_keys = self._load_api_keys("PERPLEXITY_API_KEY")
        self.deepseek_keys = self._load_api_keys("DEEPSEEK_API_KEY")
        self.venice_keys = self._load_api_keys("VENICE_API_KEY")
        
        # Track key health and usage
        self.key_status: Dict[str, Dict] = {}
        # Guards read-modify-write on key_status so concurrent requests
        # (threaded gunicorn workers) can't corrupt failure counts/cooldowns.
        self._lock = threading.RLock()
        self.initialize_key_status()
        
        logger.info(f"Loaded {len(self.openai_keys)} OpenAI keys, {len(self.anthropic_keys)} Anthropic keys, "
                   f"{len(self.perplexity_keys)} Perplexity keys, {len(self.deepseek_keys)} DeepSeek keys, "
                   f"and {len(self.venice_keys)} Venice keys")

    def _load_api_keys(self, env_var_name: str) -> List[str]:
        """
        Load API keys from environment variables.
        Supports comma-separated lists of keys.
        """
        keys = []
        env_value = os.environ.get(env_var_name)
        
        if env_value:
            # Split by comma if multiple keys are provided
            if "," in env_value:
                keys = [key.strip() for key in env_value.split(",") if key.strip()]
            else:
                keys = [env_value.strip()]
                
        return keys
    
    def initialize_key_status(self):
        """Initialize the status tracking for all keys"""
        # Process OpenAI keys
        for key in self.openai_keys:
            key_id = f"openai_{key[:8]}"  # Use first 8 chars as identifier
            self.key_status[key_id] = {
                "provider": "openai",
                "key": key,
                "available": True,
                "last_used": 0,
                "failure_count": 0,
                "cooldown_until": 0
            }
            
        # Process Anthropic keys
        for key in self.anthropic_keys:
            key_id = f"anthropic_{key[:8]}"
            self.key_status[key_id] = {
                "provider": "anthropic",
                "key": key,
                "available": True,
                "last_used": 0,
                "failure_count": 0,
                "cooldown_until": 0
            }
            
        # Process Perplexity keys
        for key in self.perplexity_keys:
            key_id = f"perplexity_{key[:8]}"
            self.key_status[key_id] = {
                "provider": "perplexity",
                "key": key,
                "available": True,
                "last_used": 0,
                "failure_count": 0,
                "cooldown_until": 0
            }
            
        # Process DeepSeek keys
        for key in self.deepseek_keys:
            key_id = f"deepseek_{key[:8]}"
            self.key_status[key_id] = {
                "provider": "deepseek",
                "key": key,
                "available": True,
                "last_used": 0,
                "failure_count": 0,
                "cooldown_until": 0
            }
            
        # Process Venice keys
        for key in self.venice_keys:
            key_id = f"venice_{key[:8]}"
            self.key_status[key_id] = {
                "provider": "venice",
                "key": key,
                "available": True,
                "last_used": 0,
                "failure_count": 0,
                "cooldown_until": 0
            }
    
    def get_next_available_key(self) -> Optional[Tuple[str, str, str]]:
        """
        Get the next available API key using a round-robin approach,
        returns: (key_id, provider, api_key) or None if no keys available
        """
        with self._lock:
            current_time = time.time()
            available_keys = []
            
            # Filter available keys that are not in cooldown
            for key_id, status in self.key_status.items():
                if status["available"] and current_time > status["cooldown_until"]:
                    available_keys.append((key_id, status["provider"], status["key"]))
            
            if not available_keys:
                logger.warning("No API keys available at this time")
                return None
                
            # Sort by last used timestamp to implement round-robin
            available_keys.sort(key=lambda x: self.key_status[x[0]]["last_used"])
            
            # Use the least recently used key
            selected_key = available_keys[0]
            self.key_status[selected_key[0]]["last_used"] = current_time
            
            return selected_key
    
    def get_key_for_macrochunk(self, macrochunk_index: int) -> Optional[Tuple[str, str, str]]:
        """
        Get a key for a specific macrochunk using a deterministic approach.
        This ensures the same key is used if the function is called multiple times
        for the same macrochunk.
        """
        with self._lock:
            current_time = time.time()
            available_keys = []
            
            # Filter available keys that are not in cooldown
            for key_id, status in self.key_status.items():
                if status["available"] and current_time > status["cooldown_until"]:
                    available_keys.append((key_id, status["provider"], status["key"]))
            
            if not available_keys:
                logger.warning("No API keys available for macrochunk processing")
                return None
                
            # Select key based on macrochunk index (round-robin)
            selected_key = available_keys[macrochunk_index % len(available_keys)]
            self.key_status[selected_key[0]]["last_used"] = current_time
            
            return selected_key
    
    def mark_key_unavailable(self, key_id: str, cooldown_seconds: int = 60):
        """Mark a key as unavailable after a failure"""
        with self._lock:
            if key_id in self.key_status:
                self.key_status[key_id]["failure_count"] += 1
                
                # If this is the 3rd consecutive failure, mark as unavailable for longer
                if self.key_status[key_id]["failure_count"] >= 3:
                    logger.warning(f"Key {key_id} has failed 3 times, marking as unavailable")
                    self.key_status[key_id]["available"] = False
                    self.key_status[key_id]["cooldown_until"] = time.time() + 300  # 5 minute cooldown
                else:
                    # Apply short cooldown with exponential backoff
                    backoff = 2 ** self.key_status[key_id]["failure_count"]
                    cooldown = min(cooldown_seconds * backoff, 120)  # Max 2 minute cooldown
                    self.key_status[key_id]["cooldown_until"] = time.time() + cooldown
                    logger.info(f"Key {key_id} in cooldown for {cooldown} seconds after failure")
    
    def reset_key_failure(self, key_id: str):
        """Reset failure count after a successful API call"""
        with self._lock:
            if key_id in self.key_status:
                self.key_status[key_id]["failure_count"] = 0
                # Ensure it's marked available again
                self.key_status[key_id]["available"] = True
    
    def get_key_by_provider(self, provider: str) -> Optional[Tuple[str, str]]:
        """Get a random available key for a specific provider"""
        with self._lock:
            current_time = time.time()
            available_keys = []
            
            # Filter available keys for the specified provider
            for key_id, status in self.key_status.items():
                if status["provider"] == provider and status["available"] and current_time > status["cooldown_until"]:
                    available_keys.append((key_id, status["key"]))
            
            if not available_keys:
                return None
                
            # Select a random key from the available ones
            return random.choice(available_keys)
    
    def get_available_providers(self) -> List[str]:
        """Get a list of currently available API providers"""
        providers = set()
        current_time = time.time()
        
        for status in self.key_status.values():
            if status["available"] and current_time > status["cooldown_until"]:
                providers.add(status["provider"])
                
        return list(providers)
    
    def reset_all_keys(self) -> int:
        """
        Reset all API keys to available status.
        Returns the number of keys that were reset.
        """
        reset_count = 0
        
        with self._lock:
            for key_id in self.key_status:
                self.key_status[key_id]['available'] = True
                self.key_status[key_id]['failure_count'] = 0
                self.key_status[key_id]['cooldown_until'] = 0
                reset_count += 1
            
        logger.info(f"Reset {reset_count} API keys to available status")
        return reset_count

# Create a singleton instance
api_key_manager = ApiKeyManager()