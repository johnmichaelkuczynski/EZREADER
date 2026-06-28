// UI Customizer - Allows users to drag, resize, and customize their own UI layout
// This script adds a customization mode where UI elements can be freely arranged

document.addEventListener('DOMContentLoaded', function() {
    // Create UI customization controls
    createCustomizationControls();
    
    // Stores the original positions of elements for reset function
    let originalPositions = {};
    
    // Keep track of customization mode state
    let customizationMode = false;
    
    // Function to create the customization controls panel
    function createCustomizationControls() {
        const controlPanel = document.createElement('div');
        controlPanel.id = 'customization-controls';
        controlPanel.className = 'customization-controls';
        controlPanel.innerHTML = `
            <button id="toggle-customization" class="btn btn-primary">
                <i class="bi bi-grid"></i> Customize UI
            </button>
            <div id="customization-options" style="display: none;">
                <button id="save-layout" class="btn btn-success">
                    <i class="bi bi-save"></i> Save Layout
                </button>
                <button id="reset-layout" class="btn btn-danger">
                    <i class="bi bi-arrow-counterclockwise"></i> Reset Layout
                </button>
                <div class="form-check form-switch mt-2">
                    <input class="form-check-input" type="checkbox" id="show-grid">
                    <label class="form-check-label" for="show-grid">Show Grid</label>
                </div>
            </div>
        `;
        
        // Add to the document
        document.body.appendChild(controlPanel);
        
        // Setup event listeners
        document.getElementById('toggle-customization').addEventListener('click', toggleCustomizationMode);
        document.getElementById('save-layout').addEventListener('click', saveCustomLayout);
        document.getElementById('reset-layout').addEventListener('click', resetLayout);
        document.getElementById('show-grid').addEventListener('change', toggleGrid);
    }
    
    // Toggle customization mode on/off
    function toggleCustomizationMode() {
        customizationMode = !customizationMode;
        const toggleBtn = document.getElementById('toggle-customization');
        const optionsPanel = document.getElementById('customization-options');
        
        if (customizationMode) {
            // Enable customization mode
            toggleBtn.innerHTML = '<i class="bi bi-x-lg"></i> Exit Customize Mode';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-warning');
            optionsPanel.style.display = 'block';
            
            // Make elements draggable and resizable
            enableCustomization();
            
            // Show a help message
            showTemporaryMessage('Customization mode enabled. Drag elements to reposition them, and resize by pulling the corners.', 'info', 7000);
        } else {
            // Disable customization mode
            toggleBtn.innerHTML = '<i class="bi bi-grid"></i> Customize UI';
            toggleBtn.classList.remove('btn-warning');
            toggleBtn.classList.add('btn-primary');
            optionsPanel.style.display = 'none';
            
            // Disable dragging and resizing
            disableCustomization();
            
            // Remove grid if shown
            document.body.classList.remove('show-grid');
            document.getElementById('show-grid').checked = false;
            
            showTemporaryMessage('Customization mode disabled. Your changes are not yet saved.', 'info', 5000);
        }
    }
    
    // Enable dragging and resizing for customizable elements
    function enableCustomization() {
        // Get all customizable elements
        const customizableElements = getCustomizableElements();
        
        // Store original positions before making any changes (if not already stored)
        if (Object.keys(originalPositions).length === 0) {
            customizableElements.forEach(el => {
                originalPositions[el.id] = {
                    position: el.style.position,
                    top: el.style.top,
                    left: el.style.left,
                    width: el.style.width,
                    height: el.style.height,
                    zIndex: el.style.zIndex
                };
            });
        }
        
        // First handle special elements like buttons
        setupSmallElementHandlers();
        
        // Then handle larger container elements differently
        customizableElements.forEach(el => {
            // Skip buttons and small controls as they are handled separately
            if (el.tagName === 'BUTTON' || el.classList.contains('btn') || 
                el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                return;
            }
            
            // Add customizable class for styling
            el.classList.add('customizable');
            
            // Set position to relative if not already positioned
            if (el.style.position !== 'absolute' && el.style.position !== 'fixed') {
                el.style.position = 'relative';
            }
            
            // Add handle to element
            const handle = document.createElement('div');
            handle.className = 'customization-handle';
            handle.innerHTML = '<i class="bi bi-arrows-move"></i>';
            
            // Add resize handles
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            
            // Only add handles if they don't already exist
            if (!el.querySelector('.customization-handle')) {
                el.appendChild(handle);
            }
            
            if (!el.querySelector('.resize-handle')) {
                el.appendChild(resizeHandle);
            }
            
            // Make element draggable - different settings for container elements
            $(el).draggable({
                handle: '.customization-handle',
                scroll: true,
                cursor: 'move',
                stack: '.customizable',
                containment: 'window', // Allow more freedom for containers
                stop: function(event, ui) {
                    // Update element position
                    el.style.top = ui.position.top + 'px';
                    el.style.left = ui.position.left + 'px';
                }
            });
            
            // Only make larger elements resizable (avoid issues with buttons/inputs)
            const isResizable = 
                el.tagName === 'DIV' || 
                el.tagName === 'TEXTAREA' || 
                el.classList.contains('card') ||
                el.classList.contains('form-group') ||
                el.classList.contains('col-md-6');
                
            if (isResizable) {
                $(el).resizable({
                    handles: 'all',
                    minHeight: 30,  // Smaller min height
                    minWidth: 30,   // Smaller min width
                    stop: function(event, ui) {
                        // Update element size
                        el.style.width = ui.size.width + 'px';
                        el.style.height = ui.size.height + 'px';
                    }
                });
            }
        });
    }
    
    // Disable dragging and resizing
    function disableCustomization() {
        // Handle all types of customizable elements
        
        // Buttons and small elements with mini handles
        document.querySelectorAll('.btn, button, input, select').forEach(el => {
            // Remove customizable class
            el.classList.remove('customizable');
            
            // Disable draggable
            if ($(el).hasClass('ui-draggable')) {
                $(el).draggable('destroy');
            }
            
            // Remove mini handles
            const miniHandles = el.querySelectorAll('.mini-customization-handle');
            miniHandles.forEach(handle => handle.remove());
        });
        
        // Standard customizable elements
        document.querySelectorAll('.customizable').forEach(el => {
            // Remove customizable class
            el.classList.remove('customizable');
            
            // Disable draggable and resizable
            if ($(el).hasClass('ui-draggable')) {
                $(el).draggable('destroy');
            }
            
            if ($(el).hasClass('ui-resizable')) {
                $(el).resizable('destroy');
            }
            
            // Remove handles
            const handles = el.querySelectorAll('.customization-handle, .resize-handle');
            handles.forEach(handle => handle.remove());
        });
        
        // Also clean up any remaining handles that might have been orphaned
        document.querySelectorAll('.customization-handle, .resize-handle, .mini-customization-handle').forEach(handle => {
            handle.remove();
        });
    }
    
    // Save the current layout
    function saveCustomLayout() {
        const layoutConfig = {};
        const customizableElements = getCustomizableElements();
        
        customizableElements.forEach(el => {
            layoutConfig[el.id] = {
                position: el.style.position,
                top: el.style.top,
                left: el.style.left,
                width: el.style.width,
                height: el.style.height,
                zIndex: el.style.zIndex
            };
        });
        
        // Save to local storage
        localStorage.setItem('ezreader-custom-layout', JSON.stringify(layoutConfig));
        
        showTemporaryMessage('Layout saved successfully! This layout will be loaded next time you visit.', 'success', 5000);
    }
    
    // Reset to original layout
    function resetLayout() {
        if (confirm('Are you sure you want to reset the layout to default? All your customizations will be lost.')) {
            // Restore original positions
            Object.keys(originalPositions).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const pos = originalPositions[id];
                    el.style.position = pos.position;
                    el.style.top = pos.top;
                    el.style.left = pos.left;
                    el.style.width = pos.width;
                    el.style.height = pos.height;
                    el.style.zIndex = pos.zIndex;
                }
            });
            
            // Remove saved layout from local storage
            localStorage.removeItem('ezreader-custom-layout');
            
            showTemporaryMessage('Layout has been reset to default', 'info', 3000);
        }
    }
    
    // Toggle grid visibility
    function toggleGrid(e) {
        if (e.target.checked) {
            document.body.classList.add('show-grid');
        } else {
            document.body.classList.remove('show-grid');
        }
    }
    
    // Get all customizable elements - expanded to include almost all UI elements
    function getCustomizableElements() {
        // All elements that should be individually customizable
        const elements = [
            // Main sections
            ...Array.from(document.querySelectorAll('.card, .card-body, .form-group, .button-group, .alert')),
            
            // Individual elements - using more generic selectors to get everything
            ...Array.from(document.querySelectorAll('.btn, button, input, select, textarea')),
            
            // Input and output containers
            document.getElementById('inputText'),
            document.getElementById('outputText'),
            
            // Content sources
            document.querySelector('.content-source-box'),
            
            // Navigation
            document.querySelector('.navigation-controls'),
            
            // Divs with specific roles
            ...Array.from(document.querySelectorAll('.col-md-6, .row, .mb-4, .d-flex'))
        ];
        
        // Add IDs to elements that don't have them (for saving layouts)
        elements.forEach((el, index) => {
            if (el && !el.id) {
                // Create an ID based on the element type and index
                const type = el.tagName.toLowerCase();
                el.id = `customizable-${type}-${index}`;
            }
        });
        
        // Filter out null elements and duplicates (using Set)
        return [...new Set(elements.filter(el => el !== null))];
    }
    
    // Add more specific handlers for buttons and small elements
    function setupSmallElementHandlers() {
        // Setup button draggability separately with different settings
        document.querySelectorAll('.btn, button').forEach((button, index) => {
            if (!button.id) {
                button.id = `customizable-button-${index}`;
            }
            
            // Make sure buttons can be moved
            if (button.style.position !== 'absolute' && button.style.position !== 'fixed') {
                button.style.position = 'relative';
            }
            
            // Add special handle for small elements
            const miniHandle = document.createElement('div');
            miniHandle.className = 'mini-customization-handle';
            miniHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
            
            // Only add if it doesn't already exist
            if (!button.querySelector('.mini-customization-handle')) {
                button.appendChild(miniHandle);
            }
            
            // Make draggable with specific settings for small elements
            $(button).draggable({
                handle: '.mini-customization-handle',
                scroll: true,
                cursor: 'move',
                helper: 'clone',
                opacity: 0.7,
                zIndex: 1000,
                containment: 'parent',
                stop: function(event, ui) {
                    button.style.top = ui.position.top + 'px';
                    button.style.left = ui.position.left + 'px';
                }
            });
        });
    }
    
    // Load saved layout if exists
    function loadSavedLayout() {
        const savedLayout = localStorage.getItem('ezreader-custom-layout');
        if (savedLayout) {
            try {
                const layoutConfig = JSON.parse(savedLayout);
                
                Object.keys(layoutConfig).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        const config = layoutConfig[id];
                        el.style.position = config.position || 'relative';
                        el.style.top = config.top || 'auto';
                        el.style.left = config.left || 'auto';
                        el.style.width = config.width || 'auto';
                        el.style.height = config.height || 'auto';
                        el.style.zIndex = config.zIndex || 'auto';
                    }
                });
                
                showTemporaryMessage('Custom layout loaded', 'info', 3000);
            } catch (error) {
                console.error('Error loading saved layout:', error);
            }
        }
    }
    
    // Display temporary message
    function showTemporaryMessage(message, type = 'info', duration = 5000) {
        // Create message element if not already exists with this ID
        let messageElement = document.getElementById('customizer-message');
        
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'customizer-message';
            messageElement.className = `alert alert-${type} customizer-message`;
            document.body.appendChild(messageElement);
        } else {
            messageElement.className = `alert alert-${type} customizer-message`;
        }
        
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, duration);
    }
    
    // Handle adding IDs to important elements that don't have them
    function addMissingIds() {
        // Input container
        const inputContainer = document.querySelector('.form-group:has(#inputText)');
        if (inputContainer && !inputContainer.id) {
            inputContainer.id = 'inputTextContainer';
        }
        
        // Output container
        const outputContainer = document.querySelector('.form-group:has(#outputText)');
        if (outputContainer && !outputContainer.id) {
            outputContainer.id = 'outputTextContainer';
        }
        
        // Navigation controls
        const navControls = document.querySelector('.navigation-controls');
        if (navControls && !navControls.id) {
            navControls.id = 'navigationControls';
        }
        
        // Content source box
        const contentSource = document.querySelector('.content-source-box');
        if (contentSource && !contentSource.id) {
            contentSource.id = 'contentSourceBox';
        }
        
        // Custom instructions container
        const instructionsContainer = document.querySelector('.form-group:has(#customInstructions)');
        if (instructionsContainer && !instructionsContainer.id) {
            instructionsContainer.id = 'customInstructionsContainer';
        }
        
        // Add more as needed...
    }
    
    // Initialize on load
    addMissingIds();
    
    // Load saved layout after a short delay to ensure DOM is ready
    setTimeout(loadSavedLayout, 500);
});