// EZ Reader - Figma Design Implementation

// Global state
let currentAction = 'rewrite';
let currentSettings = {
    customInstructions: '',
    authorStyle: '',
    writingSample: '',
    aiProvider: '',
    contentSource: ''
};

// DOM Elements
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const fileInput = document.getElementById('fileInput');
const fileUploadArea = document.getElementById('fileUploadArea');
const progressOverlay = document.getElementById('progressOverlay');
const progressBar = document.getElementById('progressBar');
const progressTitle = document.getElementById('progressTitle');
const progressStatus = document.getElementById('progressStatus');

// Word count elements
const inputWordCount = document.getElementById('inputWordCount');
const outputWordCount = document.getElementById('outputWordCount');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    addEnterKeyListeners();
    updateWordCounts();
});

function initializeEventListeners() {
    // Action buttons
    document.querySelectorAll('.control-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active from all
            document.querySelectorAll('.control-btn[data-action]').forEach(b => b.classList.remove('active'));
            // Add active to clicked
            this.classList.add('active');
            currentAction = this.getAttribute('data-action');
        });
    });

    // Main rewrite button
    document.getElementById('mainRewriteBtn').addEventListener('click', processText);

    // Settings buttons
    document.getElementById('instructionsBtn').addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('instructionsModal')).show();
    });

    document.getElementById('styleBtn').addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('styleModal')).show();
    });

    document.getElementById('aiProviderBtn').addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('aiProviderModal')).show();
    });

    // Upload button
    document.getElementById('uploadFileBtn').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleFileUpload);

    // File upload area
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('drag-over');
    });

    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('drag-over');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload();
        }
    });

    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadText);

    // TTS button
    document.getElementById('ttsBtn').addEventListener('click', textToSpeech);

    // AI Detection button
    document.getElementById('aiDetectionBtn').addEventListener('click', detectAI);

    // Combine source button
    document.getElementById('combineSourceBtn').addEventListener('click', combineWithSource);

    // Critique button
    document.getElementById('critiqueBtnApply').addEventListener('click', applyCritique);

    // Chat button
    document.getElementById('sendChatBtn').addEventListener('click', sendChat);

    // Word count updates
    inputText.addEventListener('input', updateWordCounts);
    outputText.addEventListener('input', updateWordCounts);

    // Save settings on change
    document.getElementById('customInstructions').addEventListener('change', (e) => {
        currentSettings.customInstructions = e.target.value;
    });

    document.getElementById('authorStyle').addEventListener('change', (e) => {
        currentSettings.authorStyle = e.target.value;
    });

    document.getElementById('writingSample').addEventListener('change', (e) => {
        currentSettings.writingSample = e.target.value;
    });

    document.getElementById('aiProvider').addEventListener('change', (e) => {
        currentSettings.aiProvider = e.target.value;
    });
}

function addEnterKeyListeners() {
    // Add Enter key functionality for all inputs
    document.querySelectorAll('input[type="text"], textarea').forEach(input => {
        input.addEventListener('keydown', function(e) {
            if (input.tagName.toLowerCase() === 'textarea') {
                // For textareas: Ctrl+Enter to submit
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    triggerAction(input);
                }
            } else {
                // For text inputs: Enter to submit
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerAction(input);
                }
            }
        });
    });
}

function triggerAction(input) {
    // Determine which action to trigger based on the input
    if (input.id === 'chatInput') {
        sendChat();
    } else if (input.closest('#instructionsModal')) {
        bootstrap.Modal.getInstance(document.getElementById('instructionsModal')).hide();
    } else if (input.closest('#styleModal')) {
        bootstrap.Modal.getInstance(document.getElementById('styleModal')).hide();
    } else if (input.closest('#aiProviderModal')) {
        bootstrap.Modal.getInstance(document.getElementById('aiProviderModal')).hide();
    } else {
        processText();
    }
}

function updateWordCounts() {
    const inputWords = inputText.value.trim().split(/\s+/).filter(w => w.length > 0).length;
    const outputWords = outputText.value.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    inputWordCount.textContent = `Words: ${inputWords}`;
    outputWordCount.textContent = `Words: ${outputWords}`;
}

function showProgress(title, status) {
    progressTitle.textContent = title;
    progressStatus.textContent = status;
    progressBar.style.width = '30%';
    progressBar.textContent = '30%';
    progressOverlay.style.display = 'flex';
}

function updateProgress(percent, status) {
    progressBar.style.width = percent + '%';
    progressBar.textContent = percent + '%';
    if (status) progressStatus.textContent = status;
}

function hideProgress() {
    progressOverlay.style.display = 'none';
}

async function handleFileUpload() {
    const file = fileInput.files[0];
    if (!file) return;

    showProgress('Uploading File', 'Extracting text from file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        inputText.value = data.text || '';
        updateWordCounts();
        updateProgress(100, 'File uploaded successfully!');
        
        setTimeout(hideProgress, 1000);
    } catch (error) {
        alert('Error uploading file: ' + error.message);
        hideProgress();
    }
}

