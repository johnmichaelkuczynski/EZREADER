"""
Enhanced prompts for the rewrite system to address style mimicry,
density preservation, and smart enrichment requirements.
"""

# Add Anthropic-specific prompts
ANTHROPIC_FIRST_CHUNK_PROMPT_V2 = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

STYLE MIMICRY RULES (HIGHEST PRIORITY):
1. You MUST preserve the EXACT logical structure and reasoning style of the original
2. You MUST maintain the same paragraph structure, sentence complexity, and rhetorical patterns
3. You MUST use equivalent specialized vocabulary, formal terms, and domain-specific language
4. You MUST keep ALL conceptual nuance, philosophical depth, and argumentative density
5. DO NOT "translate" or "simplify" complex arguments - keep their original form

MANDATORY REQUIREMENTS:
1. LENGTH ENFORCEMENT: Your output MUST match 100%–110% of the original length
2. TONE PRESERVATION: Maintain or elevate the intellectual density and formality
3. STRUCTURAL INTEGRITY: Preserve ALL argument steps, logical connectors, and examples
4. STYLE MATCHING: {style_instruction}
5. NO SIMPLIFICATION: Do NOT "breezify" or flatten sophisticated content

✓ CORRECT EXAMPLES OF STYLE MIMICRY:
Original: "Urban's contention is not that the Church is a force of good, but that the Church is, indeed, a church and that, by virtue of fighting for its own existence, it has come, however paradoxically, to represent freedom from establishment tyranny."

Bad rewrite: "Urban does not argue that Scientology is a good institution. Instead, he says it qualifies as a church and that, paradoxically, its resistance to external suppression has made it a symbol of religious freedom."

Proper rewrite: "Let C be the claim that Scientology is tyrannical. Let F be the fact that the establishment seeks to destroy it. Let L be the principle: any institution fighting for its existential rights against an overreaching state apparatus exemplifies liberty. Urban accepts C and F. He argues that, regardless of C, the Church satisfies L. Hence, despite being internally repressive, Scientology's external struggle is, ipso facto, a stand against tyranny."

Original: "Hubbard wasn't exercising his right to join a religion—he was doing what Moses, Jesus, and Mohammed did."

Bad rewrite: "Hubbard did not join a religion, but instead founded a new one in a modern way."

Proper rewrite: "Hubbard's act was not derivative of existing religion. It was structurally equivalent to the founding moves of Moses and Mohammed — but executed in 20th-century idiom. Hence the space-gods."

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# Anthropic continuation prompt
ANTHROPIC_CONTINUATION_PROMPT_V2 = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

STYLE MIMICRY RULES (HIGHEST PRIORITY):
1. You MUST preserve the EXACT logical structure and reasoning style of the original
2. You MUST maintain the same paragraph structure, sentence complexity, and rhetorical patterns
3. You MUST use equivalent specialized vocabulary, formal terms, and domain-specific language
4. You MUST keep ALL conceptual nuance, philosophical depth, and argumentative density
5. DO NOT "translate" or "simplify" complex arguments - keep their original form

MANDATORY REQUIREMENTS:
1. LENGTH ENFORCEMENT: Your output MUST match 100%–110% of the original length
2. TONE PRESERVATION: Maintain or elevate the intellectual density and formality
3. STRUCTURAL INTEGRITY: Preserve ALL argument steps, logical connectors, and examples
4. STYLE MATCHING: {style_instruction}
5. NO SIMPLIFICATION: Do NOT "breezify" or flatten sophisticated content
6. CONSISTENCY: Maintain perfect continuity with previous sections

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# FIRST CHUNK PROMPT - OpenAI (Enhanced with style mimicry)
OPENAI_FIRST_CHUNK_PROMPT_V2 = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

STYLE MIMICRY RULES (HIGHEST PRIORITY):
1. You MUST preserve the EXACT logical structure and reasoning style of the original
2. You MUST maintain the same paragraph structure, sentence complexity, and rhetorical patterns
3. You MUST use equivalent specialized vocabulary, formal terms, and domain-specific language
4. You MUST keep ALL conceptual nuance, philosophical depth, and argumentative density
5. DO NOT "translate" or "simplify" complex arguments - keep their original form

MANDATORY REQUIREMENTS:
1. LENGTH ENFORCEMENT: Your output MUST match 100%–110% of the original length
2. TONE PRESERVATION: Maintain or elevate the intellectual density and formality
3. STRUCTURAL INTEGRITY: Preserve ALL argument steps, logical connectors, and examples
4. STYLE MATCHING: {style_instruction}
5. NO SIMPLIFICATION: Do NOT "breezify" or flatten sophisticated content

✓ CORRECT EXAMPLES OF STYLE MIMICRY:
Original: "Urban's contention is not that the Church is a force of good, but that the Church is, indeed, a church and that, by virtue of fighting for its own existence, it has come, however paradoxically, to represent freedom from establishment tyranny."

Bad rewrite: "Urban does not argue that Scientology is a good institution. Instead, he says it qualifies as a church and that, paradoxically, its resistance to external suppression has made it a symbol of religious freedom."

