from app import db, app
from models import ContentSource
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_content_source_schema():
    """Update the content_source table to make text_entry_id nullable"""
    try:
        with app.app_context():
            # Use raw SQL to modify the column
            sql = "ALTER TABLE content_source ALTER COLUMN text_entry_id DROP NOT NULL;"
            db.session.execute(sql)
            db.session.commit()
            logger.info("Successfully updated content_source table schema")
    except Exception as e:
        logger.error(f"Error updating content_source table: {str(e)}")
        if db.session.is_active:
            db.session.rollback()

if __name__ == "__main__":
    update_content_source_schema()
    print("Schema update completed")