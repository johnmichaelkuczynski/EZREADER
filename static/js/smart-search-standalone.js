/**
 * Standalone Smart Search Module
 * 
 * This version is designed to work independently of the main UI structure,
 * adding a floating button that can be accessed from any layout.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Create floating button for Smart Search
    createFloatingSearchButton();
    
    // Initialize Smart Search modal
    createSmartSearchModal();
    
    // Initialize functionality
    initializeSmartSearch();
});

/**
 * Create a floating button for Smart Search that works with any layout
 */
function createFloatingSearchButton() {
    const floatingBtn = document.createElement('div');
    floatingBtn.className = 'floating-search-btn';
    floatingBtn.id = 'floatingSearchBtn';
    floatingBtn.innerHTML = '<i class="bi bi-search"></i> Find Relevant Content';
    
    document.body.appendChild(floatingBtn);
    
    // Add styles for the floating button
    const style = document.createElement('style');
    style.textContent = `
        .floating-search-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            cursor: pointer;
            z-index: 1000;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .floating-search-btn:hover {
            background-color: #218838;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .search-results-container {
            max-height: 400px;
            overflow-y: auto;
            border-radius: 5px;
        }
        
        .search-result-item {
            transition: all 0.2s ease;
            position: relative;
        }
        
        .search-result-item:hover {
            box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
        }
        
        .search-result-item .form-check-input {
            margin-top: 5px;
        }
        
        .search-result-item.selected {
            background-color: rgba(0, 123, 255, 0.1);
            border-color: #007bff;
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * Create the Smart Search modal
 */
function createSmartSearchModal() {
    const modalHtml = `
    <div class="modal fade" id="smartSearchModal" tabindex="-1" aria-labelledby="smartSearchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="smartSearchModalLabel">
                        <i class="bi bi-search"></i> Find Relevant Content
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <!-- Search controls -->
                    <div class="mb-3">
                        <label for="customSearchQueryModal" class="form-label">Search Query (optional):</label>
                        <div class="input-group">
                            <input type="text" id="customSearchQueryModal" class="form-control" placeholder="Enter custom search query or leave blank for auto-search">
                            <button class="btn btn-primary" id="runSearchBtnModal">
                                <i class="bi bi-search"></i> Search
                            </button>
                        </div>
                        <div class="form-text">
                            If left blank, we'll automatically generate relevant search terms based on your input text.
                        </div>
                    </div>
                    
                    <!-- Search info -->
                    <div class="alert alert-info">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>Search terms:</strong> <span id="searchTermsDisplay">Analyzing input text...</span>
                            </div>
                            <div>
                                <span class="badge bg-primary" id="searchResultsCount">0 results</span>
                            </div>
                        </div>
                    </div>

                    <!-- Loading spinner -->
                    <div id="searchSpinner" class="text-center my-5" style="display: none;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="mt-2">Searching for relevant content...</div>
                    </div>
                    
                    <!-- Search Results: Web Results -->
                    <div id="webResultsContainer" style="display: none;">
                        <h6 class="mb-3"><i class="bi bi-globe"></i> Web Results</h6>
                        <div id="webResults" class="search-results-container">
                            <!-- Web results will be added here dynamically -->
                        </div>
                    </div>
                    
                    <!-- Search Results: AI Suggestions -->
                    <div id="aiSuggestionsContainer" style="display: none;" class="mt-4">
                        <h6 class="mb-3"><i class="bi bi-lightbulb"></i> AI Suggestions</h6>
                        <div id="aiSuggestions" class="search-results-container">
                            <!-- AI suggestions will be added here dynamically -->
                        </div>
                    </div>
                    
                    <!-- No results message -->
                    <div id="noResultsMessage" style="display: none;" class="text-center my-5">
                        <i class="bi bi-exclamation-circle" style="font-size: 2rem;"></i>
                        <div class="mt-2">No relevant content found. Try with a different search term.</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" id="addSelectedContentBtn">
                        <i class="bi bi-plus-circle"></i> Add Selected Content
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    // Append to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild);
}

/**
 * Initialize Smart Search functionality
 */
