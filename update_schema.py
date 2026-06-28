from app import app, db
import logging
from sqlalchemy import text

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

with app.app_context():
    try:
        # Add user_profile_id column to text_entry table if it doesn't exist
        db.session.execute(text('ALTER TABLE text_entry ADD COLUMN IF NOT EXISTS user_profile_id INTEGER REFERENCES user_profile(id);'))
        db.session.commit()
        logger.info("Successfully added user_profile_id column to text_entry table")
    except Exception as e:
        logger.error(f"Error updating database schema: {str(e)}")
        raise