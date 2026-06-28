// CRITICAL: Universal dollar sign elimination function
function eliminateDollarSigns(text) {
    if (!text) return text;
    
    // Apply multiple regex patterns to eliminate all dollar signs
    // Pattern 1: $1,234.56 → 1,234.56 dollars (with commas and decimals)
    text = text.replace(/\$(\d{1,3}(?:,\d{3})*\.\d{1,2})/g, '$1 dollars');
    
    // Pattern 2: $1,234 → 1,234 dollars (with commas, no decimals)
    text = text.replace(/\$(\d{1,3}(?:,\d{3})+)/g, '$1 dollars');
    
    // Pattern 3: $4.50 → 4.50 dollars (simple decimal)
    text = text.replace(/\$(\d+\.\d{1,2})/g, '$1 dollars');
    
    // Pattern 4: $5 → 5 dollars (simple integer)
    text = text.replace(/\$(\d+)/g, '$1 dollars');
    
    // Pattern 5: Any remaining standalone $ → dollars
    text = text.replace(/\$/g, 'dollars');
    
    return text;
}

document.addEventListener('DOMContentLoaded', function() {


    // Initialize chunk selection modal functionality
    const selectChunksBtn = document.getElementById('selectChunksBtn');
    if (selectChunksBtn) {
        selectChunksBtn.addEventListener('click', async () => {
            await initChunkSelectionModal();
            const modal = new bootstrap.Modal(document.getElementById('chunkSelectionModal'));
            modal.show();
        });
    }
    
    // Set up select all/deselect all buttons
    const selectAllBtn = document.getElementById('selectAllChunks');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.chunk-item-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                const chunkNumber = parseInt(checkbox.id.replace('chunk-', ''), 10);
                toggleChunkSelection(chunkNumber, true);
            });
        });
    }
    
    const deselectAllBtn = document.getElementById('deselectAllChunks');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.chunk-item-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
                const chunkNumber = parseInt(checkbox.id.replace('chunk-', ''), 10);
                toggleChunkSelection(chunkNumber, false);
            });
        });
    }
    
    // Set up invert selection button
    const invertSelectionBtn = document.getElementById('invertChunkSelection');
    if (invertSelectionBtn) {
        invertSelectionBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.chunk-item-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = !checkbox.checked;
                const chunkNumber = parseInt(checkbox.id.replace('chunk-', ''), 10);
                toggleChunkSelection(chunkNumber, checkbox.checked);
            });
        });
    }
    
    // Set up range selection functionality
    const applyRangeBtn = document.getElementById('applyChunkRange');
    if (applyRangeBtn) {
        applyRangeBtn.addEventListener('click', () => {
            const rangeInput = document.getElementById('chunkRangeInput');
            const range = rangeInput.value.trim();
            
            if (range) {
                // Parse the range
                const chunksToSelect = parseChunkRange(range);
                
                // First deselect all
                document.querySelectorAll('.chunk-item-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                    const chunkNumber = parseInt(checkbox.id.replace('chunk-', ''), 10);
                    toggleChunkSelection(chunkNumber, false);
                });
                
                // Then select only chunks in the range
                chunksToSelect.forEach(chunkNumber => {
                    const checkbox = document.getElementById(`chunk-${chunkNumber}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        toggleChunkSelection(chunkNumber, true);
                    }
                });
                
                // Show a preview of the first selected chunk
                if (chunksToSelect.length > 0) {
                    const firstChunk = allDocumentChunks.find(c => c.chunk_number === chunksToSelect[0]);
                    if (firstChunk) {
                        showChunkPreview(firstChunk);
                    }
                }
            }
        });
    }
    
    // Set up process selected chunks button
    const processSelectedBtn = document.getElementById('processSelectedChunks');
    if (processSelectedBtn) {
        processSelectedBtn.addEventListener('click', processSelectedChunksOnly);
    }
    // API Keys are automatically activated through backend admin endpoint
    // API Key Management removed from UI as this is an administrative function
    // Text copy functionality
    const copyForTtsBtn = document.getElementById('copy-for-tts-btn');
    
    if (copyForTtsBtn) {
        copyForTtsBtn.addEventListener('click', function() {
            const textToConvert = document.getElementById('outputText').value || document.getElementById('inputText').value;
            if (!textToConvert) {
                showTemporaryMessage('No text available to copy.', 'warning');
                return;
            }
            
            navigator.clipboard.writeText(textToConvert)
                .then(() => {
                    showTemporaryMessage('Text copied to clipboard!', 'success');
                })
                .catch(err => {
                    console.error('Failed to copy text:', err);
                    showTemporaryMessage('Failed to copy text. Please try selecting and copying manually.', 'danger');
                });
        });
    }
    // Initialize DOM elements
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const customInstructions = document.getElementById('customInstructions');
    const applyInstructionsBtn = document.getElementById('applyInstructionsBtn');
    const authorStyleInput = document.getElementById('authorStyle');
    const styleRewriteBtn = document.getElementById('styleRewriteBtn');
    const rewriteCompleteBtn = document.getElementById('rewriteCompleteBtn');
    const rewriteChunkBtn = document.getElementById('rewriteChunkBtn');
    const rewriteAllBtn = document.getElementById('rewriteAllBtn');
    const processingMode = document.getElementById('processingMode');
    const instructionsLabel = document.getElementById('instructionsLabel');
    // Critique & Rewrite from output elements
    const critiqueText = document.getElementById('critiqueText');
    const rewriteFromOutputBtn = document.getElementById('rewriteFromOutputBtn');
    const processingStatus = document.getElementById('processingStatus');
    const combineTargetChunkBtn = document.getElementById('combineTargetChunkBtn');
    const combineEntireDocBtn = document.getElementById('combineEntireDocBtn');
    const inputWordCount = document.getElementById('inputWordCount');
    const outputWordCount = document.getElementById('outputWordCount');
    
    // Content Source elements
    const contentSourceDropZone = document.getElementById('contentSourceDropZone');
    const contentSourceInput = document.getElementById('contentSourceInput');
    const contentSourceForm = document.getElementById('contentSourceForm');
    const contentSourceTextEntryId = document.getElementById('contentSourceTextEntryId');
    const contentSourceInfo = document.getElementById('contentSourceInfo');
    const contentSourceFilename = document.getElementById('contentSourceFilename');
    const contentSourceWordCount = document.getElementById('contentSourceWordCount');
    const contentSourceInstructions = document.getElementById('contentSourceInstructions');
    const removeContentSourceBtn = document.getElementById('removeContentSourceBtn');
    const contentSourceText = document.getElementById('contentSourceText');
    const saveContentSourceText = document.getElementById('saveContentSourceText');
    
    // Translation elements
    const translateBtn = document.getElementById('translateBtn');
    const targetLanguage = document.getElementById('targetLanguage');
    
    // Humanizer elements
    const humanizerBtn = document.getElementById('humanizerBtn');
    const humanizerEmail = document.getElementById('humanizerEmail');
    const usePersonalStyle = document.getElementById('usePersonalStyle');
    const sampleFileInput = document.getElementById('sampleFileInput');
    const uploadSampleBtn = document.getElementById('uploadSampleBtn');
    const sampleTextInput = document.getElementById('sampleTextInput');
    const saveTextSampleBtn = document.getElementById('saveTextSampleBtn');
    const samplesList = document.getElementById('samplesList');
    const clearSamplesBtn = document.getElementById('clearSamplesBtn');
    const humanizerStatus = document.getElementById('humanizerStatus');
    const noSamplesMessage = document.getElementById('noSamplesMessage');

    // Navigation elements
    const pageInput = document.getElementById('pageInput');
    const prevBtn = document.getElementById('prevChunkBtn');
    const nextBtn = document.getElementById('nextChunkBtn');
    const totalPagesSpan = document.getElementById('totalPages');

    // Chunk state variables
    let currentDocumentId = null;
    let currentChunkNumber = 1;
    let totalChunks = 1;
    let allDocumentChunks = [];
    let selectedChunks = [];

    // Error handling function
    function showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.classList.add('show');
        setTimeout(() => {
            errorDiv.classList.remove('show');
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 300);
        }, 5000);
    }

    function showSuccess(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
        successDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        successDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 4000);
    }
    
    // Direct word count display implementation - completely new approach
    function displayWordCount() {
        try {
            console.log("Running direct word count display");
            
            // Input text word count
            const inputText = document.getElementById('inputText');
            const inputWordCount = document.getElementById('inputWordCount');
            const inputBadge = inputWordCount.querySelector('.badge');
            
            // Output text word count
            const outputText = document.getElementById('outputText');
            const outputWordCount = document.getElementById('outputWordCount');
            const outputBadge = outputWordCount.querySelector('.badge');
            
            // Calculate and update input word count
            if (inputText && inputBadge) {
                const inputWords = inputTextElement.value.trim() ? inputTextElement.value.trim().split(/\s+/).length : 0;
                inputBadge.textContent = `${inputWords} words`;
                console.log(`Input word count: ${inputWords}`);
            }
            
            // Calculate and update output word count
            if (outputText && outputBadge) {
                const outputWords = outputText.value.trim() ? outputText.value.trim().split(/\s+/).length : 0;
                outputBadge.textContent = `${outputWords} words`;
                console.log(`Output word count: ${outputWords}`);
            }
        } catch (error) {
            console.error("Error in displayWordCount:", error);
        }
    }
    
    // Enhanced word counter initialization
    function initializeWordCounters() {
        try {
            console.log('Setting up word counters with direct DOM manipulation');
            
            // Run immediately to show initial counts
            displayWordCount();
            
            // Update on input changes
            document.getElementById('inputText').addEventListener('input', displayWordCount);
            document.getElementById('outputText').addEventListener('input', displayWordCount);
            
            // Run again after a short delay to catch any initial content
            setTimeout(displayWordCount, 500);
            
            // Set an interval to periodically update word counts (handles programmatic changes)
            setInterval(displayWordCount, 2000);
            
        } catch (error) {
            console.error('Error setting up word counters:', error);
        }
    }
    
    // Handle processing mode switching
    if (processingMode && instructionsLabel && customInstructions) {
        processingMode.addEventListener('change', function() {
            if (this.value === 'homework') {
                instructionsLabel.textContent = 'Additional context or guidance (optional):';
                customInstructions.placeholder = 'Optional: Provide any additional context, formatting preferences, or specific guidance. For example:\n"Show your work step by step"\n"Provide detailed explanations"\n"Use APA format for citations"';
            } else {
                instructionsLabel.textContent = 'How would you like the text rewritten?';
                customInstructions.placeholder = 'Enter your specific instructions, for example:\n\'Make it one-third the length and write it so a 15-year-old can understand it\'\n\'Rewrite this as a dialogue between a smart person and a dumb person, make the smart person sarcastic\'\n\'Simplify the language but keep all the key points\'';
            }
        });
    }
    
    // UNIVERSAL ENTER KEY FUNCTIONALITY FOR EVERY SINGLE INPUT IN THE APP
    function addEnterKeyToAllInputs() {
        // Get EVERY possible input element
        const allInputs = document.querySelectorAll('input, textarea, select');
        
        allInputs.forEach(input => {
            // Skip if already has enter listener
            if (input.hasAttribute('data-enter-added')) return;
            input.setAttribute('data-enter-added', 'true');
            
            input.addEventListener('keydown', function(e) {
                if (input.tagName.toLowerCase() === 'textarea') {
                    // For textareas: Ctrl+Enter to submit
                    if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        triggerSubmit(input);
                    }
                } else {
                    // For ALL other inputs: Enter to submit
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        triggerSubmit(input);
                    }
                }
            });
        });
    }
    
    function triggerSubmit(input) {
        // Find the closest button in multiple ways
        const form = input.closest('form');
        const container = input.closest('.card, .modal-body, .tab-pane, .input-group, .row, .col, div');
        let targetBtn = null;
        
        // Try to find button in container first
        if (container) {
            // First try common button selectors
            targetBtn = container.querySelector('button[type="submit"], .btn-primary, .btn-success, .btn-outline-success, .btn-warning');
            
            // If no button found by class, search by text content
            if (!targetBtn) {
                const buttons = container.querySelectorAll('button:not([disabled])');
                for (let btn of buttons) {
                    const btnText = btn.textContent.toLowerCase();
                    if (btnText.includes('apply') || btnText.includes('submit') || btnText.includes('send') || 
                        btnText.includes('create') || btnText.includes('generate') || btnText.includes('process') ||
                        btnText.includes('translate') || btnText.includes('rewrite') || btnText.includes('homework') ||
                        btnText.includes('critique') || btnText.includes('start')) {
                        targetBtn = btn;
                        break;
                    }
                }
            }
        }
        
        // Try form if no container button found
        if (!targetBtn && form) {
            targetBtn = form.querySelector('button[type="submit"], .btn-primary, .btn-success');
        }
        
        // Try broader search if still nothing
        if (!targetBtn) {
            const allButtons = document.querySelectorAll('button:not([disabled])');
            for (let btn of allButtons) {
                const btnText = btn.textContent.toLowerCase();
                if (btnText.includes('apply') || btnText.includes('submit') || btnText.includes('send') || 
                    btnText.includes('create') || btnText.includes('generate') || btnText.includes('process') ||
                    btnText.includes('translate') || btnText.includes('rewrite') || btnText.includes('homework') ||
                    btnText.includes('critique') || btnText.includes('start')) {
                    targetBtn = btn;
                    break;
                }
            }
        }
        
        if (targetBtn && !targetBtn.disabled) {
            targetBtn.click();
        }
    }
    
    // Run immediately and set up mutation observer for dynamic content
    addEnterKeyToAllInputs();
    
    // Watch for new elements being added to the DOM
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    // Check if the added node is an input
                    if (node.matches && (node.matches('input') || node.matches('textarea') || node.matches('select'))) {
                        if (!node.hasAttribute('data-enter-added')) {
                            node.setAttribute('data-enter-added', 'true');
                            node.addEventListener('keydown', function(e) {
                                if (node.tagName.toLowerCase() === 'textarea') {
                                    if (e.ctrlKey && e.key === 'Enter') {
                                        e.preventDefault();
                                        triggerSubmit(node);
                                    }
                                } else {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        triggerSubmit(node);
                                    }
                                }
                            });
                        }
                    }
                    // Check for inputs within the added node
                    const inputs = node.querySelectorAll('input, textarea, select');
                    inputs.forEach(input => {
                        if (!input.hasAttribute('data-enter-added')) {
                            input.setAttribute('data-enter-added', 'true');
                            input.addEventListener('keydown', function(e) {
                                if (input.tagName.toLowerCase() === 'textarea') {
                                    if (e.ctrlKey && e.key === 'Enter') {
                                        e.preventDefault();
                                        triggerSubmit(input);
                                    }
                                } else {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        triggerSubmit(input);
                                    }
                                }
                            });
                        }
                    });
                }
            });
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Function to show temporary success or info messages
    function showTemporaryMessage(message, type = 'info', duration = 5000) {
        // Create a new div for the message
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type} text-center`;
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translateX(-50%)';
        messageDiv.style.zIndex = '1000';
        messageDiv.style.padding = '15px 20px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        messageDiv.textContent = message;
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.className = 'close-btn';
        closeButton.style.position = 'absolute';
        closeButton.style.right = '10px';
        closeButton.style.top = '10px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => document.body.removeChild(messageDiv);
        messageDiv.appendChild(closeButton);
        
        // Append to body and set timeout to remove
        document.body.appendChild(messageDiv);
        setTimeout(() => {
            if (document.body.contains(messageDiv)) {
                document.body.removeChild(messageDiv);
            }
        }, duration);
    }
    
    // Progress bar management
    let processingCancelled = false;
    let processingStartTime = null;
    let processedChunksCount = 0;
    let avgTimePerChunk = 0;
    
    function showProgressBar(title, total) {
        const progressContainer = document.getElementById('progressContainer');
        const progressTitle = document.getElementById('progressTitle');
        const progressBar = document.getElementById('progressBar');
        const progressDetails = document.getElementById('progressDetails');
        const progressTimeEstimate = document.getElementById('progressTimeEstimate');
        
        // Reset progress state
        processingCancelled = false;
        processingStartTime = Date.now();
        processedChunksCount = 0;
        avgTimePerChunk = 0;
        
        // Set initial values
        progressTitle.textContent = title;
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressDetails.textContent = `Processed: 0 of ${total}`;
        progressTimeEstimate.textContent = 'Estimated time remaining: calculating...';
        
        // Show the progress container and mark as processing
        progressContainer.style.display = 'block';
        progressContainer.classList.add('processing');
        
        // Set up cancel button
        document.getElementById('cancelProcessingBtn').onclick = () => {
            processingCancelled = true;
            showTemporaryMessage('Processing cancelled by user', 'warning');
            hideProgressBar();
        };
    }
    
    function updateProgressBar(current, total) {
        if (processingCancelled) return;
        
        const progressBar = document.getElementById('progressBar');
        const progressDetails = document.getElementById('progressDetails');
        const progressTimeEstimate = document.getElementById('progressTimeEstimate');
        
        // Calculate percentage
        const percentage = Math.round((current / total) * 100);
        
        // Update progress bar
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
        
        // Update details
        progressDetails.textContent = `Processed: ${current} of ${total}`;
        
        // Calculate time estimate
        const elapsedTime = Date.now() - processingStartTime;
        processedChunksCount++;
        
        if (processedChunksCount > 0) {
            // Update running average time per chunk
            avgTimePerChunk = elapsedTime / processedChunksCount;
            
            // Estimate remaining time
            const remainingChunks = total - current;
            const estimatedRemainingTime = avgTimePerChunk * remainingChunks;
            
            // Format time estimate
            let timeEstimate;
            if (estimatedRemainingTime < 60000) {
                timeEstimate = `${Math.round(estimatedRemainingTime / 1000)} seconds`;
            } else if (estimatedRemainingTime < 3600000) {
                timeEstimate = `${Math.round(estimatedRemainingTime / 60000)} minutes`;
            } else {
                const hours = Math.floor(estimatedRemainingTime / 3600000);
                const minutes = Math.round((estimatedRemainingTime % 3600000) / 60000);
                timeEstimate = `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
            
            progressTimeEstimate.textContent = `Estimated time remaining: ${timeEstimate}`;
        }
    }
    
    function hideProgressBar() {
        const progressContainer = document.getElementById('progressContainer');
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('processing');
    }
    
    function completeProgressBar() {
        const progressBar = document.getElementById('progressBar');
        const progressTitle = document.getElementById('progressTitle');
        const progressTimeEstimate = document.getElementById('progressTimeEstimate');
        
        // Set to 100%
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        progressBar.setAttribute('aria-valuenow', 100);
        progressBar.classList.remove('progress-bar-animated');
        
        // Update title and time
        progressTitle.textContent = 'Processing Complete!';
        progressTimeEstimate.textContent = `Total time: ${formatElapsedTime(Date.now() - processingStartTime)}`;
        
        // Auto-hide after delay (shorter delay for better UX)
        setTimeout(() => {
            hideProgressBar();
        }, 1500);
        
        // Ensure the progress bar is hidden even if the timeout fails
        // This is a safety measure to prevent UI lockup
        setTimeout(() => {
            const progressContainer = document.getElementById('progressContainer');
            if (progressContainer && progressContainer.style.display !== 'none') {
                console.log('Forcing progress bar to hide after timeout');
                progressContainer.style.display = 'none';
            }
        }, 5000);
    }
    
    function formatElapsedTime(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
        if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
        
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.round((ms % 3600000) / 60000);
        return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    // File upload functionality
    function initializeFileUpload() {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        dropZone.addEventListener('click', () => fileInput.click());
    }

    async function handleFileUpload(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            loadingSpinner.style.display = 'block';
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                showError(data.error);
                return;
            }

            // Update chunk state
            currentDocumentId = data.document_id;
            currentChunkNumber = 1;
            totalChunks = data.total_chunks;

            // Update UI - display full text, not just first chunk
            inputTextElement.value = data.full_text || data.text; // Display full document text in input area
            outputText.value = '';
            updateChunkNavigation();
            
            // Trigger MathJax rendering for mathematical notation in uploaded files
            setTimeout(() => {
                console.log('Auto-triggering MathJax rendering after file upload...');
                triggerMathJaxRendering();
            }, 100);
            
            // Show message that file is loaded but not processed
            showSuccess('File uploaded successfully! Click "Process" to begin processing.');
            
            // Show document stats and upload success message
            if (data.full_document_loaded) {
                // Create a success message with document stats
                const successDiv = document.createElement('div');
                successDiv.className = 'alert alert-success';
                successDiv.style.position = 'fixed';
                successDiv.style.top = '20px';
                successDiv.style.left = '50%';
                successDiv.style.transform = 'translateX(-50%)';
                successDiv.style.zIndex = '1000';
                successDiv.style.padding = '15px 20px';
                successDiv.style.borderRadius = '5px';
                successDiv.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
                
                successDiv.innerHTML = `
                    <strong>Document Successfully Loaded!</strong>
                    <p>File: ${data.file_name}</p>
                    <p>Total Words: ${data.total_words}</p>
                    <p>Total Characters: ${data.total_chars}</p>
                    <p>Document split into ${data.total_chunks} chunks</p>
                    <p>Use the page navigation below to view all chunks</p>
                `;
                
                document.body.appendChild(successDiv);
                
                // Add close button
                const closeButton = document.createElement('button');
                closeButton.textContent = '×';
                closeButton.className = 'close-btn';
                closeButton.style.position = 'absolute';
                closeButton.style.right = '10px';
                closeButton.style.top = '10px';
                closeButton.style.background = 'none';
                closeButton.style.border = 'none';
                closeButton.style.fontSize = '20px';
                closeButton.style.cursor = 'pointer';
                closeButton.onclick = () => document.body.removeChild(successDiv);
                successDiv.appendChild(closeButton);
                
                // Auto-remove after 10 seconds
                setTimeout(() => {
                    if (document.body.contains(successDiv)) {
                        document.body.removeChild(successDiv);
                    }
                }, 10000);
            }

        } catch (error) {
            showError('Error uploading file: ' + error.message);
        } finally {
            loadingSpinner.style.display = 'none';
            fileInput.value = '';
        }
    }

    // Process text functionality
    async function processText(customInstructions = '', authorStyle = '', passedEmail = null, passedContentSourceText = null, providerPreference = null, preserveLength = true) {
        try {
            if (!inputTextElement.value.trim()) {
                showError('Please enter some text to process');
                return;
            }

            // Show progress bar instead of loading spinner
            loadingSpinner.style.display = 'none';
            showProgressBar('Processing Text', 1);
            let instructions = customInstructions.trim();
            
            // Get AI provider preference if not passed in
            if (providerPreference === null) {
                const mainAiProviderSelect = document.getElementById('mainAiProvider');
                if (mainAiProviderSelect) {
                    providerPreference = mainAiProviderSelect.value;
                }
            }

            // Add author style to instructions if provided
            if (authorStyle) {
                instructions = instructions + (instructions ? '. ' : '') +
                             `Write in the style of ${authorStyle}`;
            }
            
            // Check if personal style should be used
            const usePersonalStyleChecked = usePersonalStyle.checked;
            // Use passed email parameter if available, otherwise get from UI
            let email = passedEmail;
            if (!email && usePersonalStyleChecked) {
                email = humanizerEmail.value.trim();
            }
            
            // If personal style is requested but no email is provided, show error
            if (usePersonalStyleChecked && !email) {
                showError('Please enter your email in the Humanizer settings to use your personal style');
                loadingSpinner.style.display = 'none';
                return;
            }
            
            // Get selected target language for translation
            const selectedLanguage = targetLanguage.value;
            
            // Get content source text if available or use the one passed in
            let contentSourceText = passedContentSourceText || '';
            if (!contentSourceText) {
                try {
                    contentSourceText = await getContentSourceText();
                    console.log(`Retrieved content source text: ${contentSourceText.length} characters`);
                    
                    // If content source is available, add a note to instructions
                    if (contentSourceText && !instructions.toLowerCase().includes('content source')) {
                        instructions = instructions + (instructions ? '. ' : '') + 
                            'Use the provided content source to enrich the text.';
                    }
                } catch (error) {
                    console.warn('Error getting content source:', error);
                    // Continue without content source if there's an error
                }
            }

            let response;
            if (currentDocumentId) {
                // Process chunk
                response = await fetch('/process_chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        document_id: currentDocumentId,
                        chunk_number: currentChunkNumber,
                        custom_instructions: instructions,
                        email: usePersonalStyleChecked ? email : null,  // Include email for personal style
                        author_style: authorStyle,
                        target_language: selectedLanguage,
                        content_source: contentSourceText || null,  // Include content source if available
                        ai_provider: providerPreference,  // Include selected AI provider
                        preserve_length: preserveLength  // Include length preservation setting
                    })
                });
            } else {
                // Get processing mode
                const processingMode = document.getElementById('processingMode')?.value || 'rewrite';
                
                // Process direct text
                response = await fetch('/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: inputTextElement.value,
                        custom_instructions: instructions,
                        email: usePersonalStyleChecked ? email : null,  // Include email for personal style
                        author_style: authorStyle,
                        target_language: selectedLanguage,
                        content_source: contentSourceText || null,  // Include content source if available
                        ai_provider: providerPreference,  // Include selected AI provider
                        preserve_length: preserveLength,  // Include length preservation setting
                        processing_mode: processingMode  // Include processing mode
                    })
                });
            }

            if (!response.ok) {
                throw new Error(`Processing failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                showError(data.error);
                return;
            }

            // Update output based on response type
            console.log('Processing response data:', data);
            const resultText = data.chunk ? data.chunk.processed_chunk : data.result;
            console.log('Result text to display:', resultText ? resultText.substring(0, 200) + '...' : 'NO TEXT FOUND');
            
            outputText.value = eliminateDollarSigns(resultText || 'No processed text received');
            
            // Trigger MathJax rendering for mathematical notation
            triggerMathJaxRendering();
            
            // Update word count indicators with new function
            displayWordCount();
            
            // Mark progress as complete
            updateProgressBar(1, 1);
            completeProgressBar();

        } catch (error) {
            showError('Error processing text: ' + error.message);
            console.error('Processing error:', error);
            hideProgressBar(); // Hide progress bar on error
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    async function processAllChunks(customInstructions = '', authorStyle = '', email = null, contentSourceText = null) {
        try {
            // If there's text in the input area but no document is loaded, create a document from that text
            if (!currentDocumentId && inputTextElement.value.trim()) {
                // Show loading state
                loadingSpinner.style.display = 'block';
                if (processingStatus) {
                    processingStatus.textContent = 'Creating document from input text...';
                    processingStatus.style.display = 'block';
                }
                
                try {
                    // Create a new document from the input text
                    const response = await fetch('/extract_text', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: inputTextElement.value.trim()
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Failed to create document: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    // Update chunk state with the new document
                    currentDocumentId = data.document_id;
                    currentChunkNumber = 1;
                    totalChunks = data.total_chunks;
                    updateChunkNavigation();
                    
                    // Display a success message with document info
                    showTemporaryMessage(`Document ready: ${totalChunks} chunks created.`, 'success');
                    
                } catch (error) {
                    showError(`Error creating document: ${error.message}`);
                    loadingSpinner.style.display = 'none';
                    return;
                }
            } else if (!currentDocumentId && !inputTextElement.value.trim()) {
                showError('Please enter some text or upload a document first');
                return;
            }

            // Show the progress bar instead of the loading spinner
            loadingSpinner.style.display = 'none';
            showProgressBar('Processing Document', totalChunks);

            // Store style information to add at the beginning only
            const hasAuthorStyle = authorStyle.trim() !== '';
            const hasCustomInstructions = customInstructions.trim() !== '';
            
            // Original instructions without style (will be passed to the API)
            let instructions = customInstructions.trim();
            
            // Save the style instruction separately
            const styleInstructionText = hasAuthorStyle ? 
                (hasCustomInstructions ? `. Written in the style of ${authorStyle}` : `Written in the style of ${authorStyle}`) : '';
                
            // For API calls, we'll still include the author style
            if (authorStyle) {
                instructions = instructions + (instructions ? '. ' : '') +
                             `Write in the style of ${authorStyle}`;
            }
            
            // Check if personal style should be used
            const usePersonalStyleChecked = usePersonalStyle.checked;
            
            // Use passed email parameter if available, otherwise get from UI
            let userEmail = email;
            if (!userEmail && usePersonalStyleChecked) {
                userEmail = humanizerEmail.value.trim();
            }
            
            // If personal style is requested but no email is provided, show error
            if (usePersonalStyleChecked && !userEmail) {
                showError('Please enter your email in the Humanizer settings to use your personal style');
                loadingSpinner.style.display = 'none';
                return;
            }

            let processedText = '';
            let retryCount = 0;
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 5000;

            // Initialize progress tracking
            let currentChunk = 1;
            outputText.value = ''; // Clear output before starting

            while (currentChunk <= totalChunks && retryCount < MAX_RETRIES) {
                try {
                    // Update progress bar instead of the status text
                    updateProgressBar(currentChunk - 1, totalChunks);

                    // Get selected target language for translation
                    const selectedLanguage = targetLanguage.value;
                    
                    // Get content source text if available
                    let contentSourceText = '';
                    try {
                        contentSourceText = await getContentSourceText();
                        console.log(`Retrieved content source text for chunk ${currentChunk}: ${contentSourceText.length} characters`);
                        
                        // If content source is available, add a note to instructions
                        if (contentSourceText && !instructions.toLowerCase().includes('content source')) {
                            instructions = instructions + (instructions ? '. ' : '') + 
                                'Use the provided content source to enrich the text.';
                        }
                    } catch (error) {
                        console.warn('Error getting content source:', error);
                        // Continue without content source if there's an error
                    }
                    
                    const response = await fetch('/process_chunk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            document_id: currentDocumentId,
                            chunk_number: currentChunk,
                            custom_instructions: instructions,
                            is_first_chunk: currentChunk === 1,
                            email: usePersonalStyleChecked ? userEmail : null,  // Include email for personal style
                            author_style: authorStyle, // Include author style for consistent styling
                            target_language: selectedLanguage, // Include target language for translation
                            content_source: contentSourceText || null  // Include content source if available
                        })
                    });

                    const data = await response.json();

                    if (data.error) {
                        if (data.retry && retryCount < MAX_RETRIES) {
                            retryCount++;
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                            continue;
                        }
                        throw new Error(data.error);
                    }

                    // Append processed chunk to output
                    if (data.chunk && data.chunk.processed_chunk) {
                        let chunkText = data.chunk.processed_chunk;
                        
                        // For subsequent chunks, check for and remove style instructions anywhere in the text
                        if (currentChunk > 1 && (hasAuthorStyle || hasCustomInstructions)) {
                            // More thorough pattern matching to remove style instructions anywhere in the text
                            const styleIndicators = [
                                `style of ${authorStyle}`, 
                                `in the style of ${authorStyle}`,
                                `written in the style of ${authorStyle}`,
                                `rewritten in the style of ${authorStyle}`,
                                `as ${authorStyle} would write`,
                                `${authorStyle}'s style`,
                                `${authorStyle} style`,
                                `in ${authorStyle}'s voice`
                            ];
                            
                            // Check for style markers and remove the entire sentence containing them
                            for (const styleMarker of styleIndicators) {
                                if (chunkText.toLowerCase().includes(styleMarker.toLowerCase())) {
                                    // Find the sentence containing the style marker
                                    const sentences = chunkText.split(/(?<=[.!?])\s+/);
                                    const filteredSentences = sentences.filter(sentence => 
                                        !sentence.toLowerCase().includes(styleMarker.toLowerCase())
                                    );
                                    chunkText = filteredSentences.join(' ');
                                    break;
                                }
                            }
                        }
                        
                        // Add style instruction only to first chunk
                        if (currentChunk === 1 && (hasAuthorStyle || hasCustomInstructions)) {
                            const customText = hasCustomInstructions ? customInstructions.trim() : '';
                            const prefix = customText + (styleInstructionText ? styleInstructionText : '');
                            
                            // Check if the response already includes similar instructions
                            if (!chunkText.includes('style of') || !chunkText.includes(authorStyle)) {
                                processedText = prefix ? prefix + '.\n\n' + chunkText : chunkText;
                            } else {
                                processedText = chunkText;
                            }
                        } else {
                            processedText += (processedText ? '\n\n' : '') + chunkText;
                        }
                        
                        outputText.value = eliminateDollarSigns(processedText);
                        outputText.scrollTop = outputText.scrollHeight;
                        
                        // Trigger MathJax rendering for mathematical notation
                        setTimeout(() => {
                            console.log('Auto-triggering MathJax rendering after chunk processing...');
                            triggerMathJaxRendering();
                        }, 100);
                        
                        // Update word counts with new function
                        displayWordCount();
                    }

                    currentChunk++;
                    retryCount = 0; // Reset retry count after successful processing

                    // Short delay between chunks to prevent rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    retryCount++;
                    if (retryCount >= MAX_RETRIES) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }

            // Complete the progress bar
            completeProgressBar();

        } catch (error) {
            showError('Error processing complete text: ' + error.message);
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Navigation functions
    async function loadChunk(chunkNumber) {
        try {
            if (!currentDocumentId) return;

            loadingSpinner.style.display = 'block';
            const response = await fetch('/get_chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: currentDocumentId,
                    chunk_number: chunkNumber
                })
            });

            const data = await response.json();
            if (data.error) {
                showError(data.error);
                return false;
            }

            const chunk = data.chunk;
            inputTextElement.value = chunk.original_chunk;
            outputText.value = eliminateDollarSigns(chunk.processed_chunk || '');
            
            // Trigger MathJax rendering for mathematical notation
            setTimeout(() => {
                console.log('Auto-triggering MathJax rendering after chunk load...');
                triggerMathJaxRendering();
            }, 100);
            
            // Update word count indicators with new function
            displayWordCount();

            currentChunkNumber = chunk.chunk_number;
            totalChunks = data.total_chunks;
            updateChunkNavigation();
            return true;
        } catch (error) {
            showError('Error loading chunk: ' + error.message);
            return false;
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    function updateChunkNavigation() {
        prevBtn.disabled = currentChunkNumber <= 1;
        nextBtn.disabled = currentChunkNumber >= totalChunks;
        pageInput.value = currentChunkNumber;
        totalPagesSpan.textContent = totalChunks;
        
        // Enable/disable the select chunks button based on if we have a document with multiple chunks
        const selectChunksBtn = document.getElementById('selectChunksBtn');
        if (selectChunksBtn) {
            selectChunksBtn.disabled = !currentDocumentId || totalChunks <= 1;
        }
    }

    // Load all chunks for selection
    async function loadAllChunks() {
        if (!currentDocumentId) return [];
        
        try {
            const response = await fetch(`/get_chunk?document_id=${currentDocumentId}&all=true`);
            if (!response.ok) {
                throw new Error("Failed to fetch document chunks");
            }
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            
            return data.chunks || [];
        } catch (error) {
            console.error("Error loading all chunks:", error);
            showError(`Error loading chunks: ${error.message}`);
            return [];
        }
    }
    
    // Initialize chunk selection modal
    async function initChunkSelectionModal() {
        // Load all document chunks
        allDocumentChunks = await loadAllChunks();
        if (allDocumentChunks.length === 0) {
            showError("No chunks available for selection");
            return;
        }
        
        const chunkListContainer = document.getElementById('chunkListContainer');
        chunkListContainer.innerHTML = '';
        
        // Reset selected chunks to none
        selectedChunks = [];
        
        // Make sure tabs are properly initialized
        const rewriteTab = document.getElementById('rewrite-tab');
        const translateTab = document.getElementById('translate-tab');
        
        if (rewriteTab && translateTab) {
            // Initialize Bootstrap tabs
            const tabElements = [rewriteTab, translateTab];
            tabElements.forEach(tab => {
                tab.addEventListener('click', function(event) {
                    event.preventDefault();
                    
                    // Remove active class from all tabs
                    tabElements.forEach(t => {
                        t.classList.remove('active');
                        const targetId = t.getAttribute('data-bs-target');
                        const targetPane = document.querySelector(targetId);
                        if (targetPane) {
                            targetPane.classList.remove('show', 'active');
                        }
                    });
                    
                    // Add active class to clicked tab
                    this.classList.add('active');
                    const targetId = this.getAttribute('data-bs-target');
                    const targetPane = document.querySelector(targetId);
                    if (targetPane) {
                        targetPane.classList.add('show', 'active');
                    }
                });
            });
        }
        
        // Create chunk items
        allDocumentChunks.forEach(chunk => {
            const chunkItem = document.createElement('div');
            chunkItem.className = 'chunk-item';
            chunkItem.dataset.chunkNumber = chunk.chunk_number;
            
            // Get a preview of the chunk text (first 50 characters)
            const chunkPreview = chunk.original_chunk.substring(0, 50) + (chunk.original_chunk.length > 50 ? '...' : '');
            
            chunkItem.innerHTML = `
                <input type="checkbox" class="chunk-item-checkbox form-check-input" id="chunk-${chunk.chunk_number}">
                <label class="chunk-item-number" for="chunk-${chunk.chunk_number}">Chunk ${chunk.chunk_number}:</label>
                <span class="chunk-item-preview">${chunkPreview}</span>
            `;
            
            // Add event listeners
            chunkItem.addEventListener('click', (e) => {
                // Don't toggle checkbox when clicking directly on it (it handles itself)
                if (e.target.type !== 'checkbox') {
                    const checkbox = chunkItem.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                    toggleChunkSelection(chunk.chunk_number, checkbox.checked);
                }
                
                // Show preview of this chunk
                showChunkPreview(chunk);
                
                // Highlight active preview
                document.querySelectorAll('.chunk-item').forEach(item => {
                    item.classList.remove('active-preview');
                });
                chunkItem.classList.add('active-preview');
            });
            
            // Checkbox change event
            const checkbox = chunkItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                toggleChunkSelection(chunk.chunk_number, checkbox.checked);
            });
            
            chunkListContainer.appendChild(chunkItem);
        });
        
        // Update summary
        updateSelectedChunksSummary();
    }
    
    // Toggle chunk selection
    function toggleChunkSelection(chunkNumber, isSelected) {
        if (isSelected) {
            if (!selectedChunks.includes(chunkNumber)) {
                selectedChunks.push(chunkNumber);
            }
        } else {
            selectedChunks = selectedChunks.filter(num => num !== chunkNumber);
        }
        
        // Update selected visual state - with proper null check
        const chunkItem = document.querySelector(`.chunk-item[data-chunk-number="${chunkNumber}"]`);
        if (chunkItem && chunkItem.classList) {
            chunkItem.classList.toggle('selected', isSelected);
        }
        
        // Update summary if function exists
        if (typeof updateSelectedChunksSummary === 'function') {
            updateSelectedChunksSummary();
        }
    }
    
    // Show chunk preview
    function showChunkPreview(chunk) {
        const previewContainer = document.getElementById('chunkPreviewContent');
        previewContainer.textContent = chunk.original_chunk;
        
        // Update preview header
        const previewHeader = document.getElementById('chunkPreviewHeader');
        previewHeader.innerHTML = `
            <h6 class="m-0">Chunk ${chunk.chunk_number} Preview</h6>
            <small>(${chunk.original_chunk.split(/\s+/).length} words)</small>
        `;
    }
    
    // Update selected chunks summary
    function updateSelectedChunksSummary() {
        const summaryElement = document.getElementById('selectedChunksSummary');
        
        if (selectedChunks.length === 0) {
            summaryElement.textContent = 'No chunks selected';
            document.getElementById('processSelectedChunks').disabled = true;
            return;
        }
        
        // Sort the selected chunks for a cleaner display
        const sortedChunks = [...selectedChunks].sort((a, b) => a - b);
        
        // Create a readable representation of the selected chunks
        const ranges = [];
        let start = sortedChunks[0];
        let end = start;
        
        for (let i = 1; i < sortedChunks.length; i++) {
            if (sortedChunks[i] === end + 1) {
                end = sortedChunks[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = end = sortedChunks[i];
            }
        }
        
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        
        // Update the summary text
        summaryElement.innerHTML = `
            <strong>${selectedChunks.length} of ${allDocumentChunks.length} chunks selected:</strong> 
            ${ranges.join(', ')}
        `;
        
        // Enable the process button
        document.getElementById('processSelectedChunks').disabled = false;
    }
    
    // Parse range input
    function parseChunkRange(rangeText) {
        if (!rangeText.trim()) return [];
        
        const chunks = [];
        const parts = rangeText.split(',');
        
        for (const part of parts) {
            const trimmedPart = part.trim();
            
            if (trimmedPart.includes('-')) {
                // Handle range (e.g., "1-5")
                const [start, end] = trimmedPart.split('-').map(n => parseInt(n.trim(), 10));
                
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        if (i >= 1 && i <= totalChunks && !chunks.includes(i)) {
                            chunks.push(i);
                        }
                    }
                }
            } else {
                // Handle single number
                const num = parseInt(trimmedPart, 10);
                if (!isNaN(num) && num >= 1 && num <= totalChunks && !chunks.includes(num)) {
                    chunks.push(num);
                }
            }
        }
        
        return chunks;
    }
    
    // Process only selected chunks
    async function processSelectedChunksOnly() {
        if (selectedChunks.length === 0) {
            showError('No chunks selected for processing');
            return;
        }
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('chunkSelectionModal'));
        modal.hide();
        
        try {
            // Show loading spinner
            loadingSpinner.style.display = 'block';
            
            // Determine which tab is active (process text or translate)
            const translateTab = document.querySelector('#translate-tab');
            const isTranslateActive = translateTab && translateTab.classList ? translateTab.classList.contains('active') : false;
            
            // Get common parameters
            let email = null;
            
            // Get user's email for personal style if option is checked
            if (document.getElementById('usePersonalStyle') && 
                document.getElementById('usePersonalStyle').checked &&
                document.getElementById('humanizerEmail')) {
                email = document.getElementById('humanizerEmail').value;
            }
            
            // Get content source if available
            let contentSourceText = null;
            const contentSourceTextArea = document.getElementById('contentSourceText');
            if (contentSourceTextArea && contentSourceTextArea.value.trim()) {
                contentSourceText = contentSourceTextArea.value.trim();
            }
            
            // Get parameters based on active tab
            let customInstructions, authorStyle, aiProvider, preserveLength, sourceLanguage, targetLanguage;
            
            if (isTranslateActive) {
                // Translation tab is active - get translation parameters
                sourceLanguage = document.getElementById('chunkSourceLanguage').value;
                targetLanguage = document.getElementById('chunkTargetLanguage').value;
                
                if (!targetLanguage) {
                    showError('Please select a target language for translation');
                    loadingSpinner.style.display = 'none';
                    return;
                }
                
                // Build translation instructions
                const translationInstructions = document.getElementById('chunkTranslationInstructions').value || '';
                customInstructions = `Translate the following text from ${sourceLanguage === 'auto' ? 'its original language' : sourceLanguage} to ${targetLanguage}. ${translationInstructions}`;
                
                // Target language will be used as a parameter to the backend
                authorStyle = '';
                aiProvider = '';
                preserveLength = false; // Don't preserve length for translations
            } else {
                // Process text tab is active - get rewriting parameters
                customInstructions = document.getElementById('chunkCustomInstructions').value || '';
                authorStyle = document.getElementById('chunkAuthorStyle').value || '';
                aiProvider = document.getElementById('chunkAIProvider').value || '';
                
                // Get length preservation setting
                const preserveLengthCheckbox = document.getElementById('chunkPreserveLength');
                preserveLength = preserveLengthCheckbox ? preserveLengthCheckbox.checked : true;
                
                // Reset target language for non-translation
                targetLanguage = '';
            }
            
            // Sort chunks in ascending order for processing
            const sortedChunks = [...selectedChunks].sort((a, b) => a - b);
            
            // Show the progress bar instead of the loading spinner
            loadingSpinner.style.display = 'none';
            const progressTitle = isTranslateActive ? 'Translating Selected Chunks' : 'Processing Selected Chunks';
            showProgressBar(progressTitle, sortedChunks.length);
            
            // Initialize progress tracking
            let processedCount = 0;
            const startTime = Date.now();
            const processedChunks = new Array(allDocumentChunks.length);
            
            // Process each selected chunk
            for (let i = 0; i < sortedChunks.length; i++) {
                const chunkNumber = sortedChunks[i];
                
                // Update progress UI
                updateProgressBar(i, sortedChunks.length);
                
                if (processingCancelled) {
                    break;
                }
                
                try {
                    // Find the original chunk text
                    const originalChunk = allDocumentChunks.find(c => c.chunk_number === chunkNumber);
                    if (!originalChunk) {
                        throw new Error(`Chunk ${chunkNumber} not found`);
                    }
                    
                    // Determine if this is the first chunk for style purposes
                    const isFirstChunk = i === 0;
                    
                    // Process this chunk
                    const response = await fetch('/process_chunk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            document_id: currentDocumentId,
                            chunk_number: chunkNumber,
                            custom_instructions: customInstructions,
                            is_first_chunk: isFirstChunk,
                            email: email,
                            author_style: authorStyle,
                            content_source: contentSourceText,
                            ai_provider: aiProvider,
                            preserve_length: preserveLength,
                            target_language: targetLanguage
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    // Store the processed chunk result
                    processedChunks[chunkNumber - 1] = data.chunk.processed_chunk || originalChunk.original_chunk;
                    processedCount++;
                    
                    // Update output text area immediately with all processed chunks so far
                    const currentResult = sortedChunks
                        .filter((num, idx) => idx <= i) // Only include chunks processed so far
                        .map(num => processedChunks[num - 1] || '')
                        .filter(text => text) // Remove any empty chunks
                        .join('\n\n');
                    
                    // Update the output text area in real-time
                    outputText.value = eliminateDollarSigns(currentResult);
                    
                    // Update time estimate
                    const elapsedMs = Date.now() - startTime;
                    const msPerChunk = elapsedMs / processedCount;
                    const remainingChunks = sortedChunks.length - processedCount;
                    const estimatedRemainingMs = msPerChunk * remainingChunks;
                    
                    // Update progress details
                    const progressDetails = document.getElementById('progressDetails');
                    const progressTimeEstimate = document.getElementById('progressTimeEstimate');
                    
                    if (progressDetails) {
                        progressDetails.textContent = `Processed: ${processedCount} of ${sortedChunks.length}`;
                    }
                    
                    if (progressTimeEstimate && remainingChunks > 0) {
                        const remainingMinutes = Math.floor(estimatedRemainingMs / 60000);
                        const remainingSeconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
                        progressTimeEstimate.textContent = `Estimated time remaining: ${remainingMinutes}m ${remainingSeconds}s`;
                    }
                    
                } catch (error) {
                    console.error(`Error processing chunk ${chunkNumber}:`, error);
                    // If a chunk fails, still try to continue with the rest
                    processedChunks[chunkNumber - 1] = allDocumentChunks.find(c => c.chunk_number === chunkNumber)?.original_chunk || '';
                }
            }
            
            if (!processingCancelled) {
                // Generate result including only the selected chunks
                const result = selectedChunks.map(chunkNumber => 
                    processedChunks[chunkNumber - 1] || ''
                ).join('\n\n');
                
                // Complete progress bar
                completeProgressBar();
                
                // Display the result in the output area
                outputText.value = eliminateDollarSigns(result);
                
                // Trigger MathJax rendering automatically after processing
                setTimeout(() => {
                    console.log('Auto-triggering MathJax rendering after processing...');
                    triggerMathJaxRendering();
                }, 100);
                
                // Show success message with timing info
                const totalTimeSeconds = Math.round((Date.now() - startTime) / 1000);
                const timeMessage = totalTimeSeconds > 60 
                    ? `(took ${Math.floor(totalTimeSeconds / 60)}m ${totalTimeSeconds % 60}s)` 
                    : `(took ${totalTimeSeconds}s)`;
                
                showTemporaryMessage(`Successfully processed ${selectedChunks.length} selected chunks! ${timeMessage}`, 'success');
            } else {
                // User cancelled
                hideProgressBar();
            }
            
        } catch (error) {
            showError(`Error processing selected chunks: ${error.message}`);
            hideProgressBar();
        } finally {
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
        }
    }

    // Event Listeners
    prevBtn.addEventListener('click', () => {
        if (currentChunkNumber > 1) {
            loadChunk(currentChunkNumber - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentChunkNumber < totalChunks) {
            loadChunk(currentChunkNumber + 1);
        }
    });

    pageInput.addEventListener('change', async () => {
        let pageNum = parseInt(pageInput.value);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
        if (pageNum > totalChunks) pageNum = totalChunks;
        pageInput.value = pageNum;
        if (pageNum !== currentChunkNumber) {
            await loadChunk(pageNum);
        }
    });

    // Custom instructions handling with Enter key
    customInstructions.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {  // Use Shift+Enter for new lines
            e.preventDefault();
            processText(customInstructionsElement.value);
        }
    });

    // Humanizer functionality
    // Load writing samples when modal is opened
    document.getElementById('humanizerModal').addEventListener('show.bs.modal', (event) => {
        // Try to get email from last email used (for share feature) or session
        fetch('/get_last_email')
            .then(response => response.json())
            .then(data => {
                if (data.email) {
                    humanizerEmail.value = data.email;
                    loadWritingSamples(data.email);
                }
            })
            .catch(error => console.error('Error loading email:', error));
    });
    
    // Pre-fill email from share modal if available
    document.getElementById('shareEmail').addEventListener('change', function() {
        if (this.value && this.value.trim() !== '') {
            humanizerEmail.value = this.value;
        }
    });
    
    // Event listener for humanizer email input
    humanizerEmail.addEventListener('change', function() {
        const email = this.value.trim();
        if (email) {
            loadWritingSamples(email);
        }
    });
    
    // Function to handle adding text sample via direct paste
    async function addTextSample(email, textContent) {
        if (!email) {
            showHumanizerStatus("Please enter your email address", 'warning');
            return false;
        }
        
        if (!textContent || textContent.trim().length < 10) {
            showHumanizerStatus("Please enter at least a few sentences of text", 'warning');
            return false;
        }
        
        showHumanizerStatus("Adding text sample...", 'info');
        
        try {
            // Create FormData object to simulate file upload
            const formData = new FormData();
            // Create a text blob with the pasted content
            const textBlob = new Blob([textContent], { type: 'text/plain' });
            // Add file with a generic name - current date/time ensures uniqueness
            formData.append('file', textBlob, `pasted_sample_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
            formData.append('email', email);
            
            const response = await fetch('/api/humanizer/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                showHumanizerStatus("Text sample added successfully!", 'success');
                return true;
            } else {
                showHumanizerStatus(result.message || "Failed to add text sample", 'danger');
                return false;
            }
        } catch (error) {
            console.error("Error adding text sample:", error);
            showHumanizerStatus("An error occurred while adding your text sample", 'danger');
            return false;
        }
    }
    
    // Add text sample button
    saveTextSampleBtn.addEventListener('click', async () => {
        const email = humanizerEmail.value.trim();
        const textSample = sampleTextInput.value;
        
        // Check if email is empty and focus on it if it is
        if (!email) {
            humanizerEmail.classList.add('is-invalid');
            showHumanizerStatus('Please enter your email address first', 'warning');
            
            // Add a red border and focus on email field
            humanizerEmail.focus();
            
            // Add simple animation to draw attention to email field
            humanizerEmail.style.transition = 'transform 0.3s';
            humanizerEmail.style.transform = 'translateX(5px)';
            setTimeout(() => {
                humanizerEmail.style.transform = 'translateX(-5px)';
                setTimeout(() => {
                    humanizerEmail.style.transform = 'translateX(0)';
                }, 150);
            }, 150);
            
            return;
        } else {
            humanizerEmail.classList.remove('is-invalid');
        }
        
        // Check if text is empty
        if (!textSample || textSample.trim().length < 10) {
            sampleTextInput.classList.add('is-invalid');
            showHumanizerStatus('Please enter at least a few sentences of text', 'warning');
            sampleTextInput.focus();
            return;
        } else {
            sampleTextInput.classList.remove('is-invalid');
        }
        
        const success = await addTextSample(email, textSample);
        if (success) {
            // Clear the textarea after successful upload
            sampleTextInput.value = '';
            // Reload samples list
            loadWritingSamples(email);
            // Auto-select "Use My Personal Style" checkbox
            document.getElementById("usePersonalStyle").checked = true;
        }
    });
    
    // Upload writing sample
    uploadSampleBtn.addEventListener('click', async () => {
        const email = humanizerEmail.value.trim();
        if (!email) {
            humanizerEmail.classList.add('is-invalid');
            showHumanizerStatus('Please provide your email address first', 'warning');
            
            // Add a red border and focus on email field
            humanizerEmail.focus();
            
            // Add simple animation to draw attention to email field
            humanizerEmail.style.transition = 'transform 0.3s';
            humanizerEmail.style.transform = 'translateX(5px)';
            setTimeout(() => {
                humanizerEmail.style.transform = 'translateX(-5px)';
                setTimeout(() => {
                    humanizerEmail.style.transform = 'translateX(0)';
                }, 150);
            }, 150);
            
            return;
        } else {
            humanizerEmail.classList.remove('is-invalid');
        }
        
        const file = sampleFileInput.files[0];
        if (!file) {
            sampleFileInput.classList.add('is-invalid');
            showHumanizerStatus('Please select a file to upload', 'warning');
            return;
        } else {
            sampleFileInput.classList.remove('is-invalid');
        }
        
        try {
            loadingSpinner.style.display = 'block';
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('email', email);
            
            const response = await fetch('/api/humanizer/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                showHumanizerStatus(data.error, 'danger');
                return;
            }
            
            showHumanizerStatus('Writing sample uploaded successfully!', 'success');
            sampleFileInput.value = '';
            
            // Reload the writing samples
            loadWritingSamples(email);
            
        } catch (error) {
            showHumanizerStatus('Error uploading writing sample: ' + error.message, 'danger');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    });
    
    // Clear all writing samples
    clearSamplesBtn.addEventListener('click', async () => {
        const email = humanizerEmail.value.trim();
        if (!email) {
            humanizerEmail.classList.add('is-invalid');
            showHumanizerStatus('Please provide your email address first', 'warning');
            
            // Add a red border and focus on email field
            humanizerEmail.focus();
            
            // Add simple animation to draw attention to email field
            humanizerEmail.style.transition = 'transform 0.3s';
            humanizerEmail.style.transform = 'translateX(5px)';
            setTimeout(() => {
                humanizerEmail.style.transform = 'translateX(-5px)';
                setTimeout(() => {
                    humanizerEmail.style.transform = 'translateX(0)';
                }, 150);
            }, 150);
            
            return;
        } else {
            humanizerEmail.classList.remove('is-invalid');
        }
        
        if (!confirm('Are you sure you want to delete all your writing samples? This cannot be undone.')) {
            return;
        }
        
        try {
            loadingSpinner.style.display = 'block';
            
            const response = await fetch('/api/humanizer/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.error) {
                showHumanizerStatus(data.error, 'danger');
                return;
            }
            
            showHumanizerStatus('All writing samples cleared successfully!', 'success');
            
            // Update UI to show no samples
            samplesList.innerHTML = `
                <div class="text-center text-muted py-3" id="noSamplesMessage">
                    No writing samples uploaded yet
                </div>
            `;
            
        } catch (error) {
            showHumanizerStatus('Error clearing writing samples: ' + error.message, 'danger');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    });
    
    // Load writing samples for a user
    async function loadWritingSamples(email) {
        if (!email) return;
        
        try {
            loadingSpinner.style.display = 'block';
            
            const response = await fetch(`/api/humanizer/samples?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            
            if (data.error) {
                showHumanizerStatus(data.error, 'danger');
                return;
            }
            
            // Update UI with writing samples
            if (data.samples && data.samples.length > 0) {
                let samplesHtml = '';
                data.samples.forEach(sample => {
                    // Format the created date
                    const date = new Date(sample.created_at);
                    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                    
                    samplesHtml += `
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-1">${sample.filename}</h6>
                                <small>${formattedDate}</small>
                            </div>
                            <p class="mb-1 small">Type: ${sample.file_type ? sample.file_type.toUpperCase() : 'N/A'} | Word count: ${sample.word_count || 0}</p>
                            <p class="mb-0 small text-muted">${sample.text_content ? sample.text_content.substring(0, 100) + (sample.text_content.length > 100 ? '...' : '') : 'No preview available'}</p>
                        </div>
                    `;
                });
                
                samplesList.innerHTML = samplesHtml;
                noSamplesMessage.style.display = 'none';
            } else {
                samplesList.innerHTML = `
                    <div class="text-center text-muted py-3" id="noSamplesMessage">
                        No writing samples uploaded yet
                    </div>
                `;
            }
            
        } catch (error) {
            showHumanizerStatus('Error loading writing samples: ' + error.message, 'danger');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }
    
    // Show status message in the humanizer modal
    function showHumanizerStatus(message, type = 'info') {
        humanizerStatus.textContent = message;
        humanizerStatus.className = `alert alert-${type} mt-3`;
        humanizerStatus.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            humanizerStatus.style.display = 'none';
        }, 5000);
    }
    
    // Quick Rewrite functionality
    document.getElementById('quickRewriteBtn').addEventListener('click', () => {
        const educationLevel = document.getElementById('educationLevel').value;
        let instructions = '';
        switch(educationLevel) {
            case '15year':
                instructions = 'Rewrite this for a 15-year-old high school student';
                break;
            case 'college':
                instructions = 'Rewrite this at a college graduate level';
                break;
            case 'masters':
                instructions = "Rewrite this at a master's degree level";
                break;
            case 'phd':
                instructions = 'Rewrite this at a PhD level';
                break;
        }
        customInstructionsElement.value = instructions;
        processText(instructions);
    });

    // Author style rewrite
    // Implementation of style rewrite button using passthrough API
    styleRewriteBtn.addEventListener('click', async () => {
        if (!usePersonalStyle.checked) {
            const authorStyle = authorStyleInput.value.trim();
            if (!authorStyle) {
                showError('Please enter an author style');
                return;
            }
        }
        
        // Use our new passthrough style rewrite function
        await processStyleRewritePassthrough();
    });
    
    // Rewrite from output with critique
    // This functionality allows users to critique and regenerate text
    // directly from the output box without copying back to input
    if (rewriteFromOutputBtn) {
        rewriteFromOutputBtn.addEventListener('click', async () => {
            if (!outputText.value.trim()) {
                showError('No output text to rewrite');
                return;
            }
            
            if (!critiqueText.value.trim()) {
                showError('Please enter critique or change instructions');
                return;
            }
            
            try {
                // Show loading spinner
                loadingSpinner.style.display = 'block';
                
                // Get current email (for personal style) and author style
                const email = humanizerEmail?.value?.trim() || '';
                const authorStyle = authorStyleInput?.value?.trim() || '';
                
                // Get content source if available
                let contentSource = '';
                if (window.currentContentSource) {
                    contentSource = window.currentContentSource;
                }
                
                // Get AI provider selection if available
                const aiProviderSelect = document.getElementById('aiProvider');
                let aiProvider = '';
                if (aiProviderSelect) {
                    aiProvider = aiProviderSelect.value;
                }
                
                // Get preserve length toggle if available
                const preserveLengthToggle = document.getElementById('preserveLength');
                let preserveLength = true; // Default to true for backward compatibility
                if (preserveLengthToggle) {
                    preserveLength = preserveLengthToggle.checked;
                }
                
                // Create the request data
                const requestData = {
                    text: outputText.value,
                    critique: critiqueText.value,
                    email: email,
                    author_style: authorStyle,
                    content_source: contentSource,
                    ai_provider: aiProvider,
                    preserve_length: preserveLength
                };
                
                // Call the rewrite_from_output endpoint
                const response = await fetch('/rewrite_from_output', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                // Process the response
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to process critique rewrite');
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Update the output text with the new rewritten version
                outputText.value = data.result;
                
                // Show success message
                showTemporaryMessage('Successfully applied critique and rewrote text', 'success');
                
                // Clear the critique text for the next round of changes
                critiqueText.value = '';
                
            } catch (error) {
                console.error('Error in critique rewrite:', error);
                showError(`Error: ${error.message}`);
            } finally {
                // Hide loading spinner
                loadingSpinner.style.display = 'none';
                
                // Update word count
                displayWordCount();
            }
        });
    }

    // New function for handling passthrough style rewrites
    async function processStyleRewritePassthrough() {
        try {
            // Get the input text and author style
            const targetText = inputTextElement.value.trim();
            if (!targetText) {
                showError('Please enter some text to process');
                return;
            }
            
            // Check if we have a style sample from the "My Style" section
            // or use the author style input as a fallback
            let styleSample = '';
            const usePersonalStyleChecked = usePersonalStyle.checked;
            
            if (usePersonalStyleChecked) {
                const email = humanizerEmail.value.trim();
                if (!email) {
                    showError('Please enter your email to use your personal style');
                    return;
                }
                
                // Show loading spinner
                showLoading('Getting your writing style...');
                
                // Get the user's writing samples
                try {
                    const response = await fetch(`/api/humanizer/samples?email=${encodeURIComponent(email)}`);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to get writing samples');
                    }
                    
                    if (!data.samples || data.samples.length === 0) {
                        showError('No writing samples found. Please upload some samples first.');
                        hideLoading();
                        return;
                    }
                    
                    // Combine all samples into one text
                    styleSample = data.samples.map(sample => sample.text_content).join('\n\n');
                } catch (error) {
                    showError('Error getting writing samples: ' + error.message);
                    hideLoading();
                    return;
                }
            } else {
                // No personal style, use the author style text as a fallback instruction
                const authorStyle = authorStyleInput.value.trim();
                if (!authorStyle) {
                    showError('Please enter an author style or enable personal style');
                    return;
                }
                
                // Use a simple instruction as the style sample since we don't have actual text
                styleSample = `Please rewrite the target text in the style of ${authorStyle}.`;
            }
            
            // Show progress instead of loading spinner
            loadingSpinner.style.display = 'none';
            showProgressBar('Processing Style Rewrite', 1);
            
            // Call our passthrough API endpoint
            const response = await fetch('/style_rewrite_passthrough', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    style_sample: styleSample,
                    target_text: targetText
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process style rewrite');
            }
            
            const data = await response.json();
            
            // Hide the loading spinner and progress bar
            hideLoading();
            hideProgressBar();
            
            // Update the output text
            outputText.value = data.result;
            
            // Update word counts
            updateWordCounts();
            
            // Scroll to the output section
            outputSection.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            hideLoading();
            hideProgressBar();
            showError('Error processing style rewrite: ' + error.message);
        }
    }

    // Author style input Enter key handling
    authorStyleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const authorStyle = authorStyleInput.value.trim();
            if (authorStyle) {
                // Use our new passthrough style rewrite function
                processStyleRewritePassthrough();
            }
        }
    });

    // Button event listeners
    applyInstructionsBtn.addEventListener('click', () => {
        const selectedAuthorStyle = authorStyleInput.value.trim();
        processText(customInstructionsElement.value, selectedAuthorStyle);
    });
    
    document.getElementById('rewriteBtn').addEventListener('click', () => {
        const selectedAuthorStyle = authorStyleInput.value.trim();
        processText(customInstructionsElement.value, selectedAuthorStyle);
    });

    // Add Enter key functionality for input fields
    function addEnterKeyListener(element, buttonElement, useCtrlEnter = false) {
        if (!element || !buttonElement) return;
        element.addEventListener('keydown', function(e) {
            if (useCtrlEnter) {
                // For textareas: Ctrl+Enter to submit
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    buttonElement.click();
                }
            } else {
                // For single-line inputs: Enter to submit
                if (e.key === 'Enter') {
                    e.preventDefault();
                    buttonElement.click();
                }
            }
        });
    }

    // Get references to input elements for Enter key functionality
    const inputTextElement = document.getElementById('inputText');
    const customInstructionsElement = document.getElementById('customInstructions');
    const authorStyleElement = document.getElementById('authorStyle');
    const chunkCustomInstructionsElement = document.getElementById('chunkCustomInstructions');
    const chunkAuthorStyleElement = document.getElementById('chunkAuthorStyle');
    const rewriteInstructionsElement = document.getElementById('rewriteInstructions');
    const rewriteAuthorStyleElement = document.getElementById('rewriteAuthorStyle');
    const critiqueTextElement = document.getElementById('critiqueText');
    const chatInputElement = document.getElementById('chatInput');

    // DEDICATED HOMEWORK BUTTON - GOES STRAIGHT TO LLM
    const doHomeworkBtn = document.getElementById('doHomeworkBtn');
    
    // Add Enter key support for main input
    if (inputTextElement && doHomeworkBtn) {
        addEnterKeyListener(inputTextElement, doHomeworkBtn, true); // Ctrl+Enter for main textarea
    }
    
    // Add Enter key support for custom instructions
    if (customInstructionsElement && applyInstructionsBtn) {
        addEnterKeyListener(customInstructionsElement, applyInstructionsBtn, true); // Ctrl+Enter for textarea
    }
    
    // Add Enter key support for author style
    if (authorStyleElement && styleRewriteBtn) {
        addEnterKeyListener(authorStyleElement, styleRewriteBtn, false); // Enter for input field
    }
    
    // Add Enter key support for chunk processing
    if (chunkCustomInstructionsElement && rewriteChunkBtn) {
        addEnterKeyListener(chunkCustomInstructionsElement, rewriteChunkBtn, true); // Ctrl+Enter for textarea
    }
    if (chunkAuthorStyleElement && rewriteChunkBtn) {
        addEnterKeyListener(chunkAuthorStyleElement, rewriteChunkBtn, false); // Enter for input field
    }
    
    // Add Enter key support for rewrite instructions
    const rewriteBtn = document.getElementById('rewriteBtn');
    if (rewriteInstructionsElement && rewriteBtn) {
        addEnterKeyListener(rewriteInstructionsElement, rewriteBtn, true); // Ctrl+Enter for textarea
    }
    if (rewriteAuthorStyleElement && rewriteBtn) {
        addEnterKeyListener(rewriteAuthorStyleElement, rewriteBtn, false); // Enter for input field
    }
    
    // Add Enter key support for critique
    const submitCritiqueBtn = document.getElementById('submitCritiqueBtn');
    if (critiqueTextElement && submitCritiqueBtn) {
        addEnterKeyListener(critiqueTextElement, submitCritiqueBtn, true); // Ctrl+Enter for textarea
    }
    
    // Add Enter key support for chat (uses Enter as specified in placeholder)
    const sendBtn = document.querySelector('.chat-input-area .btn-primary');
    if (chatInputElement && sendBtn) {
        addEnterKeyListener(chatInputElement, sendBtn, false); // Enter for chat input
    }
    
    if (doHomeworkBtn) {
        doHomeworkBtn.addEventListener('click', async () => {
            const text = inputTextElement.value.trim();
            if (!text) {
                showError('Please enter text to process as homework');
                return;
            }

            try {
                // Show loading
                loadingSpinner.style.display = 'block';
                
                // Clear output text
                const outputTextArea = document.getElementById('outputText');
                if (outputTextArea) {
                    outputTextArea.value = '';
                }

                // Send directly to LLM with homework instructions
                const response = await fetch('/homework_direct', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text: text,
                        mode: 'homework'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Homework processing failed: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.error) {
                    showError(result.error);
                    return;
                }

                // Display result in output textarea
                const outputTextElement = document.getElementById('outputText');
                if (outputTextElement) {
                    outputTextElement.value = result.result;
                    
                    // Trigger MathJax rendering for mathematical notation
                    setTimeout(() => {
                        console.log('Auto-triggering MathJax rendering after homework processing...');
                        triggerMathJaxRendering();
                    }, 100);
                }
                
                showTemporaryMessage('Homework completed successfully!', 'success');

            } catch (error) {
                console.error('Homework processing error:', error);
                showError('Failed to process homework: ' + error.message);
            } finally {
                loadingSpinner.style.display = 'none';
            }
        });
    }
    
    // New rewrite buttons
    rewriteChunkBtn.addEventListener('click', async () => {
        // Get current input text and process just that chunk
        if (!inputTextElement.value.trim()) {
            showError('Please enter some text to rewrite');
            return;
        }
        
        // Show the rewrite instructions modal with the current chunk
        const rewriteModal = new bootstrap.Modal(document.getElementById('rewriteInstructionsModal'));
        
        // Set modal values
        document.getElementById('rewriteMode').value = 'chunk';
        document.getElementById('rewriteChunkNumber').value = currentChunkNumber || '1';
        
        // Pre-fill with any existing values
        document.getElementById('rewriteInstructions').value = customInstructionsElement.value || '';
        document.getElementById('rewriteAuthorStyle').value = authorStyleInput.value.trim() || '';
        document.getElementById('rewritePreserveLength').checked = true;
        
        // Show the modal
        rewriteModal.show();
    });
    
    rewriteAllBtn.addEventListener('click', async () => {
        // Check if there's any text to process
        if (!inputTextElement.value.trim() && !currentDocumentId) {
            showError('Please enter some text or upload a document first');
            return;
        }
        
        // Show the rewrite instructions modal for complete text
        const rewriteModal = new bootstrap.Modal(document.getElementById('rewriteInstructionsModal'));
        
        // Set modal values
        document.getElementById('rewriteMode').value = 'all';
        document.getElementById('rewriteChunkNumber').value = '0';
        
        // Pre-fill with any existing values
        document.getElementById('rewriteInstructions').value = customInstructionsElement.value || '';
        document.getElementById('rewriteAuthorStyle').value = authorStyleInput.value.trim() || '';
        document.getElementById('rewritePreserveLength').checked = true;
        
        // Show the modal
        rewriteModal.show();
    });
    
    // Handle submit rewrite from the modal
    document.getElementById('submitRewrite').addEventListener('click', async () => {
        // Get values from the modal
        const instructions = document.getElementById('rewriteInstructions').value;
        const selectedAuthorStyle = document.getElementById('rewriteAuthorStyle').value.trim();
        const preserveLength = document.getElementById('rewritePreserveLength').checked;
        const aiProvider = document.getElementById('rewriteAiProvider').value;
        const mode = document.getElementById('rewriteMode').value;
        const chunkNumber = parseInt(document.getElementById('rewriteChunkNumber').value) || 0;
        
        // Check if personal style should be used
        const usePersonalStyleChecked = usePersonalStyle.checked;
        let email = null;
        
        if (usePersonalStyleChecked) {
            email = humanizerEmail.value.trim();
            if (!email) {
                showError('Please enter your email in the Humanizer settings to use your personal style');
                return;
            }
        }
        
        // Try to get content source text if available
        let contentSourceText = '';
        try {
            contentSourceText = await getContentSourceText();
            console.log(`Retrieved content source text: ${contentSourceText ? contentSourceText.length : 0} characters`);
        } catch (error) {
            console.warn('Error getting content source:', error);
        }
        
        // Close the modal
        bootstrap.Modal.getInstance(document.getElementById('rewriteInstructionsModal')).hide();
        
        // Process the text based on mode
        if (mode === 'chunk') {
            // Call processText for the single chunk
            if (chunkNumber > 0) {
                currentChunkNumber = chunkNumber;
            }
            processText(instructions, selectedAuthorStyle, usePersonalStyleChecked ? email : null, contentSourceText, aiProvider, preserveLength);
        } else {
            // Process all chunks
            processAllChunks(instructions, selectedAuthorStyle, usePersonalStyleChecked ? email : null, preserveLength, aiProvider, contentSourceText);
        }
    });
    
    // Direct combine button handler
    // Function to get content source text from either hidden element, server, or text area
    async function getContentSourceText() {
        let sourceText = '';
        
        if (contentSourceInfo.style.display !== 'none') {
            try {
                // First check if we have the text content stored in our hidden element
                const contentSourceTextStore = document.getElementById('contentSourceTextStore');
                if (contentSourceTextStore && contentSourceTextStore.textContent) {
                    sourceText = contentSourceTextStore.textContent;
                    console.log(`Using stored content source text (${sourceText.length} chars)`);
                } else {
                    // If not stored locally, try to get it from the server
                    console.log("No stored text found, fetching content sources for text entry:", currentDocumentId);
                    
                    const response = await fetch(`/api/content_source/get?text_entry_id=${currentDocumentId}`);
                    if (!response.ok) {
                        throw new Error("Failed to fetch content sources");
                    }
                    
                    const data = await response.json();
                    console.log("Content source fetch response:", data);
                    
                    if (data.success && data.content_sources && data.content_sources.length > 0) {
                        // The backend returns content_sources without text_content in the list, 
                        // so we need to fetch each content source separately
                        const sources = data.content_sources;
                        console.log(`Found ${sources.length} content sources`);
                        
                        // Get the text content from the database
                        const contentSourceId = contentSourceInfo.dataset.sourceId;
                        
                        // For now, just get the file name and word count for debugging
                        const source = sources.find(s => s.id == contentSourceId);
                        if (source) {
                            console.log(`Using content source: ${source.filename} (${source.word_count} words)`);
                            
                            // Get the content source from the server
                            const response = await fetch(`/api/content_source/get_text?content_source_id=${contentSourceId}`);
                            if (response.ok) {
                                const sourceData = await response.json();
                                if (sourceData.success && sourceData.text_content) {
                                    sourceText = sourceData.text_content;
                                    console.log(`Loaded content source text from server (${sourceText.length} chars)`);
                                    
                                    // Store it for future use
                                    if (!contentSourceTextStore) {
                                        const newStore = document.createElement('div');
                                        newStore.id = 'contentSourceTextStore';
                                        newStore.style.display = 'none';
                                        document.body.appendChild(newStore);
                                        newStore.textContent = sourceText;
                                    } else {
                                        contentSourceTextStore.textContent = sourceText;
                                    }
                                    console.log("Stored fetched content for future use");
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching content sources:", error);
            }
        } 
        
        // If we still don't have sourceText from uploaded file, check for pasted text
        if (!sourceText && contentSourceText && contentSourceText.value.trim()) {
            // Use directly from textarea without saving
            sourceText = contentSourceText.value.trim();
            console.log("Using pasted text as content source");
        }
        
        return sourceText;
    }
    
    // Function to prepare common data for both combine operations
    async function prepareContentSourceCombine() {
        // Check if input text exists
        if (!inputTextElement.value.trim()) {
            showError('Please enter some target text to process');
            return null;
        }
        
        // Get content source text
        const sourceText = await getContentSourceText();
        
        if (!sourceText) {
            showError('Please add content source text either by uploading a file or pasting text');
            console.error("No content source text found");
            return null;
        }
        
        // Get the instructions
        const sourceInstructions = contentSourceInstructions.value.trim();
        
        // Get selected target language for translation
        const selectedLanguage = targetLanguage.value;
        
        // Get author style if provided
        const authorStyle = authorStyleInput.value.trim();
        
        // Check if personal style should be used
        const usePersonalStyleChecked = usePersonalStyle.checked;
        const email = usePersonalStyleChecked ? humanizerEmail.value.trim() : '';
        
        // If personal style is requested but no email is provided, show error
        if (usePersonalStyleChecked && !email) {
            showError('Please enter your email in the Humanizer settings to use your personal style');
            return null;
        }
        
        return {
            sourceText,
            sourceInstructions,
            selectedLanguage,
            authorStyle,
            email: usePersonalStyleChecked ? email : null
        };
    }
    
    // Event handler for combining current chunk with content source
    if (combineTargetChunkBtn) {
        combineTargetChunkBtn.addEventListener('click', async () => {
            try {
                console.log("Combine for current chunk button clicked");
                
                // Show loading indicator
                loadingSpinner.style.display = 'block';
                
                // Prepare common data
                const prepData = await prepareContentSourceCombine();
                if (!prepData) {
                    loadingSpinner.style.display = 'none';
                    return;
                }
                
                // Process using direct combination endpoint for current chunk only
                const response = await fetch('/combine_target_source', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target_text: inputTextElement.value, // Just the current chunk text
                        source_text: prepData.sourceText,
                        source_instructions: prepData.sourceInstructions,
                        custom_instructions: customInstructionsElement.value,
                        author_style: prepData.authorStyle,
                        email: prepData.email,
                        target_language: prepData.selectedLanguage
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Processing failed: ${response.statusText}`);
                }
                
                const data = await response.json();
                if (data.error) {
                    showError(data.error);
                    return;
                }
                
                // Update output with processed text
                outputText.value = data.result;
                
                // Hide loading indicator
                loadingSpinner.style.display = 'none';
                
                // Show success message
                showTemporaryMessage('Successfully combined current chunk with content source!', 'success');
                
            } catch (error) {
                console.error('Error combining target chunk and source:', error);
                showError(`Error: ${error.message}`);
                loadingSpinner.style.display = 'none';
            }
        });
    }
    
    // Event handler for combining entire document with content source
    if (combineEntireDocBtn) {
        combineEntireDocBtn.addEventListener('click', async () => {
            try {
                console.log("Combine for entire document button clicked");
                
                if (!currentDocumentId) {
                    showError('You need to upload a document first or enter text that was processed as multiple chunks');
                    return;
                }
                
                // Show loading indicator
                loadingSpinner.style.display = 'block';
                
                // Prepare common data
                const prepData = await prepareContentSourceCombine();
                if (!prepData) {
                    loadingSpinner.style.display = 'none';
                    return;
                }
                
                // Confirm with user if the document is large
                if (totalChunks > 2) {
                    const confirmMessage = `This will process all ${totalChunks} chunks of your document with the content source material. This may take several minutes. Do you want to continue?`;
                    if (!confirm(confirmMessage)) {
                        loadingSpinner.style.display = 'none';
                        return;
                    }
                }
                
                // Show progress container for long processing
                if (totalChunks > 1) {
                    showProgressBar('Processing Document with Content Source', totalChunks);
                }
                
                // Get all chunks of the original document first
                const allChunksResponse = await fetch(`/get_chunk?document_id=${currentDocumentId}&all=true`);
                if (!allChunksResponse.ok) {
                    throw new Error("Failed to fetch all document chunks");
                }
                
                const allChunksData = await allChunksResponse.json();
                if (allChunksData.error) {
                    throw new Error(allChunksData.error);
                }
                
                const originalChunks = allChunksData.chunks || [];
                if (originalChunks.length === 0) {
                    throw new Error("No document chunks found");
                }
                
                // Process each chunk one by one with content source
                const processedChunks = [];
                const totalChunksCount = originalChunks.length;
                
                // Handle single-chunk documents with special case
                if (totalChunksCount === 1) {
                    try {
                        console.log("Processing single-chunk document");
                        // For single chunks, use the same API endpoint as the single chunk button
                        const response = await fetch('/combine_target_source', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                target_text: originalChunks[0].original_chunk,
                                source_text: prepData.sourceText,
                                source_instructions: prepData.sourceInstructions,
                                custom_instructions: customInstructionsElement.value,
                                author_style: prepData.authorStyle,
                                email: prepData.email,
                                target_language: prepData.selectedLanguage
                            })
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Processing failed: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        
                        // Update output with processed text
                        outputText.value = data.result;
                        
                        // Trigger MathJax rendering for mathematical notation
                        setTimeout(() => {
                            console.log('Auto-triggering MathJax rendering after content source processing...');
                            triggerMathJaxRendering();
                        }, 100);
                        
                        // Hide loading indicator
                        loadingSpinner.style.display = 'none';
                        
                        // Show success message
                        showTemporaryMessage('Successfully processed document with content source!', 'success');
                        return; // Exit early after processing
                    } catch (error) {
                        console.error('Error processing single chunk document:', error);
                        // Hide loading spinner before re-throwing the error
                        loadingSpinner.style.display = 'none';
                        throw error; // Re-throw to be caught by outer try/catch
                    }
                }
                
                // Process timing variables
                const startTime = Date.now();
                let elapsedTimes = [];
                
                for (let i = 0; i < totalChunksCount; i++) {
                    const chunkStartTime = Date.now();
                    const chunkOriginalText = originalChunks[i].original_chunk;
                    
                    // Update progress UI
                    updateProgressBar(i, totalChunksCount);
                    
                    if (processingCancelled) {
                        break;
                    }
                    
                    // Process this chunk
                    try {
                        const response = await fetch('/combine_target_source', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                target_text: chunkOriginalText,
                                source_text: prepData.sourceText,
                                source_instructions: prepData.sourceInstructions,
                                custom_instructions: customInstructionsElement.value,
                                author_style: prepData.authorStyle,
                                email: prepData.email,
                                target_language: prepData.selectedLanguage
                            })
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Processing failed for chunk ${i + 1}: ${response.statusText}`);
                        }
                        
                        const data = await response.json();
                        if (data.error) {
                            throw new Error(`Error processing chunk ${i + 1}: ${data.error}`);
                        }
                        
                        // Add the processed chunk
                        processedChunks.push(data.result);
                        
                        // Update output text area in real-time with all processed chunks so far
                        const currentOutput = processedChunks.join('\n\n');
                        outputText.value = currentOutput;
                        
                        // Record how long this chunk took
                        const chunkTime = Date.now() - chunkStartTime;
                        elapsedTimes.push(chunkTime);
                        
                    } catch (error) {
                        console.error(`Error processing chunk ${i + 1}:`, error);
                        // If a chunk fails, still try to continue with the rest
                        processedChunks.push(chunkOriginalText); // Use original if processing failed
                    }
                }
                
                if (!processingCancelled) {
                    // Combine all processed chunks
                    const combinedText = processedChunks.join('\n\n');
                    
                    // Complete progress bar
                    completeProgressBar();
                    
                    // Display the result in the output area
                    outputText.value = eliminateDollarSigns(combinedText);
                    
                    // Show success message with timing info
                    const totalTimeSeconds = Math.round((Date.now() - startTime) / 1000);
                    const timeMessage = totalTimeSeconds > 60 
                        ? `(took ${Math.floor(totalTimeSeconds / 60)}m ${totalTimeSeconds % 60}s)` 
                        : `(took ${totalTimeSeconds}s)`;
                        
                    showTemporaryMessage(`Successfully processed all ${processedChunks.length} chunks with content source! ${timeMessage}`, 'success');
                } else {
                    // User cancelled
                    hideProgressBar();
                }
                
                // Hide loading spinner
                loadingSpinner.style.display = 'none';
                
            } catch (error) {
                console.error('Error processing entire document with content source:', error);
                showError(`Error: ${error.message}`);
                loadingSpinner.style.display = 'none';
                hideProgressBar();
            }
        });
    }

    document.getElementById('clearInputBtn').addEventListener('click', () => {
        inputTextElement.value = '';
        outputText.value = '';
        currentDocumentId = null;
        currentChunkNumber = 1;
        totalChunks = 1;
        updateChunkNavigation();
        displayWordCount();
    });

    // Copy button functionality
    document.getElementById('copyOutputBtn').addEventListener('click', () => {
        if (outputText.value) {
            // Copy text to clipboard using the modern Clipboard API
            navigator.clipboard.writeText(outputText.value)
                .then(() => {
                    // Show temporary success message
                    const originalText = document.getElementById('copyOutputBtn').innerHTML;
                    document.getElementById('copyOutputBtn').innerHTML = '<i class="bi bi-check"></i> Copied!';
                    document.getElementById('copyOutputBtn').classList.remove('btn-outline-success');
                    document.getElementById('copyOutputBtn').classList.add('btn-success');
                    
                    // Revert back to original text after 2 seconds
                    setTimeout(() => {
                        document.getElementById('copyOutputBtn').innerHTML = originalText;
                        document.getElementById('copyOutputBtn').classList.remove('btn-success');
                        document.getElementById('copyOutputBtn').classList.add('btn-outline-success');
                    }, 2000);
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    showError('Failed to copy text. Try selecting and copying manually.');
                });
        } else {
            showError('No text to copy.');
        }
    });
    
    document.getElementById('clearOutputBtn').addEventListener('click', () => {
        outputText.value = '';
        displayWordCount();
    });

    // Share button functionality
    document.getElementById('shareOutputBtn').addEventListener('click', async () => {
        const text = outputText.value.trim();
        
        if (!text) {
            showError('No text to share. Please process some text first.');
            return;
        }
        
        const recipientEmail = prompt('Enter the email address to share with:');
        
        if (!recipientEmail) {
            return; // User cancelled
        }
        
        if (!recipientEmail.includes('@')) {
            showError('Please enter a valid email address.');
            return;
        }
        
        const subject = prompt('Enter email subject (optional):', 'Shared Processed Text');
        
        try {
            // Show loading state
            const shareBtn = document.getElementById('shareOutputBtn');
            const originalContent = shareBtn.innerHTML;
            shareBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sending...';
            shareBtn.disabled = true;
            
            const response = await fetch('/share_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: recipientEmail,
                    text: text,
                    subject: subject || 'Shared Processed Text'
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Show success
                shareBtn.innerHTML = '<i class="bi bi-check-circle"></i> Sent!';
                shareBtn.classList.remove('btn-outline-primary');
                shareBtn.classList.add('btn-success');
                
                // Revert after 3 seconds
                setTimeout(() => {
                    shareBtn.innerHTML = originalContent;
                    shareBtn.classList.remove('btn-success');
                    shareBtn.classList.add('btn-outline-primary');
                    shareBtn.disabled = false;
                }, 3000);
                
            } else {
                throw new Error(result.error || 'Failed to share text');
            }
            
        } catch (error) {
            console.error('Share error:', error);
            showError(`Failed to share text: ${error.message}`);
            
            // Reset button
            const shareBtn = document.getElementById('shareOutputBtn');
            shareBtn.innerHTML = '<i class="bi bi-envelope"></i> Share';
            shareBtn.disabled = false;
        }
    });

    // Chat with AI functionality
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');

    // Enter key functionality for chat
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // Send chat message functionality
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', sendChatMessage);
    }

    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessageToChat('user', message);
        
        // Clear input
        chatInput.value = '';
        
        // Show loading
        const loadingMessage = addMessageToChat('assistant', 'Thinking...');
        sendChatBtn.disabled = true;
        sendChatBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sending...';

        // Get context from text boxes
        const inputText = document.getElementById('inputText').value;
        const outputText = document.getElementById('outputText').value;

        // Send to backend
        fetch('/chat_with_ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                input_text: inputText,
                output_text: outputText
            })
        })
        .then(response => response.json())
        .then(data => {
            // Remove loading message
            loadingMessage.remove();
            
            if (data.success) {
                addMessageToChat('assistant', data.response, true);
                
                // Trigger MathJax rendering for mathematical notation in chat
                setTimeout(() => {
                    console.log('Auto-triggering MathJax rendering after chat response...');
                    triggerMathJaxRendering();
                }, 100);
            } else {
                addMessageToChat('assistant', `Error: ${data.error || 'Failed to get response'}`, false);
            }
        })
        .catch(error => {
            // Remove loading message
            loadingMessage.remove();
            console.error('Chat error:', error);
            addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.', false);
        })
        .finally(() => {
            sendChatBtn.disabled = false;
            sendChatBtn.innerHTML = '<i class="bi bi-send"></i> Send';
        });
    }

    function addMessageToChat(sender, message, showSendToInput = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message mb-3`;
        
        const isUser = sender === 'user';
        const avatarClass = isUser ? 'bg-warning' : 'bg-success';
        const avatarIcon = isUser ? 'bi-person' : 'bi-robot';
        const messageBg = isUser ? '#f39c12' : '#ffffff';
        const textColor = isUser ? '#ffffff' : '#2c3e50';
        const labelColor = isUser ? '#ffffff' : '#27ae60';
        
        messageDiv.innerHTML = `
            <div class="d-flex ${isUser ? 'justify-content-end' : ''}">
                ${!isUser ? `
                    <div class="flex-shrink-0">
                        <div class="avatar ${avatarClass} text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; font-size: 18px;">
                            <i class="${avatarIcon}"></i>
                        </div>
                    </div>
                ` : ''}
                <div class="flex-grow-1 ${isUser ? 'text-end' : 'ms-3'}">
                    <div class="message-content rounded p-3 shadow-sm" style="max-width: 80%; ${isUser ? 'margin-left: auto;' : ''} background: ${messageBg}; color: ${textColor}; font-size: 16px; line-height: 1.5;">
                        <strong style="color: ${labelColor};">${isUser ? 'You:' : 'AI Assistant:'}</strong> ${message.replace(/\n/g, '<br>')}
                        ${showSendToInput ? `
                            <div class="mt-2">
                                <button class="btn btn-primary btn-sm send-to-input-btn" style="font-weight: bold;">
                                    <i class="bi bi-arrow-up-circle"></i> Send to Input Box
                                </button>
                            </div>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        
        // Add event listener for send to input button
        if (showSendToInput) {
            const sendBtn = messageDiv.querySelector('.send-to-input-btn');
            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    const inputTextArea = document.getElementById('inputText');
                    if (inputTextArea) {
                        // Clean the message by removing HTML tags and label
                        const cleanMessage = message.replace(/<[^>]*>/g, '').replace(/^AI Assistant:\s*/, '');
                        inputTextArea.value = cleanMessage;
                        showSuccess('Content sent to input box!');
                        
                        // Scroll to top to show the input area
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            }
        }
        
        return messageDiv;
    }

    // Function to send AI response to input box
    window.sendToInputBox = function(text) {
        const inputTextArea = document.getElementById('inputText');
        if (inputTextArea) {
            inputTextArea.value = text;
            inputTextArea.focus();
            
            // Update word count
            displayWordCount();
            
            // Show success feedback
            showSuccess('Content sent to input box successfully!');
            
            // Scroll to input box
            inputTextArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // Download functionality (sidebar)
    document.getElementById('downloadBtn').addEventListener('click', async () => {
        const text = outputText.value.trim();
        if (!text) {
            showError('No text to download');
            return;
        }

        const format = document.getElementById('downloadFormat').value;
        try {
            const response = await fetch(`/download/${format}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `processed_text.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showError('Error downloading file: ' + error.message);
        }
    });
    
    // Remove old download button code since we replaced with individual buttons
    
    // Print/Save as PDF button - opens browser print dialog
    document.getElementById('printToPdfBtn').addEventListener('click', () => {
        const text = outputText.value.trim();
        if (text) {
            // Create a new window with the text content for printing
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Document</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 1in; }
                        @page { margin: 1in; }
                        @media print { body { margin: 0; } }
                    </style>
                    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
                    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
                    <script>
                        window.MathJax = {
                            tex: {
                                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                                processEscapes: true
                            }
                        };
                    </script>
                </head>
                <body>
                    <div style="white-space: pre-wrap;">${text.replace(/\n/g, '<br>')}</div>
                    <script>
                        window.onload = function() {
                            setTimeout(() => {
                                if (window.MathJax && window.MathJax.typesetPromise) {
                                    window.MathJax.typesetPromise().then(() => {
                                        window.print();
                                    });
                                } else {
                                    window.print();
                                }
                            }, 1000);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            showError('No text to print');
        }
    });

    // HTML download button
    document.getElementById('downloadHtmlBtn').addEventListener('click', () => {
        const text = outputText.value.trim();
        if (text) {
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Processed Document</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Times New Roman', serif; font-size: 16px; line-height: 1.6; margin: 40px; }
        .content { max-width: 800px; margin: 0 auto; }
    </style>
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <script>
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true
            }
        };
    </script>
</head>
<body>
    <div class="content">
        <div style="white-space: pre-wrap;">${text.replace(/\n/g, '<br>')}</div>
    </div>
</body>
</html>`;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'processed_text.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            showError('No text to download');
        }
    });
    
    // Word download button
    document.getElementById('downloadWordBtn').addEventListener('click', () => {
        const text = outputText.value.trim();
        if (text) {
            downloadProcessedText('docx');
        } else {
            showError('No text to download');
        }
    });

    // LaTeX download button
    document.getElementById('downloadLatexBtn').addEventListener('click', () => {
        const text = outputText.value.trim();
        if (text) {
            downloadProcessedText('latex');
        } else {
            showError('No text to download');
        }
    });

    // TXT download button
    document.getElementById('downloadTxtBtn').addEventListener('click', () => {
        const text = outputText.value.trim();
        if (text) {
            const blob = new Blob([text], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'processed_text.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            showError('No text to download');
        }
    });
    
    // Function to download the processed text
    async function downloadProcessedText(specificFormat = null) {
        const text = outputText.value.trim();
        if (!text) {
            showError('No text to download');
            return;
        }

        // Use the specified format or fall back to the dropdown selection
        const format = specificFormat || document.getElementById('outputDownloadFormat').value || 'pdf';
        try {
            const response = await fetch(`/download/${format}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `processed_text.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // Hide the format selector after download
            document.getElementById('downloadFormatSelector').style.display = 'none';
        } catch (error) {
            showError('Error downloading file: ' + error.message);
        }
    }

    // Initialize upload handling
    initializeFileUpload();
    
    // Initialize word counters
    initializeWordCounters();
    
    // Initialize content source upload handling
    initializeContentSourceUpload();
    
    // Comprehensive Search functionality
    const startComprehensiveSearchBtn = document.getElementById('startComprehensiveSearch');
    if (startComprehensiveSearchBtn) {
        startComprehensiveSearchBtn.addEventListener('click', async () => {
            await performComprehensiveSearch();
        });
    }

    if (rewriteCompleteBtn) {
        rewriteCompleteBtn.addEventListener('click', () => {
            const confirmed = confirm('This will rewrite all chunks and may take several minutes. Do you want to continue?');
            if (confirmed) {
                processAllChunks(customInstructionsElement.value, authorStyleInput.value);
            }
        });
    }

    // Add these event listeners and functions after the existing ones
    // Detect AI button in the output section
    const detectAiBtn = document.getElementById('detectAiBtn');
    if (detectAiBtn) {
        detectAiBtn.addEventListener('click', async () => {
            const text = outputText.value || inputTextElement.value;
            if (!text.trim()) {
                showError('Please enter or process some text first');
                return;
            }

            try {
                loadingSpinner.style.display = 'block';
                const response = await fetch('/detect_ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });

                if (!response.ok) {
                    throw new Error(`AI detection failed: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.error) {
                    showError(result.error);
                    return;
                }
            

                const resultDiv = document.getElementById('aiDetectionResult');
                if (resultDiv) {
                    // Determine alert color based on the classification
                    let alertClass = 'alert-info';
                    let progressClass = 'bg-info';
                    
                    if (result.document_class === 'ai') {
                        alertClass = 'alert-warning';
                        progressClass = 'bg-warning';
                    } else if (result.document_class === 'human') {
                        alertClass = 'alert-success';
                        progressClass = 'bg-success';
                    } else if (result.document_class === 'mixed') {
                        alertClass = 'alert-primary';
                        progressClass = 'bg-primary';
                    }
                    
                    // Format scores for display
                    const aiScore = result.ai_score || 0;
                    const humanScore = result.human_probability || 0;
                    const mixedScore = result.mixed_probability || 0;
                    
                    // Create a timestamp to show when the detection was performed
                    const timestamp = new Date().toLocaleTimeString();
                    
                    resultDiv.innerHTML = `
                        <div class="alert ${alertClass} dismissible-alert">
                            <div class="d-flex justify-content-between align-items-start">
                                <strong>AI Content Detection Results</strong>
                                <span class="text-muted small">${timestamp}</span>
                                <button class="btn btn-sm btn-link text-dark minimize-btn" onclick="toggleAIResults(this)">
                                    <i class="bi bi-dash"></i>
                                </button>
                            </div>
                            <div class="ai-results-content mt-2">
                                <div class="card mb-3">
                                    <div class="card-body">
                                        <h6 class="card-subtitle mb-2 text-muted">Analysis Summary</h6>
                                        <p class="mb-1"><strong>${result.conclusion || 'Analysis complete.'}</strong></p>
                                        <p class="text-muted small mb-0">Based on analysis of ${result.sentence_count || '?'} sentences.</p>
                                    </div>
                                </div>
                                
                                <h6 class="mt-3">Probability Scores</h6>
                                <div class="mb-2">
                                    <div class="d-flex justify-content-between">
                                        <span>AI-generated</span>
                                        <span>${aiScore}%</span>
                                    </div>
                                    <div class="progress" style="height: 10px;">
                                        <div class="progress-bar bg-warning" role="progressbar" style="width: ${aiScore}%" 
                                            aria-valuenow="${aiScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>
                                
                                <div class="mb-2">
                                    <div class="d-flex justify-content-between">
                                        <span>Human-written</span>
                                        <span>${humanScore}%</span>
                                    </div>
                                    <div class="progress" style="height: 10px;">
                                        <div class="progress-bar bg-success" role="progressbar" style="width: ${humanScore}%" 
                                            aria-valuenow="${humanScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between">
                                        <span>Mixed content</span>
                                        <span>${mixedScore}%</span>
                                    </div>
                                    <div class="progress" style="height: 10px;">
                                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${mixedScore}%" 
                                            aria-valuenow="${mixedScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>
                                
                                <div class="d-flex justify-content-end mt-2">
                                    <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('aiDetectionResult').style.display='none'">
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    resultDiv.style.display = 'block';

                    // Add click handler to dismiss the alert
                    const alert = resultDiv.querySelector('.alert');
                    alert.addEventListener('click', function(e) {
                        // Don't dismiss if clicking the minimize button
                        if (!e.target.closest('.minimize-btn')) {
                            resultDiv.style.display = 'none';
                        }
                    });
                }


                // Add toggle function for AI results
                if (!window.toggleAIResults) {
                    window.toggleAIResults = function(btn) {
                        const content = btn.closest('.alert').querySelector('.ai-results-content');
                        const icon = btn.querySelector('i');
                        if (content.style.display === 'none') {
                            content.style.display = 'block';
                            icon.className = 'bi bi-dash';
                        } else {
                            content.style.display = 'none';
                            icon.className = 'bi bi-plus';
                        }
                    };
                }

            } catch (error) {
                showError('Error detecting AI content: ' + error.message);
            } finally {
                loadingSpinner.style.display = 'none';
            }
        });
    }
    
    // Input text AI detection button
    const detectInputAiBtn = document.getElementById('detectInputAiBtn');
    if (detectInputAiBtn) {
        detectInputAiBtn.addEventListener('click', async () => {
            const text = inputTextElement.value;
            if (!text.trim()) {
                showError('Please enter some text first');
                return;
            }

            try {
                loadingSpinner.style.display = 'block';
                const response = await fetch('/detect_ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });

                if (!response.ok) {
                    throw new Error(`AI detection failed: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.error) {
                    showError(result.error);
                    return;
                }

                const resultDiv = document.getElementById('aiDetectionResult');
                if (resultDiv) {
                    // Determine alert color based on the classification
                    let alertClass = 'alert-info';
                    let progressClass = 'bg-info';
                    
                    if (result.document_class === 'ai') {
                        alertClass = 'alert-warning';
                        progressClass = 'bg-warning';
                    } else if (result.document_class === 'human') {
                        alertClass = 'alert-success';
                        progressClass = 'bg-success';
                    } else if (result.document_class === 'mixed') {
                        alertClass = 'alert-primary';
                        progressClass = 'bg-primary';
                    }
                    
                    // Format scores for display
                    const aiScore = result.ai_score || 0;
                    const humanScore = result.human_probability || 0;
                    const mixedScore = result.mixed_probability || 0;
                    
                    // Create a timestamp to show when the detection was performed
                    const timestamp = new Date().toLocaleTimeString();
                    
                    resultDiv.innerHTML = `
                        <div class="alert ${alertClass} dismissible-alert">
                            <div class="d-flex justify-content-between align-items-start">
                                <strong>AI Content Detection Results (Input Text)</strong>
                                <span class="text-muted small">${timestamp}</span>
                                <button class="btn btn-sm btn-link text-dark minimize-btn" onclick="toggleAIResults(this)">
                                    <i class="bi bi-dash"></i>
                                </button>
                            </div>
                            <div class="ai-results-content mt-2">
                                <div class="card mb-3">
                                    <div class="card-body">
                                        <h6 class="card-subtitle mb-2 text-muted">Analysis Summary</h6>
                                        <p class="mb-1"><strong>${result.conclusion || 'Analysis complete.'}</strong></p>
                                        <p class="text-muted small mb-0">Based on analysis of ${result.sentence_count || '?'} sentences.</p>
                                    </div>
                                </div>
                                
                                <h6 class="mt-3">Probability Scores</h6>
                                <div class="mb-2">
                                    <div class="d-flex justify-content-between">
                                        <span>AI-generated</span>
                                        <span>${aiScore}%</span>
                                    </div>
                                    <div class="progress" style="height: 10px;">
                                        <div class="progress-bar bg-warning" role="progressbar" style="width: ${aiScore}%" 
                                            aria-valuenow="${aiScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>
                                
                                <div class="mb-2">
                                    <div class="d-flex justify-content-between">
                                        <span>Human-written</span>
                                        <span>${humanScore}%</span>
                                    </div>
                                    <div class="progress" style="height: 10px;">
                                        <div class="progress-bar bg-success" role="progressbar" style="width: ${humanScore}%" 
                                            aria-valuenow="${humanScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <div class="d-flex justify-content-between">
                                        <span>Mixed content</span>
                                        <span>${mixedScore}%</span>
                                    </div>
                                    <div class="progress" style="height: 10px;">
                                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${mixedScore}%" 
                                            aria-valuenow="${mixedScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                    </div>
                                </div>
                                
                                <div class="d-flex justify-content-end mt-2">
                                    <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('aiDetectionResult').style.display='none'">
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    resultDiv.style.display = 'block';

                    // Add click handler to dismiss the alert
                    const alert = resultDiv.querySelector('.alert');
                    alert.addEventListener('click', function(e) {
                        // Don't dismiss if clicking the minimize button
                        if (!e.target.closest('.minimize-btn')) {
                            resultDiv.style.display = 'none';
                        }
                    });
                }

            } catch (error) {
                showError('Error detecting AI content: ' + error.message);
            } finally {
                loadingSpinner.style.display = 'none';
            }
        });
    }
    
    // Email Share Functionality
    const shareBtn = document.getElementById('shareBtn');
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    
    if (shareBtn && sendEmailBtn) {
        // Auto-fill last used email when opening the share modal
        shareBtn.addEventListener('click', function() {
            // Fetch the last email from session if available using a lightweight API call
            fetch('/get_last_email')
                .then(response => response.json())
                .then(data => {
                    if (data.email) {
                        document.getElementById('shareEmail').value = data.email;
                    }
                })
                .catch(error => console.error('Error fetching last email:', error));
        });
        
        sendEmailBtn.addEventListener('click', async function() {
            try {
                const emailInput = document.getElementById('shareEmail');
                const subjectInput = document.getElementById('shareSubject');
                const shareStatus = document.getElementById('shareStatus');
                
                const email = emailInput.value.trim();
                const subject = subjectInput.value.trim() || 'Your Rewritten Text';
                const text = outputText.value.trim();
                
                if (!email) {
                    shareStatus.textContent = 'Please enter an email address.';
                    shareStatus.className = 'alert alert-danger';
                    shareStatus.style.display = 'block';
                    return;
                }
                
                if (!text) {
                    shareStatus.textContent = 'There is no processed text to share.';
                    shareStatus.className = 'alert alert-danger';
                    shareStatus.style.display = 'block';
                    return;
                }
                
                // Show loading state
                shareStatus.textContent = 'Sending email...';
                shareStatus.className = 'alert alert-info';
                shareStatus.style.display = 'block';
                sendEmailBtn.disabled = true;
                
                // Send to backend
                const response = await fetch('/share_rewrite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        text: text,
                        subject: subject
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Success message
                    shareStatus.textContent = 'Email sent successfully!';
                    shareStatus.className = 'alert alert-success';
                    
                    // Reset form after a delay
                    setTimeout(() => {
                        emailInput.value = '';
                        subjectInput.value = '';
                        
                        // Auto close modal after 2 seconds
                        setTimeout(() => {
                            const modal = bootstrap.Modal.getInstance(document.getElementById('shareModal'));
                            if (modal) modal.hide();
                            shareStatus.style.display = 'none';
                        }, 2000);
                    }, 1000);
                } else {
                    // Error message
                    shareStatus.textContent = data.error || 'Failed to send email. Please try again.';
                    shareStatus.className = 'alert alert-danger';
                }
            } catch (error) {
                console.error('Error sharing text:', error);
                const shareStatus = document.getElementById('shareStatus');
                shareStatus.textContent = 'Error: ' + error.message;
                shareStatus.className = 'alert alert-danger';
                shareStatus.style.display = 'block';
            } finally {
                sendEmailBtn.disabled = false;
            }
        });
        
        // Reset share form when modal is closed
        document.getElementById('shareModal').addEventListener('hidden.bs.modal', function () {
            document.getElementById('shareStatus').style.display = 'none';
            document.getElementById('shareEmail').value = '';
            document.getElementById('shareSubject').value = '';
        });
    }

    // Content source upload handling
    function initializeContentSourceUpload() {
        if (!contentSourceDropZone || !contentSourceInput) return;
        
        // Event listeners for the content source upload zone
        contentSourceDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            contentSourceDropZone.classList.add('dragover');
        });
        
        contentSourceDropZone.addEventListener('dragleave', () => {
            contentSourceDropZone.classList.remove('dragover');
        });
        
        contentSourceDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            contentSourceDropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                handleContentSourceUpload(file);
            }
        });
        
        contentSourceDropZone.addEventListener('click', () => contentSourceInput.click());
        
        contentSourceInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleContentSourceUpload(file);
            }
        });
        
        // Handle direct text input for content source
        if (saveContentSourceText) {
            saveContentSourceText.addEventListener('click', async () => {
                if (!contentSourceText || contentSourceText.value.trim() === '') {
                    showError('Please enter some text for the content source');
                    return;
                }
                
                handleContentSourceText(contentSourceText.value);
            });
        }
        
        // Handle clear content source text button
        const clearContentSourceTextBtn = document.getElementById('clearContentSourceText');
        if (clearContentSourceTextBtn) {
            clearContentSourceTextBtn.addEventListener('click', () => {
                if (contentSourceText) {
                    contentSourceText.value = '';
                    showTemporaryMessage('Content source text cleared', 'info');
                }
            });
        }
        
        // Handle clear content source instructions button
        const clearContentSourceInstructionsBtn = document.getElementById('clearContentSourceInstructions');
        if (clearContentSourceInstructionsBtn) {
            clearContentSourceInstructionsBtn.addEventListener('click', () => {
                if (contentSourceInstructions) {
                    contentSourceInstructions.value = '';
                    showTemporaryMessage('Content source instructions cleared', 'info');
                }
            });
        }
        
        // Handle removing the content source
        if (removeContentSourceBtn) {
            removeContentSourceBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const contentSourceId = contentSourceInfo.dataset.sourceId;
                if (!contentSourceId) {
                    contentSourceInfo.style.display = 'none';
                    return;
                }
                
                try {
                    const response = await fetch('/api/content_source/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content_source_id: contentSourceId })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        contentSourceInfo.style.display = 'none';
                        contentSourceInfo.dataset.sourceId = '';
                        showTemporaryMessage('Content source removed', 'info');
                    } else {
                        showError(data.error || 'Failed to remove content source');
                    }
                } catch (error) {
                    console.error('Error removing content source:', error);
                    showError('Error removing content source');
                }
            });
        }
        
        // Handle content source instructions changes
        if (contentSourceInstructions) {
            contentSourceInstructions.addEventListener('change', async () => {
                const contentSourceId = contentSourceInfo.dataset.sourceId;
                if (!contentSourceId) return;
                
                try {
                    const response = await fetch('/api/content_source/save_instructions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content_source_id: contentSourceId,
                            usage_instructions: contentSourceInstructions.value
                        })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        showTemporaryMessage('Content source instructions saved', 'success');
                    } else {
                        showError(data.error || 'Failed to save instructions');
                    }
                } catch (error) {
                    console.error('Error saving instructions:', error);
                    showError('Error saving instructions');
                }
            });
        }
    }
    
    async function handleContentSourceUpload(file) {
        try {
            console.log("Starting content source upload for file:", file.name);
            loadingSpinner.style.display = 'block';
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // If we have a document ID, include it, but it's not required anymore
            if (currentDocumentId) {
                formData.append('text_entry_id', currentDocumentId);
                console.log("Adding text_entry_id:", currentDocumentId);
            }
            
            // Add instructions if available
            if (contentSourceInstructions && contentSourceInstructions.value) {
                formData.append('usage_instructions', contentSourceInstructions.value);
                console.log("Adding instructions with length:", contentSourceInstructions.value.length);
            }
            
            // Log FormData (can't directly log the object)
            console.log("FormData created with file:", file.name);
            
            // Upload the file
            console.log("Sending upload request to /api/content_source/upload");
            const response = await fetch('/api/content_source/upload', {
                method: 'POST',
                body: formData
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText} (${response.status})`);
            }
            
            const data = await response.json();
            console.log("Response data:", data);
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // Update UI
            if (data.success && data.content_source) {
                const source = data.content_source;
                console.log("Content source uploaded successfully:", source);
                
                // Update content source info display
                contentSourceFilename.textContent = source.filename;
                contentSourceWordCount.textContent = source.word_count;
                contentSourceInfo.style.display = 'block';
                contentSourceInfo.dataset.sourceId = source.id;
                
                // Store the text content in a hidden element for later use
                if (source.text_content) {
                    console.log(`Received text_content with length: ${source.text_content.length}`);
                    
                    // Create a hidden element to store the text content if it doesn't exist
                    let contentSourceTextStore = document.getElementById('contentSourceTextStore');
                    if (!contentSourceTextStore) {
                        contentSourceTextStore = document.createElement('div');
                        contentSourceTextStore.id = 'contentSourceTextStore';
                        contentSourceTextStore.style.display = 'none';
                        document.body.appendChild(contentSourceTextStore);
                    }
                    
                    // Store the text content
                    contentSourceTextStore.textContent = source.text_content;
                    console.log("Stored content source text in hidden element");
                } else {
                    console.warn("No text_content received in the response");
                }
                
                showTemporaryMessage('Content source uploaded successfully', 'success');
            } else {
                // This is a safeguard in case the server returns success without the expected data
                console.error("Unexpected response format:", data);
                showError('The server returned an unexpected response format. Please try again.');
            }
            
        } catch (error) {
            showError('Error uploading content source: ' + error.message);
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }
    
    async function handleContentSourceText(text) {
        try {
            console.log("Starting content source text save");
            loadingSpinner.style.display = 'block';
            
            // Create the request data
            const requestData = {
                text_content: text,
                filename: 'pasted_content.txt'
            };
            
            // If we have a document ID, include it
            if (currentDocumentId) {
                requestData.text_entry_id = currentDocumentId;
                console.log("Adding text_entry_id:", currentDocumentId);
            }
            
            // Add instructions if available
            if (contentSourceInstructions && contentSourceInstructions.value) {
                requestData.usage_instructions = contentSourceInstructions.value;
                console.log("Adding instructions with length:", contentSourceInstructions.value.length);
            }
            
            console.log("Request data prepared:", {
                text_length: text.length,
                has_text_entry_id: !!currentDocumentId,
                has_instructions: !!(contentSourceInstructions && contentSourceInstructions.value)
            });
            
            // Send the text content to a new API endpoint
            console.log("Sending text save request to /api/content_source/save_text");
            const response = await fetch('/api/content_source/save_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to save text: ${response.statusText} (${response.status})`);
            }
            
            const data = await response.json();
            console.log("Response data:", data);
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // Update UI
            if (data.success && data.content_source) {
                const source = data.content_source;
                console.log("Content source text saved successfully:", source);
                
                // Update content source info display
                contentSourceFilename.textContent = source.filename;
                contentSourceWordCount.textContent = source.word_count;
                contentSourceInfo.style.display = 'block';
                contentSourceInfo.dataset.sourceId = source.id;
                
                // Store the original text content in a hidden element for later use
                const originalText = requestData.text_content;
                if (originalText) {
                    // Create a hidden element to store the text content if it doesn't exist
                    let contentSourceTextStore = document.getElementById('contentSourceTextStore');
                    if (!contentSourceTextStore) {
                        contentSourceTextStore = document.createElement('div');
                        contentSourceTextStore.id = 'contentSourceTextStore';
                        contentSourceTextStore.style.display = 'none';
                        document.body.appendChild(contentSourceTextStore);
                    }
                    
                    // Store the text content
                    contentSourceTextStore.textContent = originalText;
                    console.log(`Stored pasted content source text (${originalText.length} chars)`);
                }
                
                // Clear the text area
                if (contentSourceText) {
                    contentSourceText.value = '';
                }
                
                showTemporaryMessage('Content source saved successfully', 'success');
            } else {
                // This is a safeguard in case the server returns success without the expected data
                console.error("Unexpected response format:", data);
                showError('The server returned an unexpected response format. Please try again.');
            }
            
        } catch (error) {
            showError('Error saving content source text: ' + error.message);
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }
    
    // Document length mode info updates
    function updateTranslationModeInfo() {
        const language = targetLanguage.value;
        const translationModeInfo = document.getElementById('translationModeInfo');
        const advancedTranslationOptions = document.getElementById('advancedTranslationOptions');
        
        // Get the selected mode
        const shortMode = document.getElementById('shortDocumentMode').checked;
        const fullMode = document.getElementById('fullDocumentMode').checked;
        const advancedMode = document.getElementById('advancedChunkingMode').checked;
        
        // Show/hide advanced options
        if (advancedMode) {
            advancedTranslationOptions.style.display = 'block';
            translationModeInfo.innerHTML = '<i class="bi bi-info-circle"></i> Advanced mode: For very large documents (20,000-500,000 words). Uses our advanced chunking protocol with enhanced reliability.';
        } else {
            advancedTranslationOptions.style.display = 'none';
            
            if (shortMode) {
                translationModeInfo.innerHTML = '<i class="bi bi-info-circle"></i> Standard mode: Best for documents under 2,000 words. Supports all languages via OpenAI or DeepL.';
            } else {
                translationModeInfo.innerHTML = '<i class="bi bi-info-circle"></i> Full mode: For larger documents (2,000-20,000 words). Uses DeepL for supported languages, OpenAI for others.';
            }
        }
    }
    
    // Initialize document length mode radio buttons
    const documentLengthModes = document.querySelectorAll('input[name="documentLengthMode"]');
    documentLengthModes.forEach(radio => {
        radio.addEventListener('change', updateTranslationModeInfo);
    });
    
    // Initialize translation functionality
    if (translateBtn) {
        // Initialize mode info on page load
        updateTranslationModeInfo();
        
        // Set up click event for translate button
        translateBtn.addEventListener('click', async function() {
            try {
                // Get the input text and target language
                const text = inputTextElement.value.trim();
                const language = targetLanguage.value;
                const documentLengthMode = document.querySelector('input[name="documentLengthMode"]:checked').value;
                
                if (!text) {
                    showError('Please enter some text to translate');
                    return;
                }
                
                if (language === 'en') {
                    showTemporaryMessage('No translation needed for English', 'info');
                    return;
                }
                
                // Show progress
                loadingSpinner.style.display = 'block';
                showProgressBar('Translating document...', 1);
                
                let response;
                
                // Use the appropriate endpoint based on the translation mode
                if (documentLengthMode === 'advanced') {
                    // Get the selected translation API
                    const translationApi = document.getElementById('translationApi').value;
                    
                    // Use the specialized large document translation endpoint
                    showProgressBar('Initializing advanced translation protocol...', 1);
                    
                    // Calculate approximate number of chunks based on word count (for progress estimation)
                    const wordCount = text.split(/\s+/).length;
                    const estimatedChunks = Math.ceil(wordCount / 500); // ~500 words per chunk
                    
                    // Update progress bar with more detailed information
                    const progressTitle = document.getElementById('progressTitle');
                    const progressStatus = document.getElementById('processingStatus');
                    progressTitle.textContent = 'Advanced Translation Protocol';
                    progressStatus.textContent = `Analyzing document structure (${wordCount.toLocaleString()} words)`;
                    
                    // Set up polling for translation progress - we'll do this later when we implement streaming progress
                    
                    response = await fetch('/translate_large_document', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            text: text,
                            target_language: language,
                            translation_api: translationApi
                        })
                    });
                    
                    // Show completion in progress bar
                    progressStatus.textContent = 'Final assembly and validation...';
                } else {
                    // Use the standard translation endpoint
                    response = await fetch('/translate_only', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            text: text,
                            target_language: language,
                            document_length_mode: documentLengthMode
                        })
                    });
                }
                
                // Update progress
                updateProgressBar(1, 1);
                
                // Check if response is valid JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    // If we got HTML instead of JSON, show a user-friendly error
                    throw new Error('Translation failed: document too long or server overloaded. Try using a smaller document or the "full document" mode.');
                }
                
                if (!response.ok) {
                    try {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Translation request failed');
                    } catch (jsonError) {
                        // If JSON parsing fails, provide a clearer error message
                        throw new Error('Translation failed: received invalid response from server. Please try again with a smaller document.');
                    }
                }
                
                let data;
                try {
                    data = await response.json();
                } catch (jsonError) {
                    throw new Error('Failed to parse translation response. The document might be too large or the server might be overloaded.');
                }
                
                // Show translation engine and statistics
                const engineIndicator = document.getElementById('engineIndicator');
                const translationEngine = document.getElementById('translationEngine');
                
                if (documentLengthMode === 'advanced' && data.metadata) {
                    // For advanced mode, show detailed metadata
                    const metadata = data.metadata;
                    translationEngine.textContent = metadata.translation_engine.toUpperCase() + ' (Advanced)';
                    engineIndicator.style.display = 'inline-block';
                    
                    // Show detailed success message with stats
                    const chunks = metadata.chunks_total || 0;
                    const retries = metadata.chunks_retried || 0;
                    const timeStr = metadata.elapsed_seconds ? `${metadata.elapsed_seconds}s` : '';
                    const speed = metadata.words_per_second ? `${metadata.words_per_second} words/sec` : '';
                    
                    showTemporaryMessage(
                        `Translation complete: ${chunks} chunks processed with ${retries} retries. ${timeStr} (${speed})`, 
                        'success',
                        8000 // Show for 8 seconds for detailed stats
                    );
                } else if (data.engine) {
                    // For standard mode, just show the engine
                    translationEngine.textContent = data.engine;
                    engineIndicator.style.display = 'inline-block';
                    
                    // Show simple success message
                    showTemporaryMessage(`Successfully translated to ${language}!`, 'success');
                } else {
                    // Fallback if no engine info provided
                    showTemporaryMessage(`Successfully translated to ${language}!`, 'success');
                }
                
                // Set the translated text in the output
                outputText.value = eliminateDollarSigns(data.text);
                
                // Update word counts
                displayWordCount();
                
                // Complete progress
                completeProgressBar();
                
            } catch (error) {
                hideProgressBar();
                showError('Translation failed: ' + error.message);
            } finally {
                loadingSpinner.style.display = 'none';
            }
        });
    }

    // Mathematical notation rendering with MathJax
    function triggerMathJaxRendering() {
        console.log('Triggering MathJax rendering...');
        
        // Wait for MathJax to be fully loaded
        function waitForMathJax(callback) {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                callback();
            } else {
                console.log('Waiting for MathJax to load...');
                setTimeout(() => waitForMathJax(callback), 100);
            }
        }
        
        waitForMathJax(() => {
            const outputText = document.getElementById('outputText');
            const mathDisplay = document.getElementById('outputMathDisplay');
            const toggleBtn = document.getElementById('toggleMathView');
            
            if (outputText && mathDisplay) {
                const content = outputText.value || '';
                console.log('Content to render:', content.substring(0, 200) + '...');
                
                // Check if content contains math expressions
                const hasMath = content.includes('\\(') || content.includes('\\[') || 
                               content.includes('$$') || content.includes('$');
                
                console.log('Has math:', hasMath);
                
                // Always update math display content
                mathDisplay.innerHTML = content;
                
                if (hasMath) {
                    // Show math view automatically when math is detected
                    mathDisplay.style.display = 'block';
                    outputText.style.display = 'none';
                    if (toggleBtn) {
                        toggleBtn.innerHTML = '<i class="bi bi-textarea-t"></i> Show Text View';
                    }
                    
                    // Render math in the display area
                    console.log('Starting MathJax typeset...');
                    MathJax.typesetClear([mathDisplay]);
                    MathJax.typesetPromise([mathDisplay]).then(function() {
                        console.log('MathJax rendering completed successfully');
                    }).catch(function (err) {
                        console.error('MathJax rendering error:', err);
                        // Fallback: show the raw text with proper styling
                        mathDisplay.style.fontFamily = 'monospace';
                        mathDisplay.style.whiteSpace = 'pre-wrap';
                    });
                } else {
                    // Show text view when no math is detected
                    mathDisplay.style.display = 'none';
                    outputText.style.display = 'block';
                    if (toggleBtn) {
                        toggleBtn.innerHTML = '<i class="bi bi-calculator"></i> Show Math View';
                    }
                }
            }
        });
    }

    // Toggle between math view and text view
    function toggleMathView() {
        const outputText = document.getElementById('outputText');
        const mathDisplay = document.getElementById('outputMathDisplay');
        const toggleBtn = document.getElementById('toggleMathView');
        
        console.log('Toggling math view...');
        
        if (outputText && mathDisplay && toggleBtn) {
            if (mathDisplay.style.display === 'none' || mathDisplay.style.display === '') {
                // Show math view
                console.log('Showing math view');
                mathDisplay.style.display = 'block';
                outputText.style.display = 'none';
                toggleBtn.innerHTML = '<i class="bi bi-textarea-t"></i> Show Text View';
                
                // Update content and trigger math rendering
                const content = outputText.value || '';
                mathDisplay.innerHTML = content;
                
                // Wait for MathJax and render
                function waitForMathJax(callback) {
                    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                        callback();
                    } else {
                        setTimeout(() => waitForMathJax(callback), 100);
                    }
                }
                
                waitForMathJax(() => {
                    console.log('Rendering math in toggle...');
                    MathJax.typesetClear([mathDisplay]);
                    MathJax.typesetPromise([mathDisplay]).then(function() {
                        console.log('Math rendering completed in toggle');
                    }).catch(function (err) {
                        console.error('Math rendering error in toggle:', err);
                    });
                });
            } else {
                // Show text view
                console.log('Showing text view');
                mathDisplay.style.display = 'none';
                outputText.style.display = 'block';
                toggleBtn.innerHTML = '<i class="bi bi-calculator"></i> Show Math View';
            }
        }
    }

    // Mathematical notation rendering with KaTeX (fallback)
    function renderMath() {
        if (typeof renderMathInElement !== 'undefined') {
            // Render math in both input and output text areas
            const inputTextElement = document.getElementById('inputText');
            const outputTextElement = document.getElementById('outputText');
            
            // Create temporary display divs for rendering
            const inputDisplayDiv = document.getElementById('inputMathDisplay') || createMathDisplayDiv('inputMathDisplay', inputTextElement);
            const outputDisplayDiv = document.getElementById('outputMathDisplay') || createMathDisplayDiv('outputMathDisplay', outputTextElement);
            
            // Update math display for input
            if (inputTextElement && inputTextElement.value) {
                updateMathDisplay(inputTextElement.value, inputDisplayDiv);
            }
            
            // Update math display for output
            if (outputTextElement && outputTextElement.value) {
                updateMathDisplay(outputTextElement.value, outputDisplayDiv);
            }
        }
    }
    
    function createMathDisplayDiv(id, textArea) {
        const displayDiv = document.createElement('div');
        displayDiv.id = id;
        displayDiv.className = 'math-display-overlay';
        displayDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            padding: 8px;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            color: transparent;
            background: transparent;
            border: none;
            overflow: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            z-index: 1;
        `;
        
        // Make textarea container relative
        const container = textArea.parentElement;
        if (container.style.position !== 'relative') {
            container.style.position = 'relative';
        }
        
        container.appendChild(displayDiv);
        return displayDiv;
    }
    
    function updateMathDisplay(text, displayDiv) {
        if (!text || !displayDiv) return;
        
        // Replace LaTeX math expressions with rendered versions
        displayDiv.innerHTML = text;
        
        try {
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(displayDiv, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false,
                    errorColor: '#cc0000',
                    strict: false
                });
            }
        } catch (error) {
            console.warn('Math rendering error:', error);
        }
    }
    

    
    // Add event listeners for math rendering
    document.addEventListener('DOMContentLoaded', function() {
        const inputMathToggle = document.getElementById('inputMathToggle');
        const toggleMathViewBtn = document.getElementById('toggleMathView');
        
        if (inputMathToggle) {
            inputMathToggle.addEventListener('click', function(e) {
                e.preventDefault();
                toggleMathPreview('inputText', 'inputMathPreview', 'inputMathToggle');
            });
        }
        
        // Add listener for math view toggle button
        if (toggleMathViewBtn) {
            toggleMathViewBtn.addEventListener('click', function(e) {
                e.preventDefault();
                toggleMathView();
            });
        }
        
        const outputMathToggle = document.getElementById('outputMathToggle');
        if (outputMathToggle) {
            outputMathToggle.addEventListener('click', function(e) {
                e.preventDefault();
                toggleMathPreview('outputText', 'outputMathPreview', 'outputMathToggle');
            });
        }
        
        // Wait for KaTeX to load
        function initMathRendering() {
            if (typeof renderMathInElement !== 'undefined') {
                renderMath();
                
                // Add listeners for text changes
                const inputText = document.getElementById('inputText');
                const outputText = document.getElementById('outputText');
                
                if (inputText) {
                    let inputTimeout;
                    inputText.addEventListener('input', function() {
                        clearTimeout(inputTimeout);
                        inputTimeout = setTimeout(() => renderMath(), 500);
                        
                        // Update math preview if visible
                        const preview = document.getElementById('inputMathPreview');
                        if (preview && preview.style.display !== 'none') {
                            setTimeout(() => toggleMathPreview('inputText', 'inputMathPreview', 'inputMathToggle'), 100);
                        }
                    });
                }
                
                if (outputText) {
                    // Observer for output text changes (from processing)
                    const observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                                setTimeout(() => {
                                    triggerMathJaxRendering();
                                    renderMath(); // KaTeX fallback
                                }, 100);
                                
                                // Update math preview if visible
                                const preview = document.getElementById('outputMathPreview');
                                if (preview && preview.style.display !== 'none') {
                                    setTimeout(() => toggleMathPreview('outputText', 'outputMathPreview', 'outputMathToggle'), 200);
                                }
                            }
                        });
                    });
                    
                    observer.observe(outputText, { attributes: true });
                    
                    // Also listen for direct value changes
                    let outputTimeout;
                    outputText.addEventListener('input', function() {
                        clearTimeout(outputTimeout);
                        outputTimeout = setTimeout(() => renderMath(), 500);
                        
                        // Update math preview if visible
                        const preview = document.getElementById('outputMathPreview');
                        if (preview && preview.style.display !== 'none') {
                            setTimeout(() => toggleMathPreview('outputText', 'outputMathPreview', 'outputMathToggle'), 100);
                        }
                    });
                }
            } else {
                // Retry after 100ms if KaTeX not loaded yet
                setTimeout(initMathRendering, 100);
            }
        }
        
        initMathRendering();
    });
});

// Comprehensive Search functionality
async function performComprehensiveSearch() {
    const searchTerms = document.getElementById('searchTerms').value.trim();
    const inputText = document.getElementById('inputText').value.trim();
    
    // Hide previous results and show progress
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchProgress').style.display = 'block';
    document.getElementById('insertSelectedContent').style.display = 'none';
    
    const progressBar = document.querySelector('#searchProgress .progress-bar');
    const progressText = document.getElementById('searchProgressText');
    
    try {
        // Update progress
        progressBar.style.width = '20%';
        progressText.textContent = 'Starting comprehensive research...';
        
        const response = await fetch('/comprehensive_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: searchTerms,
                text_content: inputText
            })
        });
        
        progressBar.style.width = '50%';
        progressText.textContent = 'Processing search results...';
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        progressBar.style.width = '80%';
        progressText.textContent = 'Formatting results...';
        
        if (data.success) {
            displaySearchResults(data.results);
            progressBar.style.width = '100%';
            progressText.textContent = 'Search completed successfully!';
            
            setTimeout(() => {
                document.getElementById('searchProgress').style.display = 'none';
                document.getElementById('searchResults').style.display = 'block';
            }, 500);
        } else {
            throw new Error(data.error || 'Search failed');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        progressText.textContent = `Error: ${error.message}`;
        progressBar.classList.add('bg-danger');
        setTimeout(() => {
            document.getElementById('searchProgress').style.display = 'none';
        }, 2000);
    }
}

function displaySearchResults(results) {
    const webSourcesContainer = document.getElementById('webSourcesResults');
    const aiResearchContainer = document.getElementById('aiResearchResults');
    
    // Clear previous results
    webSourcesContainer.innerHTML = '';
    aiResearchContainer.innerHTML = '';
    
    // Display web sources
    if (results.web_sources && results.web_sources.length > 0) {
        results.web_sources.forEach((source, index) => {
            const sourceDiv = document.createElement('div');
            sourceDiv.className = 'border rounded p-3 mb-3';
            sourceDiv.innerHTML = `
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="webSource${index}" data-type="web" data-content="${escapeHtml(source.snippet)}">
                    <label class="form-check-label fw-bold" for="webSource${index}">
                        <a href="${source.link}" target="_blank" class="text-decoration-none">${escapeHtml(source.title)}</a>
                    </label>
                </div>
                <p class="text-muted small mb-2">${escapeHtml(source.snippet)}</p>
                <small class="text-info">${escapeHtml(source.link)}</small>
            `;
            webSourcesContainer.appendChild(sourceDiv);
        });
    } else {
        webSourcesContainer.innerHTML = '<p class="text-muted">No web sources found.</p>';
    }
    
    // Display AI research
    if (results.ai_research && results.ai_research.length > 0) {
        results.ai_research.forEach((research, index) => {
            const researchDiv = document.createElement('div');
            researchDiv.className = 'border rounded p-3 mb-3';
            researchDiv.innerHTML = `
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="aiResearch${index}" data-type="ai" data-content="${escapeHtml(research.content)}">
                    <label class="form-check-label fw-bold" for="aiResearch${index}">
                        ${escapeHtml(research.provider)} Research
                    </label>
                </div>
                <div class="text-muted small" style="max-height: 150px; overflow-y: auto;">
                    ${escapeHtml(research.content).substring(0, 500)}${research.content.length > 500 ? '...' : ''}
                </div>
            `;
            aiResearchContainer.appendChild(researchDiv);
        });
    } else {
        aiResearchContainer.innerHTML = '<p class="text-muted">No AI research available.</p>';
    }
    
    // Show insert button and add event listener
    const insertBtn = document.getElementById('insertSelectedContent');
    insertBtn.style.display = 'block';
    insertBtn.onclick = insertSelectedSearchContent;
}

function insertSelectedSearchContent() {
    const checkedBoxes = document.querySelectorAll('#searchResults input[type="checkbox"]:checked');
    let selectedContent = [];
    
    checkedBoxes.forEach(checkbox => {
        const content = checkbox.getAttribute('data-content');
        const type = checkbox.getAttribute('data-type');
        if (content) {
            selectedContent.push(`[${type.toUpperCase()} SOURCE]: ${content}`);
        }
    });
    
    if (selectedContent.length === 0) {
        showError('Please select at least one item to insert');
        return;
    }
    
    const inputTextArea = document.getElementById('inputText');
    const currentText = inputTextArea.value.trim();
    const newContent = selectedContent.join('\n\n');
    
    if (currentText) {
        inputTextArea.value = currentText + '\n\n' + newContent;
    } else {
        inputTextArea.value = newContent;
    }
    
    showSuccess(`Inserted ${selectedContent.length} selected item(s) into input box`);
    
    // Close the modal
    bootstrap.Modal.getInstance(document.getElementById('comprehensiveSearchModal')).hide();
    
    // Update word count
    displayWordCount();
}



function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// AI Provider Synchronization
function syncAiProviders() {
    const aiProviderSelects = [
        'topAiProvider',
        'mainAiProvider', 
        'aiProvider',
        'chunkAIProvider',
        'rewriteAiProvider',
        'aiProviderTranslation',
        'aiProviderTranslationModal'
    ];
    
    // Find the first non-empty selection
    let selectedProvider = '';
    for (const selectId of aiProviderSelects) {
        const select = document.getElementById(selectId);
        if (select && select.value) {
            selectedProvider = select.value;
            break;
        }
    }
    
    // Sync all selects to the same value
    aiProviderSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select && select.value !== selectedProvider) {
            select.value = selectedProvider;
        }
    });
}

// Add event listeners for AI provider synchronization
document.addEventListener('DOMContentLoaded', function() {
    const aiProviderSelects = [
        'topAiProvider',
        'mainAiProvider', 
        'aiProvider',
        'chunkAIProvider',
        'rewriteAiProvider',
        'aiProviderTranslation',
        'aiProviderTranslationModal'
    ];
    
    aiProviderSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.addEventListener('change', function() {
                const selectedValue = this.value;
                // Update all other AI provider selects
                aiProviderSelects.forEach(otherId => {
                    if (otherId !== selectId) {
                        const otherSelect = document.getElementById(otherId);
                        if (otherSelect) {
                            otherSelect.value = selectedValue;
                        }
                    }
                });
            });
        }
    });
});