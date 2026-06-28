"""
Humanizer Module: Handles operations related to user writing samples and style profiles
"""
import os
import logging
from flask import current_app

logger = logging.getLogger(__name__)

def get_user_profile(email):
    """Get user profile by email, create if not exists"""
    from app import db
    import models
    
    profile = models.UserProfile.query.filter_by(email=email).first()
    if not profile:
        profile = models.UserProfile(email=email)
        db.session.add(profile)
        db.session.commit()
        logger.info(f"Created new user profile for {email}")
    return profile

def add_writing_sample(profile_id, filename, text_content, file_type):
    """Add a new writing sample to user profile"""
    from app import db
    import models
    
    if not text_content or not text_content.strip():
        raise ValueError("Empty text content")
    
    # Count words
    word_count = len(text_content.split())
    if word_count < 10:
        raise ValueError("Text is too short (less than 10 words)")
    
    # Create writing sample
    sample = models.WritingSample(
        profile_id=profile_id,
        filename=filename,
        text_content=text_content,
        word_count=word_count,
        file_type=file_type
    )
    db.session.add(sample)
    
    # Update the user profile with new merged text
    profile = models.UserProfile.query.get(profile_id)
    if not profile:
        raise ValueError("Profile not found")
    
    # Append to existing merged text or create new
    if profile.merged_text:
        # Add a separator between existing samples and new one
        profile.merged_text = profile.merged_text + "\n\n--- Sample Separator ---\n\n" + text_content
    else:
        profile.merged_text = text_content
    
    # Update word count
    profile.word_count = len(profile.merged_text.split())
    
    db.session.commit()
    logger.info(f"Added writing sample for profile {profile_id}, new word count: {profile.word_count}")
    
    return sample

def clear_user_profile(profile_id):
    """Clear all writing samples for a user profile"""
    from app import db
    import models
    
    profile = models.UserProfile.query.get(profile_id)
    if not profile:
        raise ValueError("Profile not found")
    
    # Delete all writing samples
    models.WritingSample.query.filter_by(profile_id=profile_id).delete()
    
    # Clear merged text and reset word count
    profile.merged_text = None
    profile.word_count = 0
    
    db.session.commit()
    logger.info(f"Cleared profile {profile_id}")
    
    return profile

def get_user_style_text(email=None, profile_id=None):
    """Get the user's writing style text based on email or profile ID"""
    import models
    
    if email:
        profile = models.UserProfile.query.filter_by(email=email).first()
    elif profile_id:
        profile = models.UserProfile.query.get(profile_id)
    else:
        return None
    
    if not profile or not profile.merged_text:
        return None
    
    return profile.merged_text