function initializeSmartSearch() {
    // Elements
    const floatingSearchBtn = document.getElementById('floatingSearchBtn');
    const runSearchBtnModal = document.getElementById('runSearchBtnModal');
    const customSearchQueryModal = document.getElementById('customSearchQueryModal');
    const smartSearchModal = new bootstrap.Modal(document.getElementById('smartSearchModal'));
    const searchTermsDisplay = document.getElementById('searchTermsDisplay');
    const searchResultsCount = document.getElementById('searchResultsCount');
    const searchSpinner = document.getElementById('searchSpinner');
    const webResultsContainer = document.getElementById('webResultsContainer');
    const webResults = document.getElementById('webResults');
    const aiSuggestionsContainer = document.getElementById('aiSuggestionsContainer');
    const aiSuggestions = document.getElementById('aiSuggestions');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const addSelectedContentBtn = document.getElementById('addSelectedContentBtn');
    
    // Event Listeners
    floatingSearchBtn.addEventListener('click', function() {
        resetSearchUI();
        smartSearchModal.show();
    });
    
    runSearchBtnModal.addEventListener('click', handleSearch);
    customSearchQueryModal.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    addSelectedContentBtn.addEventListener('click', handleAddSelectedContent);
    
    // Handle search
    function handleSearch() {
        // Get input text
        const inputText = document.getElementById('inputText');
        if (!inputText || !inputText.value.trim()) {
            showToast('Please enter some text first', 'warning');
            return;
        }
        
        const text = inputText.value.trim();
        const customQuery = customSearchQueryModal.value.trim();
        
        // Reset UI state
        resetSearchUI();
        
        // Show loading spinner
        searchSpinner.style.display = 'block';
        
        // Call API to find relevant content
        findRelevantContent(text, customQuery);
    }
    
    // Reset search UI state
    function resetSearchUI() {
        searchTermsDisplay.textContent = 'Analyzing input text...';
        searchResultsCount.textContent = '0 results';
        searchSpinner.style.display = 'none';
        webResultsContainer.style.display = 'none';
        webResults.innerHTML = '';
        aiSuggestionsContainer.style.display = 'none';
        aiSuggestions.innerHTML = '';
        noResultsMessage.style.display = 'none';
    }
    
    // Find relevant content from API
    function findRelevantContent(text, customQuery = null) {
        // Show loading spinner
        searchSpinner.style.display = 'block';
        
        // Prepare request data
        const requestData = {
            text: text
        };
        
        if (customQuery) {
            requestData.custom_query = customQuery;
            searchTermsDisplay.textContent = customQuery;
        }
        
        // Call API
        fetch('/api/find_relevant_content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Search request failed');
            }
            return response.json();
        })
        .then(data => {
            displaySearchResults(data, customQuery);
        })
        .catch(error => {
            console.error('Error finding relevant content:', error);
            searchSpinner.style.display = 'none';
            showToast('Error finding relevant content. Please try again.', 'danger');
            
            // Show no results message
            noResultsMessage.style.display = 'block';
        });
    }
    
    // Display search results in the modal
    function displaySearchResults(data, customQuery = null) {
        // Hide loading spinner
        searchSpinner.style.display = 'none';
        
        // Set search terms if not already set by custom query
        if (!customQuery && data.search_queries && data.search_queries.length > 0) {
            searchTermsDisplay.textContent = data.search_queries.join(', ');
        }
        
        // Calculate total results
        const webResultsCount = data.web_results ? data.web_results.length : 0;
        const aiResultsCount = data.ai_suggestions ? data.ai_suggestions.length : 0;
        const totalResultsCount = webResultsCount + aiResultsCount;
        
        // Update results count
        searchResultsCount.textContent = `${totalResultsCount} results`;
        
        // Show appropriate containers based on results
        if (totalResultsCount === 0) {
            noResultsMessage.style.display = 'block';
            return;
        }
        
        // Display web results if available
        if (webResultsCount > 0) {
            webResultsContainer.style.display = 'block';
            displayWebResults(data.web_results);
        }
        
        // Display AI suggestions if available
        if (aiResultsCount > 0) {
            aiSuggestionsContainer.style.display = 'block';
            displayAISuggestions(data.ai_suggestions);
        }
    }
    
    // Display web results
    function displayWebResults(results) {
        webResults.innerHTML = '';
        
        results.forEach((result, index) => {
            const resultElement = createResultElement(result, index, 'web');
            webResults.appendChild(resultElement);
        });
    }
    
    // Display AI suggestions
    function displayAISuggestions(suggestions) {
        aiSuggestions.innerHTML = '';
        
        suggestions.forEach((suggestion, index) => {
            const suggestionElement = createResultElement(suggestion, index, 'ai');
            aiSuggestions.appendChild(suggestionElement);
        });
    }
    
    // Create a result element (either web or AI)
    function createResultElement(result, index, type) {
        const resultElement = document.createElement('div');
        resultElement.className = 'search-result-item card mb-3';
        resultElement.setAttribute('data-index', index);
        resultElement.setAttribute('data-type', type);
        
        let resultHTML = '';
        
        // Different structure based on type
        if (type === 'web') {
            resultHTML = `
                <div class="card-body">
                    <div class="form-check d-flex align-items-start">
                        <input class="form-check-input me-2" type="checkbox" value="" id="${type}-result-${index}">
                        <div>
                            <h6 class="card-title mb-1">
                                <a href="${result.link}" target="_blank" class="text-truncate d-inline-block" style="max-width: 90%;">
                                    ${result.title}
                                </a>
                                <span class="badge bg-primary ms-1">Web</span>
                            </h6>
                            <p class="card-text small text-muted mb-1">${result.link}</p>
                            <p class="card-text">${result.snippet}</p>
                        </div>
                    </div>
                </div>
            `;
        } else { // AI suggestion
            resultHTML = `
                <div class="card-body">
                    <div class="form-check d-flex align-items-start">
                        <input class="form-check-input me-2" type="checkbox" value="" id="${type}-result-${index}">
                        <div>
                            <h6 class="card-title mb-1">
                                AI Suggestion
                                <span class="badge bg-success ms-1">AI</span>
                            </h6>
                            <p class="card-text">${result.content}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        resultElement.innerHTML = resultHTML;
        return resultElement;
    }
    
    // Handle adding selected content
    function handleAddSelectedContent() {
        const selectedItems = getSelectedItems();
        
        if (selectedItems.length === 0) {
            showToast('Please select at least one result to add', 'warning');
            return;
        }
        
        // Combine all selected content
        let combinedContent = '';
        
        selectedItems.forEach(item => {
            if (item.type === 'web') {
                combinedContent += `## ${item.title}\n${item.snippet}\nSource: ${item.link}\n\n`;
            } else {
                combinedContent += `## AI Suggestion\n${item.content}\n\n`;
            }
        });
        
        // Add to output textarea (or wherever appropriate in the current UI)
        const outputText = document.getElementById('outputText');
        if (outputText) {
            if (outputText.value) {
                outputText.value += '\n\n' + combinedContent;
            } else {
                outputText.value = combinedContent;
            }
        }
        
        // Close modal
        smartSearchModal.hide();
        
        // Show success notification
        showToast('Content has been added successfully', 'success');
    }
    
    // Get all selected items
    function getSelectedItems() {
        const selectedItems = [];
        
        // Get all checked checkboxes
        const checkboxes = document.querySelectorAll('.search-result-item input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            const itemElement = checkbox.closest('.search-result-item');
            const index = parseInt(itemElement.getAttribute('data-index'));
            const type = itemElement.getAttribute('data-type');
            
            if (type === 'web') {
                const title = itemElement.querySelector('.card-title a').textContent.trim();
                const link = itemElement.querySelector('.card-title a').getAttribute('href');
                const snippet = itemElement.querySelector('.card-text:not(.small)').textContent.trim();
                
                selectedItems.push({
                    type: 'web',
                    title: title,
                    link: link,
                    snippet: snippet
                });
            } else { // AI suggestion
                const content = itemElement.querySelector('.card-text').textContent.trim();
                
                selectedItems.push({
                    type: 'ai',
                    content: content
                });
            }
        });
        
        return selectedItems;
    }
    
    // Show a notification
    function showToast(message, type = 'info') {
        // Check if we have the showToast function in main.js
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // Create a simple toast if the main function isn't available
            const toast = document.createElement('div');
            toast.className = `toast-notification toast-${type}`;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 3000);
            
            // Add style for the toast if not already present
            if (!document.querySelector('#toast-style')) {
                const toastStyle = document.createElement('style');
                toastStyle.id = 'toast-style';
                toastStyle.textContent = `
                    .toast-notification {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 10px 15px;
                        background: #333;
                        color: white;
                        border-radius: 4px;
                        z-index: 10000;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                        max-width: 300px;
                    }
                    .toast-success { background-color: #28a745; }
                    .toast-warning { background-color: #ffc107; color: #333; }
                    .toast-danger { background-color: #dc3545; }
                    .toast-info { background-color: #17a2b8; }
                `;
                document.head.appendChild(toastStyle);
            }
        }
    }
}