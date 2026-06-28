"""
Comprehensive Research & Source Selection Module

This module provides comprehensive research functionality that combines:
1. Google Custom Search Engine (CSE) for web sources
2. Multiple AI providers (OpenAI, Anthropic, Perplexity) for AI research
3. Intelligent content analysis for automatic search term generation
"""

import os
import logging
import requests
import json
from typing import List, Dict, Any, Optional, Tuple
import re
from multi_provider_processor import MultiProviderProcessor

logger = logging.getLogger(__name__)

class ComprehensiveSearchEngine:
    """Comprehensive search engine combining web sources and AI research"""
    
    def __init__(self):
        """Initialize the search engine with API credentials"""
        self.google_api_key = os.environ.get('GOOGLE_API_KEY')
        self.google_cse_id = os.environ.get('GOOGLE_CSE_ID')
        self.processor = MultiProviderProcessor()
        
        # Validate Google API credentials
        if not self.google_api_key or not self.google_cse_id:
            logger.warning("Google API credentials not found - web search will be limited")
    
    def extract_key_terms(self, text: str, max_terms: int = 5) -> List[str]:
        """Extract key terms from text content for search"""
        if not text or len(text.strip()) < 10:
            return []
        
        # Remove common words and extract meaningful terms
        text = text.lower()
        
        # Extract potential key terms (words/phrases that are likely meaningful)
        # Look for capitalized words, technical terms, specific concepts
        terms = []
        
        # Find technical terms, proper nouns, and specialized vocabulary
        words = re.findall(r'\b[A-Za-z]{3,}\b', text)
        
        # Score words based on frequency and characteristics
        word_freq = {}
        for word in words:
            if len(word) > 3 and word not in ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Get the most frequent meaningful terms
        sorted_terms = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        terms = [term[0] for term in sorted_terms[:max_terms]]
        
        return terms
    
    def search_web_sources(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Search web sources using Google Custom Search Engine"""
        if not self.google_api_key or not self.google_cse_id:
            logger.warning("Google API credentials not available")
            return []
        
        try:
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                'key': self.google_api_key,
                'cx': self.google_cse_id,
                'q': query,
                'num': num_results
            }
            
            logger.info(f"Searching web for: {query}")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            web_sources = []
            
            if 'items' in data:
                for item in data['items']:
                    source = {
                        'title': item.get('title', 'Untitled'),
                        'link': item.get('link', ''),
                        'snippet': item.get('snippet', 'No description available'),
                        'source_type': 'web'
                    }
                    web_sources.append(source)
            
            logger.info(f"Found {len(web_sources)} web sources")
            return web_sources
            
        except Exception as e:
            logger.error(f"Error searching web sources: {str(e)}")
            return []
    
    def get_ai_research(self, query: str) -> List[Dict[str, Any]]:
        """Get AI research from multiple providers"""
        ai_research = []
        
        # Research prompt for AI providers
        research_prompt = f"""Provide comprehensive research information about: {query}

Please provide a detailed, informative response (2-3 paragraphs, 150-300 words) that covers:
1. Key concepts and definitions
2. Important facts, principles, or theories
3. Practical applications or examples
4. Current developments or significance

Make your response academically rigorous and informative."""

        # Get research from each AI provider
        providers = [
            ('openai', 'GPT Research'),
            ('anthropic', 'Claude Research'), 
            ('perplexity', 'Perplexity Research'),
            ('deepseek', 'DeepSeek Research')
        ]
        
        for provider, display_name in providers:
            try:
                logger.info(f"Getting {display_name} for query: {query}")
                
                # Use the multi-provider processor to get research
                success, response = self._get_provider_research(provider, research_prompt)
                
                if success and response:
                    ai_research.append({
                        'provider': provider,
                        'title': display_name,
                        'content': response.strip(),
                        'source_type': 'ai'
                    })
                    logger.info(f"Successfully got {display_name}")
                else:
                    logger.warning(f"Failed to get {display_name}: {response}")
                    
            except Exception as e:
                logger.error(f"Error getting {display_name}: {str(e)}")
        
        return ai_research
    
    def _get_provider_research(self, provider: str, prompt: str) -> Tuple[bool, str]:
        """Get research from a specific AI provider"""
        try:
            if provider == 'openai':
                return self.processor._process_with_openai(prompt)
            elif provider == 'anthropic':
                return self.processor._process_with_anthropic(prompt)
            elif provider == 'perplexity':
                return self.processor._process_with_perplexity(prompt)
            elif provider == 'deepseek':
                return self.processor._process_with_deepseek(prompt)
            else:
                return False, f"Unknown provider: {provider}"
        except Exception as e:
            return False, str(e)
    
    def comprehensive_search(self, query: str = None, text_content: str = None, num_web_results: int = 5) -> Dict[str, Any]:
        """Perform comprehensive search combining web sources and AI research"""
        
        # Determine search query
        if query and query.strip():
            search_query = query.strip()
            logger.info(f"Using provided search query: {search_query}")
        elif text_content and text_content.strip():
            # Extract key terms from text content
            key_terms = self.extract_key_terms(text_content)
            if key_terms:
                search_query = ' '.join(key_terms[:3])  # Use top 3 terms
                logger.info(f"Generated search query from content: {search_query}")
            else:
                return {
                    'success': False,
                    'error': 'Unable to generate search terms from content'
                }
        else:
            return {
                'success': False,
                'error': 'No search query or text content provided'
            }
        
        # Get web sources
        logger.info("Starting comprehensive search...")
        web_sources = self.search_web_sources(search_query, num_web_results)
        
        # Get AI research
        ai_research = self.get_ai_research(search_query)
        
        # Combine results
        result = {
            'success': True,
            'search_query': search_query,
            'web_sources': web_sources,
            'ai_research': ai_research,
            'total_sources': len(web_sources) + len(ai_research)
        }
        
        logger.info(f"Comprehensive search complete: {len(web_sources)} web sources, {len(ai_research)} AI research items")
        return result

# Initialize global search engine instance
search_engine = ComprehensiveSearchEngine()

def perform_comprehensive_search(query: str = None, text_content: str = None) -> Dict[str, Any]:
    """Perform comprehensive search - main entry point"""
    return search_engine.comprehensive_search(query, text_content)