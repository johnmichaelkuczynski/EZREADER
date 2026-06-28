"""
Auto API Key Activation Script

This script automatically activates all API keys on server startup.
It's designed to be imported in main.py and run automatically.
"""

import logging
import requests
import time

logger = logging.getLogger(__name__)

def activate_api_keys():
    """
    Send a request to the API key activation endpoint.
    This is run automatically on startup to ensure all keys are active.
    """
    logger.info("Auto-activating API keys on startup...")
    
    try:
        # Give the server time to start up
        time.sleep(3)
        
        # Call the endpoint
        response = requests.post(
            "http://localhost:5000/reset_api_keys",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                logger.info(f"Successfully activated {data.get('reset_count', 0)} API keys on startup")
                return True
            else:
                logger.warning(f"API key activation response indicated failure: {data.get('message', 'Unknown error')}")
        else:
            logger.warning(f"API key activation failed with status code: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error in auto API key activation: {str(e)}")
    
    return False