#!/usr/bin/env python3
"""
Environment loader utility for Luna AI
Provides centralized environment loading for different components
"""

from pathlib import Path
from dotenv import load_dotenv

def load_env(component: str):
    """Load environment variables for a specific component
    
    Args:
        component: One of 'luna', 'analyzer', or 'memory'
    """
    project_root = Path(__file__).parent.parent.parent.parent.parent.parent
    env_file_map = {
        'luna': '.env.luna',
        'analyzer': '.env.analyzer', 
        'memory': '.env.memory'
    }
    
    if component not in env_file_map:
        raise ValueError(f"Invalid component: {component}. Must be one of: {list(env_file_map.keys())}")
    
    env_path = project_root / env_file_map[component]
    
    if env_path.exists():
        load_dotenv(env_path, override=True)
        print(f"[ENV] Loaded {component} environment from {env_file_map[component]}")
    else:
        raise FileNotFoundError(f"Environment file {env_file_map[component]} not found")
