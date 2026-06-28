import os
import logging
from app import app, db
from models import ContentSource, TextEntry

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def update_database():
    """Update database schema to add new tables and columns"""
    with app.app_context():
        try:
            # Check if ContentSource table exists
            engine = db.engine
            connection = engine.connect()
            inspector = db.inspect(engine)
            
            logger.info("Starting database schema update")
            
            # Check if target_language column exists in TextEntry
            if 'target_language' not in [col['name'] for col in inspector.get_columns('text_entry')]:
                logger.info("Adding target_language column to TextEntry table")
                connection.execute(db.text("ALTER TABLE text_entry ADD COLUMN target_language VARCHAR(50)"))
                logger.info("Added target_language column to TextEntry table")
            else:
                logger.info("target_language column already exists in TextEntry table")
            
            # Check if ContentSource table exists
            if 'content_source' not in inspector.get_table_names():
                logger.info("Creating ContentSource table")
                
                # Drop the existing sequence if it exists to prevent conflicts
                connection.execute(db.text("DROP SEQUENCE IF EXISTS content_source_id_seq"))
                
                # Create the table using SQL instead of SQLAlchemy ORM
                connection.execute(db.text("""
                CREATE TABLE content_source (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    text_content TEXT NOT NULL,
                    word_count INTEGER DEFAULT 0,
                    file_type VARCHAR(20) NOT NULL,
                    usage_instructions TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    text_entry_id INTEGER NOT NULL REFERENCES text_entry(id)
                )
                """))
                logger.info("ContentSource table created successfully")
            else:
                logger.info("ContentSource table already exists")
            
            connection.commit()
            connection.close()
            logger.info("Database schema update completed successfully")
            return True
        except Exception as e:
            logger.error(f"Error updating database schema: {str(e)}")
            return False

if __name__ == "__main__":
    update_database()