Proper rewrite: "Let C be the claim that Scientology is tyrannical. Let F be the fact that the establishment seeks to destroy it. Let L be the principle: any institution fighting for its existential rights against an overreaching state apparatus exemplifies liberty. Urban accepts C and F. He argues that, regardless of C, the Church satisfies L. Hence, despite being internally repressive, Scientology's external struggle is, ipso facto, a stand against tyranny."

Original: "Hubbard wasn't exercising his right to join a religion—he was doing what Moses, Jesus, and Mohammed did."

Bad rewrite: "Hubbard did not join a religion, but instead founded a new one in a modern way."

Proper rewrite: "Hubbard's act was not derivative of existing religion. It was structurally equivalent to the founding moves of Moses and Mohammed — but executed in 20th-century idiom. Hence the space-gods."

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# Enhanced continuation prompt for OpenAI
OPENAI_CONTINUATION_PROMPT_V2 = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

STYLE MIMICRY RULES (HIGHEST PRIORITY):
1. You MUST preserve the EXACT logical structure and reasoning style of the original
2. You MUST maintain the same paragraph structure, sentence complexity, and rhetorical patterns
3. You MUST use equivalent specialized vocabulary, formal terms, and domain-specific language
4. You MUST keep ALL conceptual nuance, philosophical depth, and argumentative density
5. DO NOT "translate" or "simplify" complex arguments - keep their original form

MANDATORY REQUIREMENTS:
1. LENGTH ENFORCEMENT: Your output MUST match 100%–110% of the original length
2. TONE PRESERVATION: Maintain or elevate the intellectual density and formality
3. STRUCTURAL INTEGRITY: Preserve ALL argument steps, logical connectors, and examples
4. STYLE MATCHING: {style_instruction}
5. NO SIMPLIFICATION: Do NOT "breezify" or flatten sophisticated content
6. CONSISTENCY: Maintain perfect continuity with previous sections

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# Enhanced formality correction prompt
ENHANCED_FORMALITY_CORRECTION_V2 = """EMERGENCY FORMALITY CORRECTION REQUIRED:

You have FAILED to preserve the formal rigor, conceptual density, and technical tone of the original document. Your rewrite has inappropriately simplified, casualized, or "breezified" sophisticated content.

MANDATORY CORRECTIONS:
1. Restore original argument structure WITHOUT simplification
2. Use formal, precise vocabulary matching the original's sophistication
3. Rebuild complex sentence structures and paragraph-by-paragraph logic 
4. Preserve all logical steps and intellectual density
5. Eliminate ALL casual language, simplifications, and journalistic style

When rewriting, you MUST:
- Replace simplified terms with precise technical vocabulary
- Restore formal academic/philosophical tone throughout
- Rebuild complex sentence structures
- Remove any invented examples or analogies
- Preserve exact logical flow and conceptual depth

Original text for tone reference:
{original_text}

Text requiring formal tone restoration (MUST match intellectual weight and density of original):
{text}"""

# Enhanced emergency length recovery prompt
EMERGENCY_LENGTH_RECOVERY_V2 = """EMERGENCY LENGTH CORRECTION REQUIRED: 

Your rewrite has FAILED to meet the length requirement. You have improperly shortened the text, losing critical details, examples, and argumentative depth.

REQUIRED CORRECTIONS:
1. Your rewrite MUST match or exceed the original text length (minimum 100%-110% of original length)
2. You MUST preserve the full intellectual structure, complexity, and philosophical depth
3. You MUST maintain the formal academic tone, precise vocabulary, and conceptual density
4. You MUST keep complete argument structure with all logical steps intact
5. You MUST NOT simplify, summarize, or "breezify" the content

Rewrite the following text again, with particular focus on:
- Using precise technical/philosophical vocabulary 
- Maintaining complex sentence structures
- Preserving ALL logical steps in arguments
- Matching or exceeding the original's sophistication level
- Adding clarity without reducing complexity

Original text for reference:
{original_text}

Text requiring comprehensive expansion (maintaining full complexity and matching original length):
{text}"""

# Smart enrichment search prompt
SMART_SEARCH_QUERY_GENERATOR = """GENERATE SEARCH QUERIES FOR CONTENT ENRICHMENT:

Analyze the following text and extract 3-5 precise search queries that would find relevant supplementary content.

QUERY REQUIREMENTS:
1. Each query should be 2-5 words long
2. Focus on specific concepts, theories, entities, or arguments from the text
3. Include specialized terminology that would yield academic or authoritative sources
4. Avoid generic terms that would return basic/introductory content
5. Target the most complex or unique aspects of the document

FORMATTING INSTRUCTIONS:
- Return ONLY the search queries, one per line
- Do NOT include explanations, numbering, or commentary
- Do NOT use quotation marks or special characters
- Provide exactly 3-5 queries, no more and no less

TEXT TO ANALYZE:
{text}"""

