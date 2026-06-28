/**
 * Translation page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const sourceText = document.getElementById('sourceText');
    const targetText = document.getElementById('targetText');
    const sourceLanguage = document.getElementById('sourceLanguage');
    const targetLanguage = document.getElementById('targetLanguage');
    const translateBtn = document.getElementById('translateBtn');
    const clearSourceBtn = document.getElementById('clearSourceBtn');
    const copyTranslationBtn = document.getElementById('copyTranslationBtn');
    const downloadTranslationBtn = document.getElementById('downloadTranslationBtn');
    const sourceWordCount = document.getElementById('sourceWordCount');
    const targetWordCount = document.getElementById('targetWordCount');
    const aiProvider = document.getElementById('aiProvider');
    const uploadSourceFileBtn = document.getElementById('uploadSourceFileBtn');
    const sourceFileInput = document.getElementById('sourceFileInput');
    const translationLoadingOverlay = document.getElementById('translationLoadingOverlay');
    const translationStatusText = document.getElementById('translationStatusText');
    const translationProgressBar = document.getElementById('translationProgressBar');
    const translationProgressText = document.getElementById('translationProgressText');
    
    // Word count function
    function updateWordCount(text, element) {
        const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        element.querySelector('span').textContent = `${wordCount} words`;
    }
    
    // Update source word count on input
    if (sourceText) {
        sourceText.addEventListener('input', function() {
            updateWordCount(this.value, sourceWordCount);
        });
    }
    
    // Clear source text
    if (clearSourceBtn) {
        clearSourceBtn.addEventListener('click', function() {
            sourceText.value = '';
            updateWordCount('', sourceWordCount);
        });
    }
    
    // Copy translation to clipboard
    if (copyTranslationBtn) {
        copyTranslationBtn.addEventListener('click', function() {
            targetText.select();
            document.execCommand('copy');
            // Show toast notification
            const toast = document.createElement('div');
            toast.className = 'position-fixed bottom-0 end-0 p-3';
            toast.style.zIndex = '9999';
            toast.innerHTML = `
                <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header">
                        <strong class="me-auto">Translation</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        Translation copied to clipboard!
                    </div>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.remove();
            }, 3000);
        });
    }
    
    // Download translation as text file
    if (downloadTranslationBtn) {
        downloadTranslationBtn.addEventListener('click', function() {
            if (!targetText.value.trim()) {
                alert('No translation to download!');
                return;
            }
            
            const blob = new Blob([targetText.value], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translation.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    // Handle file uploads
    if (uploadSourceFileBtn && sourceFileInput) {
        uploadSourceFileBtn.addEventListener('click', function() {
            sourceFileInput.click();
        });
        
        sourceFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show loading overlay
            translationLoadingOverlay.style.display = 'flex';
            translationStatusText.textContent = 'Reading file...';
            translationProgressBar.style.width = '0%';
            translationProgressBar.textContent = '0%';
            
            // Create form data for file upload
            const formData = new FormData();
            formData.append('file', file);
            
            // Send file to server for text extraction
            fetch('/extract_text', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error extracting text from file');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Set extracted text to source textarea
                sourceText.value = data.text;
                updateWordCount(data.text, sourceWordCount);
                
                // Hide loading overlay
                translationLoadingOverlay.style.display = 'none';
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error extracting text: ' + error.message);
                translationLoadingOverlay.style.display = 'none';
            });
        });
    }
    
    // Add Enter key functionality for translation inputs
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

    // Add Enter key support for translation source text
    if (sourceText && translateBtn) {
        addEnterKeyListener(sourceText, translateBtn, true); // Ctrl+Enter for textarea
    }

    // Translate text
    if (translateBtn) {
        translateBtn.addEventListener('click', function() {
            const text = sourceText.value.trim();
            if (!text) {
                alert('Please enter text to translate!');
                return;
            }
            
            // Get translation parameters
            const source = sourceLanguage.value;
            const target = targetLanguage.value;
            const provider = aiProvider ? aiProvider.value : 'auto';
            const formalityCheck = document.getElementById('formalityCheck');
            const preserveFormatting = document.getElementById('preserveFormatting');
            const processingMode = document.getElementById('processingMode');
            
            // Prepare request data
            const requestData = {
                text: text,
                source_language: source,
                target_language: target,
                ai_provider: provider === 'auto' ? '' : provider,
                formal: formalityCheck ? formalityCheck.checked : true,
                preserve_formatting: preserveFormatting ? preserveFormatting.checked : true,
                processing_mode: processingMode ? processingMode.value : 'standard'
            };
            
            // Show loading overlay
            translationLoadingOverlay.style.display = 'flex';
            translationStatusText.textContent = 'Translating...';
            translationProgressBar.style.width = '0%';
            translationProgressBar.textContent = '0%';
            
            // Make translation request
            fetch('/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Translation failed');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Update translation
                targetText.value = data.result;
                updateWordCount(data.result, targetWordCount);
                
                // Add metadata to the bottom of the translation info
                const metadataText = `\n\n----\nTranslated from ${source === 'auto' ? 'auto-detected language' : sourceLanguage.options[sourceLanguage.selectedIndex].text} to ${targetLanguage.options[targetLanguage.selectedIndex].text}`;
                targetText.value += metadataText;
                
                // Hide loading overlay
                translationLoadingOverlay.style.display = 'none';
                
                // Show success toast
                const toast = document.createElement('div');
                toast.className = 'position-fixed bottom-0 end-0 p-3';
                toast.style.zIndex = '9999';
                toast.innerHTML = `
                    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                        <div class="toast-header bg-success text-white">
                            <strong class="me-auto">Translation Complete</strong>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                        <div class="toast-body">
                            Translation completed in ${data.elapsed_seconds || 0} seconds
                            ${data.engine_used ? `<br>Engine used: ${data.engine_used}` : ''}
                        </div>
                    </div>
                `;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.remove();
                }, 5000);
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Translation error: ' + error.message);
                translationLoadingOverlay.style.display = 'none';
            });
        });
    }
    
    // Swap languages
    const swapLanguagesBtn = document.createElement('button');
    swapLanguagesBtn.id = 'swapLanguagesBtn';
    swapLanguagesBtn.className = 'btn btn-outline-light position-absolute';
    swapLanguagesBtn.style.top = '50%';
    swapLanguagesBtn.style.left = '50%';
    swapLanguagesBtn.style.transform = 'translate(-50%, -50%)';
    swapLanguagesBtn.style.zIndex = '10';
    swapLanguagesBtn.innerHTML = '<i class="bi bi-arrow-left-right"></i>';
    swapLanguagesBtn.title = 'Swap languages';
    
    // Add the button between the two columns
    const rowElement = document.querySelector('.row.mb-4');
    if (rowElement) {
        rowElement.style.position = 'relative';
        rowElement.appendChild(swapLanguagesBtn);
        
        // Add click event to swap languages
        swapLanguagesBtn.addEventListener('click', function() {
            // Don't swap if source is auto
            if (sourceLanguage.value === 'auto') {
                alert('Cannot swap when source language is set to Auto-detect');
                return;
            }
            
            // Swap language selections
            const tempLang = sourceLanguage.value;
            sourceLanguage.value = targetLanguage.value;
            targetLanguage.value = tempLang;
            
            // If there's text in the target, swap that too
            if (targetText.value.trim() && sourceText.value.trim()) {
                const tempText = sourceText.value;
                sourceText.value = targetText.value;
                targetText.value = tempText;
                
                // Update word counts
                updateWordCount(sourceText.value, sourceWordCount);
                updateWordCount(targetText.value, targetWordCount);
            }
        });
    }
    
    // Initial word count update
    if (sourceText) {
        updateWordCount(sourceText.value, sourceWordCount);
    }
    if (targetText) {
        updateWordCount(targetText.value, targetWordCount);
    }
});