async function processText() {
    const text = inputText.value.trim();
    
    if (!text) {
        alert('Please enter or upload text first!');
        return;
    }

    let endpoint = '/process';
    let requestData = {
        text: text,
        custom_instructions: currentSettings.customInstructions,
        author_style: currentSettings.authorStyle,
        ai_provider: currentSettings.aiProvider,
        content_source: document.getElementById('contentSource').value
    };

    // Handle different actions
    if (currentAction === 'translate') {
        endpoint = '/translate';
        const targetLang = prompt('Enter target language (e.g., Spanish, French, German):');
        if (!targetLang) return;
        requestData.target_language = targetLang;
        requestData.source_language = 'auto';
    } else if (currentAction === 'summarize') {
        requestData.custom_instructions = 'Summarize this text concisely. ' + requestData.custom_instructions;
    } else if (currentAction === 'expand') {
        requestData.custom_instructions = 'Expand this text with more detail and examples. ' + requestData.custom_instructions;
    } else if (currentAction === 'grammar') {
        requestData.custom_instructions = 'Fix all grammar, spelling, and punctuation errors. ' + requestData.custom_instructions;
    }

    showProgress('Processing Text', `${currentAction.charAt(0).toUpperCase() + currentAction.slice(1)}ing your text...`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        outputText.value = data.result || '';
        updateWordCounts();
        updateProgress(100, 'Processing complete!');
        
        // Render math if MathJax is available
        if (window.MathJax) {
            MathJax.typesetPromise([outputText]).catch((err) => console.log('MathJax error:', err));
        }
        
        setTimeout(hideProgress, 1000);
    } catch (error) {
        alert('Error processing text: ' + error.message);
        hideProgress();
    }
}

async function combineWithSource() {
    const targetText = inputText.value.trim();
    const sourceText = document.getElementById('contentSource').value.trim();
    
    if (!targetText || !sourceText) {
        alert('Please enter both input text and content source!');
        return;
    }

    showProgress('Combining Content', 'Merging source material with your text...');

    try {
        const response = await fetch('/combine_target_source', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target_text: targetText,
                content_source: sourceText
            })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        outputText.value = data.result || '';
        updateWordCounts();
        updateProgress(100, 'Content combined successfully!');
        
        setTimeout(hideProgress, 1000);
    } catch (error) {
        alert('Error combining content: ' + error.message);
        hideProgress();
    }
}

async function applyCritique() {
    const originalText = outputText.value.trim();
    const critiqueText = document.getElementById('critiqueText').value.trim();
    
    if (!originalText || !critiqueText) {
        alert('Please have output text and enter critique instructions!');
        return;
    }

    showProgress('Applying Critique', 'Modifying text based on your critique...');

    try {
        const response = await fetch('/rewrite_from_output', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                output_text: originalText,
                critique: critiqueText,
                ai_provider: currentSettings.aiProvider
            })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        outputText.value = data.result || '';
        updateWordCounts();
        updateProgress(100, 'Critique applied successfully!');
        
        setTimeout(hideProgress, 1000);
    } catch (error) {
        alert('Error applying critique: ' + error.message);
        hideProgress();
    }
}

async function sendChat() {
    const message = document.getElementById('chatInput').value.trim();
    const context = outputText.value.trim() || inputText.value.trim();
    
    if (!message) {
        alert('Please enter a question!');
        return;
    }

    showProgress('AI Chat', 'Getting response from AI...');

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                context: context
            })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        // Show response in a simple alert for now
        alert('AI Response:\n\n' + data.response);
        document.getElementById('chatInput').value = '';
        
        hideProgress();
    } catch (error) {
        alert('Error chatting with AI: ' + error.message);
        hideProgress();
    }
}

async function downloadText() {
    const text = outputText.value.trim() || inputText.value.trim();
    
    if (!text) {
        alert('No text to download!');
        return;
    }

    const format = prompt('Enter format (pdf, docx, txt):', 'txt');
    if (!format) return;

    showProgress('Downloading', 'Creating download file...');

    try {
        const response = await fetch(`/download_document/${format}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `document.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        hideProgress();
    } catch (error) {
        alert('Error downloading: ' + error.message);
        hideProgress();
    }
}

async function textToSpeech() {
    const text = outputText.value.trim() || inputText.value.trim();
    
    if (!text) {
        alert('No text to convert to speech!');
        return;
    }

    showProgress('Creating Audio', 'Generating audio from text...');

    try {
        const response = await fetch('/create_audiobook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice: 'nova',
                speed: 1.0
            })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        if (data.download_url) {
            window.open(data.download_url, '_blank');
        } else if (data.file_url) {
            window.open(data.file_url, '_blank');
        }
        
        hideProgress();
    } catch (error) {
        alert('Error creating audio: ' + error.message);
        hideProgress();
    }
}

async function detectAI() {
    const text = outputText.value.trim() || inputText.value.trim();
    
    if (!text) {
        alert('No text to analyze!');
        return;
    }

    showProgress('AI Detection', 'Analyzing text for AI content...');

    try {
        const response = await fetch('/detect_ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            hideProgress();
            return;
        }

        let resultMessage = 'AI Detection Results:\n\n';
        resultMessage += data.conclusion || 'Unable to determine';
        if (data.ai_score !== undefined) {
            resultMessage += '\n\nAI Score: ' + (data.ai_score * 100).toFixed(1) + '%';
        }
        
        alert(resultMessage);
        hideProgress();
    } catch (error) {
        alert('Error detecting AI: ' + error.message);
        hideProgress();
    }
}
