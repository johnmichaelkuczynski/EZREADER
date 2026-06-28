/**
 * OpenAI Text-to-Speech Integration
 * This file handles the TTS UI interactions and API calls with high-quality OpenAI voices
 */

// Add Enter key functionality for TTS input
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

document.addEventListener('DOMContentLoaded', function() {
    // Add Enter key support for TTS text areas
    const outputText = document.getElementById('outputText');
    const inputText = document.getElementById('inputText');
    const createAudiobookBtn = document.getElementById('create-audiobook-btn');
    
    if (outputText && createAudiobookBtn) {
        outputText.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                createAudiobookBtn.click();
            }
        });
    }
    
    if (inputText && createAudiobookBtn) {
        inputText.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter' && !outputText.value.trim()) {
                e.preventDefault();
                createAudiobookBtn.click();
            }
        });
    }

    // Elements
    const convertToSpeechBtn = document.getElementById('convertToSpeechBtn');
    const voiceSelect = document.getElementById('voice-select');
    const speedSelect = document.getElementById('speed-select');
    const useReducedLengthCheckbox = document.getElementById('use-reduced-length');
    const ttsControls = document.getElementById('tts-controls');
    const ttsProcessing = document.getElementById('tts-processing');
    const ttsResult = document.getElementById('tts-result');
    const ttsError = document.getElementById('tts-error');
    const ttsAudioPlayer = document.getElementById('tts-audio-player');
    const ttsAudioUrl = document.getElementById('tts-audio-url');
    const ttsAudioLink = document.getElementById('tts-audio-link');
    const copyAudioUrlBtn = document.getElementById('copy-audio-url-btn');
    const ttsLanguageInfo = document.getElementById('tts-language-info');
    const ttsErrorMessage = document.getElementById('tts-error-message');
    const ttsResetBtn = document.getElementById('tts-reset-btn');
    const ttsRetryBtn = document.getElementById('tts-retry-btn');
    
    // Text-to-Speech functionality with Azure
    if (createAudiobookBtn) {
        createAudiobookBtn.addEventListener('click', function() {
            // Get text from the output or input area
            const textToConvert = document.getElementById('outputText').value || document.getElementById('inputText').value;
            
            if (!textToConvert) {
                showNotification('No text available to convert to speech.', 'warning');
                return;
            }
            
            // Show processing view
            ttsControls.classList.add('d-none');
            ttsProcessing.classList.remove('d-none');
            ttsResult.classList.add('d-none');
            ttsError.classList.add('d-none');
            
            // Get options
            const voice = voiceSelect.value;
            const speed = parseFloat(speedSelect.value);
            const useReducedLength = useReducedLengthCheckbox.checked;
            
            // Call the backend API
            fetch('/create_audiobook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: textToConvert,
                    voice: voice,
                    speed: speed,
                    use_reduced_length: useReducedLength
                }),
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'An error occurred while creating the audiobook.');
                    });
                }
                return response.json();
            })
            .then(data => {
                // Success - show the audio player
                ttsProcessing.classList.add('d-none');
                ttsResult.classList.remove('d-none');
                
                // Set audio source
                ttsAudioPlayer.src = data.audio_url;
                
                // Use the properly formatted URL from backend as-is
                const fullUrl = data.download_url;
                ttsAudioUrl.value = fullUrl;
                
                // Set clickable hyperlink
                ttsAudioLink.href = fullUrl;
                
                // Show language info
                let langInfo = `Audio created using ${data.narrator}`;
                if (data.language_name) {
                    langInfo += ` in ${data.language_name}`;
                }
                ttsLanguageInfo.textContent = langInfo;
                
                // Play the audio
                ttsAudioPlayer.load();
                // Don't auto-play - let the user decide when to play
            })
            .catch(error => {
                console.error('Error creating audiobook:', error);
                
                // Show error view
                ttsProcessing.classList.add('d-none');
                ttsError.classList.remove('d-none');
                
                // Set error message
                ttsErrorMessage.textContent = error.message || 'There was an error generating your audio.';
            });
        });
    }
    
    // "Convert to Speech" button in the main interface
    if (convertToSpeechBtn) {
        convertToSpeechBtn.addEventListener('click', function() {
            // Scroll to the TTS section
            const ttsSection = document.querySelector('.card-header.bg-primary.text-white');
            if (ttsSection) {
                ttsSection.scrollIntoView({ behavior: 'smooth' });
                
                // Optional: highlight the generate button
                setTimeout(() => {
                    if (createAudiobookBtn) {
                        createAudiobookBtn.classList.add('btn-pulse');
                        setTimeout(() => {
                            createAudiobookBtn.classList.remove('btn-pulse');
                        }, 1500);
                    }
                }, 500);
            }
        });
    }
    
    // Reset button (create another)
    if (ttsResetBtn) {
        ttsResetBtn.addEventListener('click', function() {
            // Show controls, hide results
            ttsControls.classList.remove('d-none');
            ttsResult.classList.add('d-none');
            ttsError.classList.add('d-none');
            
            // Stop audio if playing
            ttsAudioPlayer.pause();
            ttsAudioPlayer.currentTime = 0;
        });
    }
    
    // Retry button
    if (ttsRetryBtn) {
        ttsRetryBtn.addEventListener('click', function() {
            // Show controls, hide error
            ttsControls.classList.remove('d-none');
            ttsError.classList.add('d-none');
        });
    }
    
    // Copy audio URL button
    if (copyAudioUrlBtn) {
        copyAudioUrlBtn.addEventListener('click', function() {
            if (ttsAudioUrl && ttsAudioUrl.value) {
                // Select the text
                ttsAudioUrl.focus();
                ttsAudioUrl.select();
                ttsAudioUrl.setSelectionRange(0, 99999); // For mobile devices
                
                let success = false;
                
                // Try modern clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(ttsAudioUrl.value).then(function() {
                        showCopySuccess();
                    }).catch(function(err) {
                        console.log('Clipboard API failed, trying fallback:', err);
                        tryFallbackCopy();
                    });
                } else {
                    tryFallbackCopy();
                }
                
                function tryFallbackCopy() {
                    try {
                        // Fallback to execCommand
                        const successful = document.execCommand('copy');
                        if (successful) {
                            showCopySuccess();
                        } else {
                            showCopyError();
                        }
                    } catch (err) {
                        console.error('All copy methods failed:', err);
                        showCopyError();
                    }
                }
                
                function showCopySuccess() {
                    const originalText = copyAudioUrlBtn.innerHTML;
                    copyAudioUrlBtn.innerHTML = '<i class="bi bi-check"></i> Copied!';
                    copyAudioUrlBtn.classList.add('btn-success');
                    copyAudioUrlBtn.classList.remove('btn-outline-secondary');
                    
                    setTimeout(function() {
                        copyAudioUrlBtn.innerHTML = originalText;
                        copyAudioUrlBtn.classList.remove('btn-success');
                        copyAudioUrlBtn.classList.add('btn-outline-secondary');
                    }, 2000);
                }
                
                function showCopyError() {
                    const originalText = copyAudioUrlBtn.innerHTML;
                    copyAudioUrlBtn.innerHTML = '<i class="bi bi-x"></i> Select & Copy';
                    copyAudioUrlBtn.classList.add('btn-warning');
                    copyAudioUrlBtn.classList.remove('btn-outline-secondary');
                    
                    setTimeout(function() {
                        copyAudioUrlBtn.innerHTML = originalText;
                        copyAudioUrlBtn.classList.remove('btn-warning');
                        copyAudioUrlBtn.classList.add('btn-outline-secondary');
                    }, 3000);
                }
            }
        });
    }
});

// Helper function to show notifications
function showNotification(message, type = 'info') {
    const alertBox = document.createElement('div');
    alertBox.className = `alert alert-${type} alert-dismissible fade show fixed-top mx-auto mt-3`;
    alertBox.style.maxWidth = '500px';
    alertBox.style.zIndex = '9999';
    alertBox.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertBox);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertBox.classList.remove('show');
        setTimeout(() => alertBox.remove(), 300);
    }, 5000);
}

// Add a little CSS for the pulse effect
const style = document.createElement('style');
style.textContent = `
.btn-pulse {
    animation: pulse 1.5s ease-in-out;
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
    70% { box-shadow: 0 0 0 15px rgba(0, 123, 255, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
}
`;
document.head.appendChild(style);