# Content enrichment integration prompt
ENRICHMENT_INTEGRATION_PROMPT = """INTEGRATE ENRICHMENT CONTENT WITH ORIGINAL TEXT:

CRITICAL INSTRUCTION:
You must rewrite the TARGET DOCUMENT while intelligently incorporating relevant information from the ENRICHMENT SOURCES. This is an academic/intellectual augmentation task.

MANDATORY REQUIREMENTS:
1. PRESERVE CORE TEXT: Maintain the original document's complete structure, argument flow, and tone
2. SELECTIVE INTEGRATION: Only incorporate enrichment material that genuinely enhances the original
3. SEAMLESS BLENDING: Integrate new material naturally without disrupting the original flow
4. MAINTAIN STYLE: Keep the same writing style, terminology, and formality level
5. BALANCED LENGTH: Final output should be 110-130% of original length

ENRICHMENT GUIDELINES:
- Do NOT simply append enrichment material - weave it naturally where relevant
- Preserve all original arguments while enhancing with supporting evidence
- Maintain the document's existing paragraph structure
- Do NOT simplify or "translate" complex content
- Attribution is NOT needed for integrated material

TARGET DOCUMENT:
{original_text}

ENRICHMENT SOURCES:
{enrichment_sources}

Provide only the enhanced rewritten content with no explanations."""

# Additional casual markers for more accurate formality detection
ADDITIONAL_CASUAL_MARKERS_V2 = [
    r'\bsimply put\b', r'\bin other words\b', r'\bto put it another way\b',
    r'\bto sum up\b', r'\bin summary\b', r'\bessentially\b', 
    r'\bmostly\b', r'\bmainly\b', r'\bgenerally\b', r'\boverall\b',
    r'\bin my opinion\b', r'\bI believe\b', r'\bpretty\b', r'\breally\b',
    r'\blet me\b', r'\blook at\b', r'\blet\'s consider\b', r'\blet\'s examine\b',
    r'\beasily\b', r'\bsimply\b', r'\bobviously\b', r'\bclearly\b',
    r'\bbasically\b', r'\bof course\b', r'\bneedless to say\b', r'\bas we can see\b',
    r'\bfor instance\b', r'\bfor example\b', r'\bnamely\b', r'\bsuch as\b',
    r'\bby the way\b', r'\bincidentally\b', r'\bin passing\b', r'\bon a side note\b',
    r'\banyway\b', r'\bin any case\b', r'\bin any event\b', r'\bin either case\b',
    r'\bactually\b', r'\bin fact\b', r'\bas a matter of fact\b', r'\bin reality\b',
    r'\bin truth\b', r'\bto tell the truth\b', r'\bto be honest\b', r'\bfrankly\b',
    r'\bplain and simple\b', r'\bin plain English\b', r'\bin layman\'s terms\b'
]

# Technical term preservation check patterns
TECHNICAL_TERM_MARKERS = [
    r'\b\w+ology\b', r'\b\w+istic\b', r'\b\w+ization\b', r'\b\w+ity\b',
    r'\b\w+ism\b', r'\b\w+ment\b', r'\b\w+tion\b', r'\b\w+ence\b',
    r'\b\w+ance\b', r'\b\w+ility\b', r'\b\w+ation\b', r'\b\w+iveness\b',
    r'\bvis-a-vis\b', r'\bper se\b', r'\bde facto\b', r'\ba priori\b',
    r'\ba posteriori\b', r'\bad hoc\b', r'\bin situ\b', r'\binter alia\b',
    r'\bmutatis mutandis\b', r'\bceteris paribus\b', r'\bqua\b', r'\bpace\b',
    r'\bsensu stricto\b', r'\bsine qua non\b', r'\bcui bono\b', r'\bpost hoc\b',
    r'\bid est\b', r'\be\.g\.\b', r'\bi\.e\.\b', r'\bet al\.\b', r'\betc\.\b',
    r'\bcf\.\b', r'\bviz\.\b', r'\bsc\.\b', r'\bsic\b', r'\bpassim\b',
    r'\bversus\b', r'\bvis-à-vis\b', r'\bmodus operandi\b', r'\bmodus vivendi\b',
    r'\braison d\'être\b', r'\bstatus quo\b', r'\btabula rasa\b', r'\bad infinitum\b',
    r'\breductio ad absurdum\b', r'\bin vivo\b', r'\bin vitro\b', r'\bin silico\b',
    r'\bex ante\b', r'\bex post\b', r'\bex nihilo\b', r'\bdeus ex machina\b'
]

# Smart search query generator prompt
SMART_SEARCH_QUERY_GENERATOR = """DOCUMENT ANALYSIS FOR SEARCH QUERY GENERATION

Analyze this text segment and generate 3-5 precise search queries that would retrieve relevant information to enhance and enrich this content.

INSTRUCTIONS:
1. Identify the main topics, key concepts, and specialized terminology
2. Focus on specific, technical aspects rather than general themes
3. Identify what information appears to be missing or could be enhanced
4. Format each query as a concise, specific search phrase (not questions)
5. Include technical terms, names, and precise concepts
6. Return ONLY the search queries, each on a new line
7. Do not include numbers, bullet points, or any explanations

TEXT TO ANALYZE:
{text}

SEARCH QUERIES (provide ONLY the queries, one per line):"""