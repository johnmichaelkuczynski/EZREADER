import re
import os

# Read the existing file
with open('multi_provider_processor.py', 'r') as file:
    content = file.read()

# Update the OpenAI function 
openai_pattern = r"""(\s+# Different prompt handling based on the action\s+if action == "expand":\s+# This is for the emergency expansion case\s+prompt = f"""\{custom_instructions\}"""\s+else:\s+)# Normal rewrite case - Brutalized prompt injection\s+if is_first_subchunk:\s+prompt = f"""INSTRUCTION TO LLM:\s*\{custom_instructions\}\s*\s*Focus on adopting the voice, tone, and word choice \{style_instruction\}.\s*Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.\s*Avoid formulaic sentence starters or repeating rhetorical patterns.\s*Maintain EXACTLY the same information, examples, and meaning from the original text.\s*Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.\s*\s*TARGET DOCUMENT TEXT:\s*\{text\}"""\s+else:\s+prompt = f"""INSTRUCTION TO LLM:\s*\{custom_instructions\}\s*\s*Focus on adopting the voice, tone, and word choice \{style_instruction\}.\s*Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.\s*Avoid formulaic sentence starters or repeating rhetorical patterns.\s*Maintain EXACTLY the same information, examples, and meaning from the original text.\s*This is a continuation section, so maintain consistency with previous sections.\s*Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.\s*\s*TARGET DOCUMENT TEXT:\s*\{text\}"""
"""

openai_replacement = r"""\1# Enhanced prompt to fix style mimicry and density issues
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
"""

# Update with Anthropic function
anthropic_pattern = r"""(\s+# Different prompt handling based on the action\s+if action == "expand":\s+# This is for the emergency expansion case\s+prompt = f"""\{custom_instructions\}"""\s+else:\s+)# Normal rewrite case - Brutalized prompt injection\s+if is_first_subchunk:\s+prompt = f"""INSTRUCTION TO LLM:\s*\{custom_instructions\}\s*\s*Focus on adopting the voice, tone, and word choice \{style_instruction\}.\s*Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.\s*Avoid formulaic sentence starters or repeating rhetorical patterns.\s*Maintain EXACTLY the same information, examples, and meaning from the original text.\s*Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.\s*\s*TARGET DOCUMENT TEXT:\s*\{text\}"""\s+else:\s+prompt = f"""INSTRUCTION TO LLM:\s*\{custom_instructions\}\s*\s*Focus on adopting the voice, tone, and word choice \{style_instruction\}.\s*Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.\s*Avoid formulaic sentence starters or repeating rhetorical patterns.\s*Maintain EXACTLY the same information, examples, and meaning from the original text.\s*This is a continuation section, so maintain consistency with previous sections.\s*Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.\s*\s*TARGET DOCUMENT TEXT:\s*\{text\}"""
"""

anthropic_replacement = r"""\1# Enhanced prompt to fix style mimicry and density issues
            if is_first_subchunk:
                prompt = ANTHROPIC_FIRST_CHUNK_PROMPT.format(
                    custom_instructions=custom_instructions,
                    style_instruction=style_instruction,
                    text=text
                )
            else:
                prompt = ANTHROPIC_CONTINUATION_PROMPT.format(
                    custom_instructions=custom_instructions,
                    style_instruction=style_instruction,
                    text=text
                )
"""

# Update emergency expansion and formality check
emergency_formality_pattern = r"""                    # Emergency formality correction if tone/density is lost
                    logger.warning\("FORMALITY CHECK FAILED - Output has been casualized. Performing emergency formality correction."\)
                    
                    emergency_formality_prompt = \(
                        f"You have failed to preserve the formal rigor, conceptual density, and technical tone of the original document. "
                        f"Rewrite the following text again, maintaining original argument structure, formal vocabulary, and density without smoothing or simplifying. "
                        f"Match the original intellectual weight precisely.\\n\\n"
                        f"REMEMBER:\\n"
                        f"1. Preserve exact technical vocabulary - do NOT substitute with simpler terms\\n"
                        f"2. Maintain formal academic tone - no journalistic style\\n"
                        f"3. Keep complex sentence structures intact\\n"
                        f"4. Do NOT add invented examples or analogies\\n"
                        f"5. Preserve all logical steps in arguments\\n\\n"
                        f"Original text for tone reference:\\n\{macrochunk\[:5000\]\}\\n\\n"  # First portion for tone reference
                        f"Text requiring tone correction \(MUST match intellectual weight and density of original\):\\n\{result\}"
                    \)"""

emergency_formality_replacement = r"""                    # Enhanced emergency formality correction with more precise instructions
                    logger.warning("FORMALITY CHECK FAILED - Output has been casualized. Performing emergency formality correction.")
                    
                    emergency_formality_prompt = ENHANCED_FORMALITY_CORRECTION.format(
                        original_text=macrochunk[:5000],
                        text=result
                    )"""

# Update casual markers for formality check
casual_markers_pattern = r"""        casual_markers = \[
            r'\\bbasically\\b', r'\\bjust\\b', r'\\banyway\\b', r'\\bstuff\\b', r'\\bthings\\b', 
            r'\\bguy\\b', r'\\bkind of\\b', r'\\bsort of\\b', r'\\ba lot\\b', r'\\blike\\b', 
            r'\\byou know\\b', r'\\bI think\\b', r'\\bI feel\\b'
        \]"""

casual_markers_replacement = r"""        # Enhanced casual marker detection
        casual_markers = [
            r'\\bbasically\\b', r'\\bjust\\b', r'\\banyway\\b', r'\\bstuff\\b', r'\\bthings\\b', 
            r'\\bguy\\b', r'\\bkind of\\b', r'\\bsort of\\b', r'\\ba lot\\b', r'\\blike\\b', 
            r'\\byou know\\b', r'\\bI think\\b', r'\\bI feel\\b'
        ] + ADDITIONAL_CASUAL_MARKERS"""

# Apply all the replacements
content = re.sub(openai_pattern, openai_replacement, content, flags=re.DOTALL)
content = re.sub(anthropic_pattern, anthropic_replacement, content, flags=re.DOTALL)
content = re.sub(emergency_formality_pattern, emergency_formality_replacement, content, flags=re.DOTALL)
content = re.sub(casual_markers_pattern, casual_markers_replacement, content, flags=re.DOTALL)

# Write the updated content back to the file
with open('multi_provider_processor.py.new', 'w') as file:
    file.write(content)

print("Update completed. New file written to multi_provider_processor.py.new")