from functools import lru_cache, wraps
from typing import Callable, Any
from collections import OrderedDict

class SimpleCache:
    """
    A simple LRU (Least Recently Used) cache implementation.
    
    This provides a pure Python alternative to lru-dict with similar functionality.
    """
    def __init__(self, maxsize=128):
        """
        Initialize the cache with a maximum size.
        
        :param maxsize: Maximum number of items to store in the cache
        """
        self._cache = OrderedDict()
        self._maxsize = maxsize

    def __getitem__(self, key):
        """
        Retrieve an item from the cache and mark it as recently used.
        
        :param key: The key to retrieve
        :return: The cached value
        """
        value = self._cache[key]
        # Move the key to the end to mark as most recently used
        self._cache.move_to_end(key)
        return value

    def __setitem__(self, key, value):
        """
        Set an item in the cache, potentially removing the least recently used item.
        
        :param key: The key to set
        :param value: The value to store
        """
        if key in self._cache:
            # Remove the existing key to re-insert at the end
            del self._cache[key]
        
        # Add the new key-value pair
        self._cache[key] = value
        
        # If cache is full, remove the first (least recently used) item
        if len(self._cache) > self._maxsize:
            self._cache.popitem(last=False)

    def __contains__(self, key):
        """
        Check if a key exists in the cache.
        
        :param key: The key to check
        :return: Boolean indicating key presence
        """
        return key in self._cache

    def get(self, key, default=None):
        """
        Retrieve an item from the cache with a default value if not found.
        
        :param key: The key to retrieve
        :param default: The default value to return if key is not found
        :return: The cached value or default
        """
        return self._cache.get(key, default)

def cached(maxsize=128):
    """
    A decorator that provides caching for functions.
    
    :param maxsize: Maximum number of items to cache
    :return: Decorated function with caching
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Use lru_cache for simple, efficient caching
            cached_func = lru_cache(maxsize=maxsize)(func)
            return cached_func(*args, **kwargs)
        return wrapper
    return decorator

# Example usage:
# @cached(maxsize=50)
# def expensive_computation(x, y):
#     # Some time-consuming computation
#     return result
