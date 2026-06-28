import os
import requests
import logging

logger = logging.getLogger(__name__)

GPTZERO_API_URL = "https://api.gptzero.me/v2/predict/text"

def detect_ai_content(text):
    """
    Analyze text using GPTZero API to detect AI-generated content.
    Returns a dict with detection results or a user-friendly error message.
    """
    try:
        # Debug logging
        logger.info(f"Starting AI detection on text of length {len(text)}")
        
        api_key = os.environ.get("GPTZERO_API_KEY")
        if not api_key:
            logger.error("GPTZero API key not found in environment variables")
            return {
                "error": "AI detection requires a GPTZero API key. Please contact the administrator to set up this feature.",
                "is_configuration_error": True
            }
        
        logger.info(f"Using GPTZero API key: {api_key[:4]}...{api_key[-4:] if len(api_key) > 8 else ''}")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Api-Key": api_key
        }

        # Limit text length to avoid API limitations
        max_length = 10000  # GPTZero may have input limits
        truncated_text = text[:max_length] if len(text) > max_length else text
        if len(text) > max_length:
            logger.warning(f"Text truncated from {len(text)} to {max_length} characters for GPTZero API")
        
        data = {
            "document": truncated_text
        }

        logger.info(f"Sending request to GPTZero API at {GPTZERO_API_URL}")
        response = requests.post(GPTZERO_API_URL, headers=headers, json=data)
        
        # Log response status and headers
        logger.info(f"GPTZero API response status: {response.status_code}")
        logger.debug(f"GPTZero API response headers: {response.headers}")
        
        response.raise_for_status()

        result = response.json()
        logger.info(f"GPTZero API response received, size: {len(str(result))} characters")
        logger.debug(f"GPTZero API raw response: {result}")

        # Extract relevant information from GPTZero response
        if "documents" not in result or not result["documents"]:
            logger.error("No 'documents' field in GPTZero API response")
            raise ValueError("Invalid response from GPTZero API: Missing 'documents' field")

        doc_result = result["documents"][0]

        # Log the document-level predicted class and probabilities
        predicted_class = doc_result.get("predicted_class", "unknown").lower()
        logger.info(f"GPTZero predicted class: {predicted_class}")
        
        # Get overall AI probability from class probabilities
        class_probs = doc_result.get("class_probabilities", {})
        ai_prob = class_probs.get("ai", 0)
        human_prob = class_probs.get("human", 0)
        mixed_prob = class_probs.get("mixed", 0)
        
        logger.info(f"Class probabilities - AI: {ai_prob}, Human: {human_prob}, Mixed: {mixed_prob}")

        # Get sentence-level analysis
        sentences = doc_result.get("sentences", [])
        if not sentences:
            logger.error("No 'sentences' field in GPTZero API response")
            raise ValueError("No sentence analysis in GPTZero response")

        # Calculate average perplexity score and generated probability
        avg_perplexity = sum(s.get("perplexity", 0) for s in sentences) / len(sentences)
        avg_generated_prob = sum(s.get("generated_prob", 0) for s in sentences) / len(sentences)
        
        logger.info(f"Average perplexity: {avg_perplexity}, Average generated probability: {avg_generated_prob}")

        # Determine if AI-generated based on multiple factors
        is_ai = predicted_class == "ai"
        
        # Calculate a more reliable AI score:
        # 1. Use the AI class probability from the overall document
        # 2. If that's unusually low/high, blend with the average sentence-level probabilities
        final_ai_score = ai_prob
        
        # If the class probability seems not to vary much, blend with sentence-level data
        if abs(ai_prob - 0.5) < 0.1:  # If it's close to 0.5, which seems like a default
            logger.warning("AI probability is close to 0.5, using sentence-level data for score")
            final_ai_score = (ai_prob + avg_generated_prob) / 2
        
        # Round to 2 decimal places
        ai_score = round(final_ai_score * 100, 2)
        
        logger.info(f"Final AI detection score: {ai_score}%, Is AI: {is_ai}")

        return {
            "ai_score": ai_score,
            "perplexity_score": round(avg_perplexity, 2),
            "is_ai_generated": is_ai,
            "document_class": predicted_class,
            "human_probability": round(human_prob * 100, 2),
            "mixed_probability": round(mixed_prob * 100, 2),
            "sentence_count": len(sentences),
            "raw_response": result
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"GPTZero API request failed: {str(e)}")
        return {"error": f"AI detection service error: {str(e)}"}
    except Exception as e:
        logger.error(f"Error in AI detection: {str(e)}")
        return {"error": f"AI detection failed: {str(e)}"}