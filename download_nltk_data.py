"""
Utility script to download NLTK data for sentence tokenization.
This ensures proper text chunking for the audiobook generator.
"""

import os
import nltk

# Create directory structure
data_dir = '/tmp/nltk_data'
os.makedirs(data_dir, exist_ok=True)

# Download the necessary NLTK data
nltk.download('punkt', download_dir=data_dir, quiet=False)

# Add the path to NLTK's search path
nltk.data.path.append(data_dir)

# Verify the download was successful
try:
    from nltk.tokenize import sent_tokenize
    sample_text = "This is a test sentence. This is another one! Is this working?"
    sentences = sent_tokenize(sample_text)
    print(f"Successfully downloaded and tested NLTK punkt tokenizer.")
    print(f"Test result: {len(sentences)} sentences detected.")
    print(f"Sentences: {sentences}")
except Exception as e:
    print(f"Error testing NLTK tokenizer: {str(e)}")

print(f"\nNLTK data directory: {data_dir}")
print(f"Current NLTK data paths: {nltk.data.path}")