import os
import logging
from app import app, db

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

with app.app_context():
    try:
        # Drop all tables and recreate them
        db.drop_all()
        db.create_all()
        
        # Log success
        logger.info("Successfully reset database schema")
        
    except Exception as e:
        logger.error(f"Error resetting database schema: {str(e)}")
        raise