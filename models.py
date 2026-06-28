from datetime import datetime
from app import db

class UserProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)  # Email used as unique identifier
    merged_text = db.Column(db.Text, nullable=True)  # Combined text from all uploads
    word_count = db.Column(db.Integer, default=0)  # Total word count of merged text
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    uploads = db.relationship('WritingSample', backref='profile', lazy=True)
    entries = db.relationship('TextEntry', backref='user_profile', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'word_count': self.word_count,
            'created_at': self.created_at.isoformat(),
            'last_updated': self.last_updated.isoformat(),
            'upload_count': len(self.uploads)
        }

class WritingSample(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey('user_profile.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    text_content = db.Column(db.Text, nullable=False)
    word_count = db.Column(db.Integer, default=0)
    file_type = db.Column(db.String(20), nullable=False)  # 'txt', 'pdf', 'docx'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'profile_id': self.profile_id,
            'filename': self.filename,
            'text_content': self.text_content,
            'word_count': self.word_count,
            'file_type': self.file_type,
            'created_at': self.created_at.isoformat()
        }

class ContentSource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    text_content = db.Column(db.Text, nullable=False)
    word_count = db.Column(db.Integer, default=0)
    file_type = db.Column(db.String(20), nullable=False)  # 'txt', 'pdf', 'docx', etc.
    usage_instructions = db.Column(db.Text, nullable=True)  # How the content source should be used
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with TextEntry (nullable so it can be used before having a text entry)
    text_entry_id = db.Column(db.Integer, db.ForeignKey('text_entry.id'), nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'text_content': self.text_content,
            'word_count': self.word_count,
            'file_type': self.file_type,
            'usage_instructions': self.usage_instructions,
            'created_at': self.created_at.isoformat(),
            'text_entry_id': self.text_entry_id
        }

class TextEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    original_text = db.Column(db.Text, nullable=False)
    processed_text = db.Column(db.Text, nullable=False)
    action = db.Column(db.String(50), nullable=False)  # rewrite, summarize, expand
    complexity = db.Column(db.String(100), nullable=False)  # Increased from 20 to 100 characters
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Add total chunks field to track pagination
    total_chunks = db.Column(db.Integer, default=1)
    # Add new fields for custom processing
    custom_instructions = db.Column(db.Text)
    preserve_structure = db.Column(db.Boolean, default=True)
    # User's writing profile ID (optional)
    user_profile_id = db.Column(db.Integer, db.ForeignKey('user_profile.id'), nullable=True)
    # Language translation support
    target_language = db.Column(db.String(50), nullable=True)  # Target language for translation
    # Add chunks relationship
    chunks = db.relationship('DocumentChunk', backref='document', lazy=True)
    # Add content source relationship
    content_sources = db.relationship('ContentSource', backref='text_entry', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'original_text': self.original_text,
            'processed_text': self.processed_text,
            'action': self.action,
            'complexity': self.complexity,
            'created_at': self.created_at.isoformat(),
            'total_chunks': self.total_chunks,
            'current_chunk': min(len(self.chunks), self.total_chunks),
            'custom_instructions': self.custom_instructions,
            'preserve_structure': self.preserve_structure,
            'user_profile_id': self.user_profile_id,
            'target_language': self.target_language,
            'has_content_source': len(self.content_sources) > 0
        }

class DocumentChunk(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('text_entry.id'), nullable=False)
    chunk_number = db.Column(db.Integer, nullable=False)  # Position in document
    original_chunk = db.Column(db.Text, nullable=False)  # Original text chunk
    processed_chunk = db.Column(db.Text)  # Processed version (nullable until processed)
    is_processed = db.Column(db.Boolean, default=False)
    processing_status = db.Column(db.String(20), default='pending')  # pending, processing, complete, error
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'chunk_number': self.chunk_number,
            'original_chunk': self.original_chunk,
            'processed_chunk': self.processed_chunk,
            'is_processed': self.is_processed,
            'processing_status': self.processing_status,
            'created_at': self.created_at.isoformat()
        }

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    context = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'response': self.response,
            'context': self.context,
            'created_at': self.created_at.isoformat()
        }