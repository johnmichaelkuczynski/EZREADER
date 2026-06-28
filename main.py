from app import app
import logging
import threading
import time
# from enhanced_rewrite_integration import setup_enhanced_rewrite
from auto_activate_keys import activate_api_keys
from multi_provider_processor_extension import patch_multi_provider_processor

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enhanced rewrite functionality disabled
# logger.info("Initializing enhanced rewrite and smart search system...")
# try:
#     # Set up enhanced rewrite integration
#     integration = setup_enhanced_rewrite(app)
#     logger.info("Enhanced rewrite and smart search system successfully integrated")
# except Exception as e:
#     logger.error(f"Failed to integrate enhanced system: {str(e)}")
#     logger.info("Continuing with original rewrite system")

# Apply the chat processing patch for translation functionality
try:
    logger.info("Adding chat processing functionality for translation...")
    patch_result = patch_multi_provider_processor()
    if patch_result:
        logger.info("Successfully added chat processing functionality for translation")
    else:
        logger.warning("Failed to add chat processing functionality")
except Exception as e:
    logger.error(f"Error adding chat processing functionality: {str(e)}")
    logger.info("Continuing without translation chat functionality")

# Function to auto-activate API keys in a separate thread
def auto_activate_keys_thread():
    """Run the API key activation in a background thread after a short delay"""
    # Wait for the server to fully start
    time.sleep(5)
    logger.info("Starting automatic API key activation...")
    try:
        result = activate_api_keys()
        if result:
            logger.info("API keys successfully activated on startup")
        else:
            logger.warning("Automatic API key activation returned an unsuccessful status")
    except Exception as e:
        logger.error(f"Error in automatic API key activation: {str(e)}")

if __name__ == "__main__":
    # Start the API key activation in a background thread
    threading.Thread(target=auto_activate_keys_thread, daemon=True).start()
    
    # Start the Flask application
    app.run(host="0.0.0.0", port=5000, debug=True)
