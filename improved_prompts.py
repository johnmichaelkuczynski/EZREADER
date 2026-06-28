# First prompt for OpenAI (when is_first_subchunk is True)
OPENAI_FIRST_CHUNK_PROMPT = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

MANDATORY REQUIREMENTS:
1. Match or exceed the length of the original text (target 100%–110% of original length)
2. Maintain complete argument structure and paragraph-by-paragraph logic - NEVER simplify
3. Preserve or elevate the intellectual density, complexity, and tone
4. Match the sentence structure, tone, formality, and rhythm {style_instruction}
5. NEVER simplify, summarize, or "breezify" the input - maintain full logical complexity

When rewriting, you MUST:
- Use precise vocabulary that maintains intellectual rigor
- Preserve complex sentence structures and logical density
- Match or exceed the sophistication level of the original
- Maintain all logical steps, arguments, and philosophical depth
- Avoid casual language, simplification, or summarization
- Structure each paragraph to maintain complete argument flow

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# Continuation prompt for OpenAI (when is_first_subchunk is False)
OPENAI_CONTINUATION_PROMPT = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

MANDATORY REQUIREMENTS:
1. Match or exceed the length of the original text (target 100%–110% of original length)
2. Maintain complete argument structure and paragraph-by-paragraph logic - NEVER simplify
3. Preserve or elevate the intellectual density, complexity, and tone
4. Match the sentence structure, tone, formality, and rhythm {style_instruction}
5. NEVER simplify, summarize, or "breezify" the input - maintain full logical complexity
6. Maintain consistency with previous rewritten sections

When rewriting, you MUST:
- Use precise vocabulary that maintains intellectual rigor
- Preserve complex sentence structures and logical density
- Match or exceed the sophistication level of the original
- Maintain all logical steps, arguments, and philosophical depth
- Avoid casual language, simplification, or summarization

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# First prompt for Anthropic
ANTHROPIC_FIRST_CHUNK_PROMPT = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

MANDATORY REQUIREMENTS:
1. Match or exceed the length of the original text (target 100%–110% of original length)
2. Maintain complete argument structure and paragraph-by-paragraph logic - NEVER simplify
3. Preserve or elevate the intellectual density, complexity, and tone
4. Match the sentence structure, tone, formality, and rhythm {style_instruction}
5. NEVER simplify, summarize, or "breezify" the input - maintain full logical complexity

When rewriting, you MUST:
- Use precise vocabulary that maintains intellectual rigor
- Preserve complex sentence structures and logical density
- Match or exceed the sophistication level of the original
- Maintain all logical steps, arguments, and philosophical depth
- Avoid casual language, simplification, or summarization
- Structure each paragraph to maintain complete argument flow

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# Continuation prompt for Anthropic
ANTHROPIC_CONTINUATION_PROMPT = """CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

MANDATORY REQUIREMENTS:
1. Match or exceed the length of the original text (target 100%–110% of original length)
2. Maintain complete argument structure and paragraph-by-paragraph logic - NEVER simplify
3. Preserve or elevate the intellectual density, complexity, and tone
4. Match the sentence structure, tone, formality, and rhythm {style_instruction}
5. NEVER simplify, summarize, or "breezify" the input - maintain full logical complexity
6. Maintain consistency with previous rewritten sections

When rewriting, you MUST:
- Use precise vocabulary that maintains intellectual rigor
- Preserve complex sentence structures and logical density
- Match or exceed the sophistication level of the original
- Maintain all logical steps, arguments, and philosophical depth
- Avoid casual language, simplification, or summarization

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

# Emergency recovery logic prompt - to be used when output is shorter/simpler than input
EMERGENCY_RECOVERY_PROMPT = """EMERGENCY CORRECTION REQUIRED: 

The rewrite you produced has FAILED to meet the mandatory quality requirements. It was too short, too simplistic, and lost the intellectual density of the original. This is a critical rewriting failure.

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

Text requiring comprehensive rewrite (maintaining full complexity and length):
{text}"""

# Enhanced formality check prompt - use when tone check fails
ENHANCED_FORMALITY_CORRECTION = """CRITICAL FORMALITY CORRECTION REQUIRED:

You have FAILED to preserve the formal rigor, conceptual density, and technical tone of the original document. Your rewrite has inappropriately simplified, casualized, or "breezified" sophisticated content.

MANDATORY REQUIREMENTS:
1. Restore original argument structure without simplification
2. Use formal, precise vocabulary matching the original's sophistication
3. Maintain complex sentence structures and paragraph-by-paragraph logic 
4. Preserve all logical steps and intellectual density
5. Eliminate all casual language, simplifications, and journalistic style

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

# Casual language additional markers
ADDITIONAL_CASUAL_MARKERS = [
    r'\bsimply put\b', r'\bin other words\b', r'\bto put it another way\b',
    r'\bto sum up\b', r'\bin summary\b', r'\bessentially\b', 
    r'\bmostly\b', r'\bmainly\b', r'\bgenerally\b', r'\boverall\b',
    r'\bin my opinion\b', r'\bI believe\b', r'\bpretty\b', r'\breally\b',
    r'\blet me\b', r'\blook at\b', r'\blet\'s consider\b', r'\blet\'s examine\b'
]