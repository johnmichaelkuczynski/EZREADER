document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const startDictationBtn = document.getElementById('startDictationBtn');
    const stopDictationBtn = document.getElementById('stopDictationBtn');
    const downloadRecordingBtn = document.getElementById('downloadRecordingBtn');
    const audioControls = document.getElementById('audioControls');
    const dictationStatus = document.getElementById('dictationStatus');
    const dictationProgress = document.getElementById('dictationProgress');
    const audioPlayer = document.getElementById('audioPlayer');
    const inputText = document.getElementById('inputText');
    const fileInput = document.getElementById('fileInput');
    const uploadAudioBtn = document.getElementById('uploadAudioBtn');
    
    // Global variables for speech recognition
    let recognition = null;
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = null;
    let recordingTimer = null;
    let audioBlob = null;
    
    // Setup speech recognition
    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showError('Speech recognition is not supported in this browser. Try using Chrome, Edge, or Safari.');
            return false;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US'; // Could make this configurable
        
        // Track last output to prevent repetition
        let lastInterimTranscript = '';
        let transcriptBuffer = '';
        
        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';
            
            // Process only the current results
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript; // Just use the latest interim result
                }
            }
            
            // Update the input text area with final transcript
            if (finalTranscript) {
                // Clear any interim display first
                if (transcriptBuffer) {
                    // Remove the previously displayed interim text
                    inputText.value = inputText.value.substring(0, inputText.value.length - transcriptBuffer.length);
                    transcriptBuffer = '';
                }
                
                // Add the final transcript
                inputText.value += finalTranscript;
                lastInterimTranscript = '';
            }
            
            // Handle interim results without duplication
            if (interimTranscript && interimTranscript !== lastInterimTranscript) {
                // Clear previous interim text if it exists
                if (transcriptBuffer) {
                    inputText.value = inputText.value.substring(0, inputText.value.length - transcriptBuffer.length);
                }
                
                // Add space if needed
                let spacer = inputText.value && !inputText.value.endsWith(' ') ? ' ' : '';
                
                // Save and display the new interim text
                transcriptBuffer = spacer + interimTranscript;
                inputText.value += transcriptBuffer;
                lastInterimTranscript = interimTranscript;
            }
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                showError('Microphone access denied. Please allow microphone access to use dictation.');
                stopDictation();
            }
        };
        
        recognition.onend = function() {
            // Restart if we're still recording
            if (isRecording) {
                recognition.start();
            }
        };
        
        return true;
    }
    
    // Setup media recorder for saving audio
    function setupMediaRecorder() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Audio recording is not supported in this browser.');
            return false;
        }
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                
                mediaRecorder.ondataavailable = function(event) {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = function() {
                    audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    audioPlayer.src = audioUrl;
                    audioPlayer.style.display = 'block';
                    downloadRecordingBtn.disabled = false;
                };
                
                // Start recording
                audioChunks = [];
                mediaRecorder.start();
                recordingStartTime = Date.now();
                updateRecordingProgress();
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                showError('Unable to access microphone. Please check your settings and permissions.');
                stopDictation();
            });
            
        return true;
    }
    
    // Start dictation
    function startDictation() {
        if (isRecording) return;
        
        // Reset UI
        inputText.placeholder = 'Listening...';
        audioPlayer.style.display = 'none';
        audioChunks = [];
        downloadRecordingBtn.disabled = true;
        
        // Setup speech recognition
        if (!setupSpeechRecognition()) {
            return;
        }
        
        // Setup media recorder
        if (!setupMediaRecorder()) {
            return;
        }
        
        // Update UI
        isRecording = true;
        startDictationBtn.style.display = 'none';
        stopDictationBtn.style.display = 'inline-block';
        audioControls.style.display = 'block';
        dictationStatus.textContent = 'Listening... (click Stop when finished)';
        
        // Start recognition
        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            showError('Error starting speech recognition. Please refresh and try again.');
            stopDictation();
        }
    }
    
    // Stop dictation
    function stopDictation() {
        if (!isRecording) return;
        
        isRecording = false;
        
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        // Stop recognition
        if (recognition) {
            recognition.stop();
        }
        
        // Clear the recording timer
        if (recordingTimer) {
            clearInterval(recordingTimer);
            recordingTimer = null;
        }
        
        // Update UI
        startDictationBtn.style.display = 'inline-block';
        stopDictationBtn.style.display = 'none';
        dictationStatus.textContent = 'Recording stopped. You can download the audio below.';
        
        // Reset input placeholder
        inputText.placeholder = 'Enter your text here or upload a document above...';
    }
    
    // Update recording progress
    function updateRecordingProgress() {
        recordingTimer = setInterval(() => {
            if (!recordingStartTime || !isRecording) return;
            
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            // Format time as MM:SS
            const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            dictationStatus.textContent = `Recording: ${timeDisplay}`;
            
            // Update progress bar (max 5 minutes = 300 seconds)
            const progressPercent = Math.min((elapsed / 300) * 100, 100);
            dictationProgress.style.width = `${progressPercent}%`;
            
            // Warning when approaching 5 minutes
            if (elapsed >= 270 && elapsed < 300) {
                dictationProgress.classList.add('bg-warning');
                dictationStatus.innerHTML = `Recording: ${timeDisplay} <span class="text-warning">(approaching 5-minute limit)</span>`;
            } else if (elapsed >= 300) {
                dictationProgress.classList.add('bg-danger');
                dictationStatus.innerHTML = `Recording: ${timeDisplay} <span class="text-danger">(5-minute limit reached)</span>`;
                
                // Automatically stop after 5 minutes
                stopDictation();
            }
        }, 1000);
    }
    
    // Download recording
    function downloadRecording() {
        if (!audioBlob) {
            showError('No recording available to download.');
            return;
        }
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(audioBlob);
        downloadLink.download = `recording_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.wav`;
        downloadLink.click();
    }
    
    // Process uploaded audio file
    function processAudioFile(file) {
        if (!file) return;
        
        // Check if file is an audio file
        if (!file.type.startsWith('audio/')) {
            showError('Please upload an audio file (MP3 or WAV).');
            return;
        }
        
        // Show loading indicator
        const processingStatus = document.getElementById('processingStatus');
        processingStatus.textContent = 'Processing audio file...';
        processingStatus.style.display = 'block';
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Send to server for processing
        fetch('/process_audio', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Error processing audio file');
                });
            }
            return response.json();
        })
        .then(data => {
            // Add transcribed text to input area
            if (data.text) {
                inputText.value = data.text;
                showTemporaryMessage('Audio transcription complete!', 'success');
            } else {
                showError('No text could be extracted from the audio file.');
            }
        })
        .catch(error => {
            console.error('Error processing audio:', error);
            showError(`Error: ${error.message}`);
        })
        .finally(() => {
            processingStatus.style.display = 'none';
        });
    }
    
    // Helper function to show error
    function showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    // Helper function to show temporary message
    function showTemporaryMessage(message, type = 'info') {
        const processingStatus = document.getElementById('processingStatus');
        processingStatus.textContent = message;
        processingStatus.className = `alert alert-${type} text-center`;
        processingStatus.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            processingStatus.style.display = 'none';
        }, 3000);
    }
    
    // Event listeners
    startDictationBtn.addEventListener('click', startDictation);
    stopDictationBtn.addEventListener('click', stopDictation);
    downloadRecordingBtn.addEventListener('click', downloadRecording);
    
    // File input for audio processing
    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('audio/')) {
            processAudioFile(file);
        }
    });
    
    // Add an upload audio button in the UI
    if (uploadAudioBtn) {
        uploadAudioBtn.addEventListener('click', function() {
            // Create a special file input for audio only
            const audioInput = document.createElement('input');
            audioInput.type = 'file';
            audioInput.accept = 'audio/*';
            audioInput.style.display = 'none';
            
            audioInput.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file) {
                    processAudioFile(file);
                }
                // Remove this temporary element
                document.body.removeChild(audioInput);
            });
            
            document.body.appendChild(audioInput);
            audioInput.click();
        });
    }
});