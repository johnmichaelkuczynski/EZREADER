# Enhanced function for OpenAI processor
def process_with_openai(
    self, 
    text: str, 
    api_key: str, 
    action: str = 'rewrite',
    style_instruction: str = '',
    custom_instructions: str = '',
    is_first_subchunk: bool = False
) -> str:
    """Process text using OpenAI API with enhanced prompts for style and density preservation"""
    import openai
    from openai import OpenAI
    
    client = self.get_client_for_provider('openai', api_key)
    
    # Different prompt handling based on the action
    if action == "expand":
        # This is for the emergency expansion case
        prompt = f"""{custom_instructions}"""
    else:
        # Enhanced prompt to fix style mimicry and density issues
        if is_first_subchunk:
            prompt = OPENAI_FIRST_CHUNK_PROMPT.format(
                custom_instructions=custom_instructions,
                style_instruction=style_instruction,
                text=text
            )
        else:
            prompt = OPENAI_CONTINUATION_PROMPT.format(
                custom_instructions=custom_instructions,
                style_instruction=style_instruction,
                text=text
            )

    try:
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2000,
            timeout=API_TIMEOUT
        )
        
        response_text = response.choices[0].message.content
        cleaned_response = self.clean_ai_response(response_text, custom_instructions, style_instruction)
        return cleaned_response
        
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise