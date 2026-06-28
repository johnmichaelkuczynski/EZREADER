import os
import sys
from app import db, app
from datetime import datetime

def reset_schema():
    """Drop and recreate all tables in the database."""
    with app.app_context():
        # Drop all tables
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        print("Database schema has been reset.")

if __name__ == "__main__":
    # Ask for confirmation
    confirm = input("This will delete all data in the database. Type 'yes' to confirm: ")
    if confirm.lower() == 'yes':
        reset_schema()
    else:
        print("Operation cancelled.")