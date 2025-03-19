/**
 * Neo N3 MCP Chat Interface
 * 
 * This script handles the AI chat functionality, including:
 * - API key management
 * - Message sending and receiving
 * - UI interactions
 * - Chat history persistence
 * - MCP operations execution
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const apiKeyInput = document.getElementById('openroute-api-key');
    const toggleApiKeyButton = document.getElementById('toggle-api-key');
    const apiKeyNotice = document.getElementById('api-key-notice');
    const modelSelect = document.getElementById('model-select');
    const streamToggle = document.getElementById('stream-toggle');
    const newChatButton = document.getElementById('new-chat');
    const clearHistoryButton = document.getElementById('clear-history');
    const exampleQueries = document.querySelectorAll('.example-query');
    const connectionStatus = document.querySelector('.connection-status');

    // State management
    let currentConversation = [];
    let isProcessingMessage = false;
    let currentMessageElement = null;
    let abortController = null;
    let apiKeyValid = false;
    let mcpOperationRegex = /{{mcp:([a-z_]+):({.*?})}}/g;

    // Initialize
    initializeChatInterface();

    // Initialize chat interface
    function initializeChatInterface() {
        loadApiKey();
        loadSettings();
        loadChatHistory();
        setupEventListeners();
        updateConnectionStatus();
        checkServerStatus();
    }

    // Setup event listeners
    function setupEventListeners() {
        // Form submission
        chatForm.addEventListener('submit', handleChatSubmit);

        // API key management
        apiKeyInput.addEventListener('input', handleApiKeyInput);
        toggleApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
        
        // Button actions
        newChatButton.addEventListener('click', startNewChat);
        clearHistoryButton.addEventListener('click', confirmClearHistory);

        // Example queries
        exampleQueries.forEach(example => {
            example.addEventListener('click', () => {
                if (!isProcessingMessage && apiKeyValid) {
                    const query = example.dataset.query;
                    chatInput.value = query;
                    chatInput.dispatchEvent(new Event('input'));
                    chatForm.dispatchEvent(new Event('submit'));
                }
            });
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', autoResizeTextarea);

        // Save settings on change
        modelSelect.addEventListener('change', saveSettings);
        streamToggle.addEventListener('change', saveSettings);

        // Keyboard shortcuts
        chatInput.addEventListener('keydown', handleInputKeydown);
    }

    // Handle chat form submission
    async function handleChatSubmit(e) {
        e.preventDefault();
        const message = chatInput.value.trim();
        
        if (!message || isProcessingMessage || !apiKeyValid) return;
        
        isProcessingMessage = true;
        abortController = new AbortController();
        
        // Add user message to UI
        addMessageToUI('user', message);
        
        // Clear input and adjust height
        chatInput.value = '';
        autoResizeTextarea();
        
        try {
            // Add loading indicator for assistant message
            currentMessageElement = addLoadingMessage();
            
            // Update state
            currentConversation.push({ role: 'user', content: message });
            
            // Call API to get response
            await getAIResponse(message);
            
            // Save conversation to localStorage
            saveChatHistory();
            
        } catch (error) {
            console.error('Error processing message:', error);
            updateLoadingMessage('Sorry, there was an error processing your message. Please try again.');
        } finally {
            isProcessingMessage = false;
            abortController = null;
            scrollToBottom();
        }
    }

    // Get AI response from API
    async function getAIResponse(message) {
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;
        const shouldStream = streamToggle.checked;
        
        try {
            // Prepare request options
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: currentConversation,
                    stream: shouldStream
                }),
                signal: abortController.signal
            };
            
            // Get API endpoint
            const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            
            // Handle streaming and non-streaming responses differently
            if (shouldStream) {
                await handleStreamingResponse(apiUrl, requestOptions);
            } else {
                await handleNonStreamingResponse(apiUrl, requestOptions);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                updateLoadingMessage('Message generation was canceled.');
            } else {
                throw error;
            }
        }
    }

    // Handle streaming response
    async function handleStreamingResponse(url, options) {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialLine = '';
        let fullContent = '';
        
        updateLoadingMessage('');  // Clear loading message
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = (partialLine + chunk).split('\n');
                partialLine = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content || '';
                            
                            if (content) {
                                fullContent += content;
                                appendToMessageContent(content);
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            }
            
            // Add the complete message to the conversation
            if (fullContent) {
                currentConversation.push({
                    role: 'assistant',
                    content: fullContent
                });
                
                // Process any MCP operations in the response
                processMcpOperations(fullContent, currentMessageElement);
            }
            
        } catch (error) {
            console.error('Error in stream reading:', error);
            throw error;
        }
    }

    // Handle non-streaming response
    async function handleNonStreamingResponse(url, options) {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        // Update UI with full message
        updateLoadingMessage(content);
        
        // Add to conversation
        currentConversation.push({
            role: 'assistant',
            content: content
        });
        
        // Process any MCP operations in the response
        processMcpOperations(content, currentMessageElement);
    }

    // Process MCP operations in the message content
    async function processMcpOperations(content, messageElement) {
        if (!content || !content.includes('{{mcp:')) return;
        
        const matches = [...content.matchAll(mcpOperationRegex)];
        if (!matches || matches.length === 0) return;
        
        // For each MCP operation in the content
        for (const match of matches) {
            const [fullMatch, operation, paramsJson] = match;
            
            try {
                // Parse parameters
                const params = JSON.parse(paramsJson);
                
                // Create a unique ID for this operation
                const operationId = `mcp-op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                
                // Create a placeholder for the operation result
                const opPlaceholder = document.createElement('div');
                opPlaceholder.id = operationId;
                opPlaceholder.className = 'mcp-result loading';
                opPlaceholder.innerHTML = `
                    <div class="loading-indicator">
                        <span>Executing Neo N3 MCP operation: ${operation}</span>
                        <div class="loading-dots"><span></span><span></span><span></span></div>
                    </div>
                `;
                
                // Replace the operation text with the placeholder
                const contentElement = messageElement.querySelector('.message-content');
                const htmlContent = contentElement.innerHTML;
                contentElement.innerHTML = htmlContent.replace(
                    fullMatch,
                    `<div id="${operationId}" class="mcp-result loading">
                        <div class="loading-indicator">
                            <span>Executing Neo N3 MCP operation: ${operation}</span>
                            <div class="loading-dots"><span></span><span></span><span></span></div>
                        </div>
                    </div>`
                );
                
                // Execute the MCP operation
                await executeMcpOperation(operation, params, operationId);
                
            } catch (error) {
                console.error('Error processing MCP operation:', error);
                
                // Replace the operation with an error message
                const contentElement = messageElement.querySelector('.message-content');
                const htmlContent = contentElement.innerHTML;
                contentElement.innerHTML = htmlContent.replace(
                    fullMatch,
                    `<div class="mcp-result error">
                        <div class="mcp-result-header">
                            <span class="mcp-operation-name">Error</span>
                            <span class="mcp-operation-status error">ERROR</span>
                        </div>
                        <div class="mcp-result-error">Failed to process MCP operation: ${error.message}</div>
                    </div>`
                );
            }
        }
    }

    // Execute an MCP operation and update the UI
    async function executeMcpOperation(operation, params, elementId) {
        try {
            // Find the element to update
            const element = document.getElementById(elementId);
            if (!element) {
                throw new Error(`Element with ID ${elementId} not found`);
            }
            
            // Update to connecting status
            element.innerHTML = `
                <div class="loading-indicator">
                    <span>Connecting to Neo N3 MCP server...</span>
                    <div class="loading-dots"><span></span><span></span><span></span></div>
                </div>
            `;
            
            // Call the MCP bridge function
            const response = await fetch('/api/mcp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    operation,
                    params
                }),
                timeout: 15000 // 15 seconds timeout
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`MCP server error: ${response.status} ${response.statusText}\n${errorText}`);
            }
            
            const data = await response.json();
            
            // Update the UI with the result
            if (data.success) {
                element.innerHTML = `
                    <div class="mcp-result-header">
                        <span class="mcp-operation-name">${operation}</span>
                        <span class="mcp-operation-status success">SUCCESS</span>
                    </div>
                    <pre class="mcp-result-data">${JSON.stringify(data.result, null, 2)}</pre>
                `;
                element.classList.remove('loading');
                element.classList.add('success');
            } else {
                element.innerHTML = `
                    <div class="mcp-result-header">
                        <span class="mcp-operation-name">${operation}</span>
                        <span class="mcp-operation-status error">ERROR</span>
                    </div>
                    <div class="mcp-result-error">${data.error || 'An unknown error occurred'}</div>
                `;
                element.classList.remove('loading');
                element.classList.add('error');
            }
            
        } catch (error) {
            console.error(`Error executing MCP operation ${operation}:`, error);
            
            // Update the UI with the error
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = `
                    <div class="mcp-result-header">
                        <span class="mcp-operation-name">${operation}</span>
                        <span class="mcp-operation-status error">ERROR</span>
                    </div>
                    <div class="mcp-result-error">${error.message || 'An unknown error occurred'}</div>
                `;
                element.classList.remove('loading');
                element.classList.add('error');
            }
        }
    }

    // Add a message to the UI
    function addMessageToUI(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (role === 'user') {
            messageContent.textContent = content;
        } else {
            messageContent.innerHTML = formatMessage(content);
        }
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        
        return messageDiv;
    }

    // Add loading message
    function addLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const loadingDots = document.createElement('div');
        loadingDots.className = 'loading-dots';
        loadingDots.innerHTML = '<span></span><span></span><span></span>';
        
        messageContent.appendChild(loadingDots);
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        scrollToBottom();
        return messageDiv;
    }

    // Update loading message with content
    function updateLoadingMessage(content) {
        if (currentMessageElement) {
            const messageContent = currentMessageElement.querySelector('.message-content');
            messageContent.innerHTML = formatMessage(content);
        }
    }

    // Append text to existing message
    function appendToMessageContent(text) {
        if (currentMessageElement) {
            const messageContent = currentMessageElement.querySelector('.message-content');
            const formattedText = formatMessage(text, true);
            
            if (messageContent.innerHTML.includes('loading-dots')) {
                messageContent.innerHTML = formattedText;
            } else {
                // We need to handle the case when we're appending to already formatted content
                // This is simplified and might need enhancement for complex markdown
                messageContent.innerHTML += formattedText;
            }
        }
    }

    // Format message with markdown and code highlighting
    function formatMessage(message, isChunk = false) {
        if (!message) return '';
        
        // Simple markdown-like formatting
        // This is a basic implementation - a real app would use a proper markdown parser
        
        // Code blocks
        message = message.replace(/```([\s\S]*?)```/g, '<pre class="code-block">$1</pre>');
        
        // Inline code
        message = message.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Bold
        message = message.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        message = message.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Links
        message = message.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Newlines to <br>
        if (!isChunk) {
            message = message.replace(/\n/g, '<br>');
        }
        
        return message;
    }

    // API key management
    function handleApiKeyInput() {
        const apiKey = apiKeyInput.value.trim();
        apiKeyValid = apiKey.length > 0;
        
        // Update UI based on API key status
        updateApiKeyStatus();
        
        // Save API key
        if (apiKeyValid) {
            localStorage.setItem('openrouteApiKey', btoa(apiKey));
        }
    }

    // Toggle API key visibility
    function toggleApiKeyVisibility() {
        const type = apiKeyInput.type;
        apiKeyInput.type = type === 'password' ? 'text' : 'password';
        
        const icon = toggleApiKeyButton.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye-slash' : 'fas fa-eye';
    }

    // Update UI based on API key status
    function updateApiKeyStatus() {
        if (apiKeyValid) {
            apiKeyNotice.style.display = 'none';
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.focus();
        } else {
            apiKeyNotice.style.display = 'flex';
            chatInput.disabled = true;
            sendButton.disabled = true;
        }
    }

    // Load API key from localStorage
    function loadApiKey() {
        const savedApiKey = localStorage.getItem('openrouteApiKey');
        
        if (savedApiKey) {
            try {
                apiKeyInput.value = atob(savedApiKey);
                handleApiKeyInput();
            } catch (e) {
                console.error('Error decoding API key:', e);
                localStorage.removeItem('openrouteApiKey');
            }
        }
    }

    // Load settings from localStorage
    function loadSettings() {
        const savedModel = localStorage.getItem('selectedModel');
        const streamingSetting = localStorage.getItem('streamResponse');
        
        if (savedModel) {
            modelSelect.value = savedModel;
        }
        
        if (streamingSetting !== null) {
            streamToggle.checked = streamingSetting === 'true';
        }
    }

    // Save settings to localStorage
    function saveSettings() {
        localStorage.setItem('selectedModel', modelSelect.value);
        localStorage.setItem('streamResponse', streamToggle.checked);
    }

    // Auto-resize textarea based on content
    function autoResizeTextarea() {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    }

    // Handle keyboard shortcuts
    function handleInputKeydown(e) {
        // Send on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    }

    // Check server connection status
    function checkServerStatus() {
        fetch('/api/status')
            .then(response => {
                if (response.ok) {
                    connectionStatus.innerHTML = '<i class="fas fa-robot"></i> AI Integration';
                    connectionStatus.className = 'connection-status connected';
                } else {
                    updateOfflineStatus();
                }
            })
            .catch(() => {
                updateOfflineStatus();
            });
    }

    // Update status when offline
    function updateOfflineStatus() {
        connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        connectionStatus.className = 'connection-status disconnected';
    }

    // Update connection status
    function updateConnectionStatus() {
        if (navigator.onLine) {
            checkServerStatus();
        } else {
            updateOfflineStatus();
        }
    }

    // Start a new chat
    function startNewChat() {
        // Clear conversation state
        currentConversation = [];
        
        // Clear UI
        const welcomeMessage = document.querySelector('.system-message');
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeMessage);
        
        // Save empty conversation
        saveChatHistory();
    }

    // Confirm and clear chat history
    function confirmClearHistory() {
        const confirm = window.confirm('Are you sure you want to clear all conversation history?');
        
        if (confirm) {
            localStorage.removeItem('chatHistory');
            startNewChat();
        }
    }

    // Save chat history to localStorage
    function saveChatHistory() {
        try {
            localStorage.setItem('chatHistory', JSON.stringify(currentConversation));
        } catch (e) {
            console.error('Error saving chat history:', e);
            // If localStorage is full, we could implement a cleanup strategy
        }
    }

    // Load chat history from localStorage
    function loadChatHistory() {
        try {
            const savedHistory = localStorage.getItem('chatHistory');
            
            if (savedHistory) {
                currentConversation = JSON.parse(savedHistory);
                
                // Rebuild UI from conversation history
                rebuildConversationUI();
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }

    // Rebuild conversation UI from history
    function rebuildConversationUI() {
        // Clear messages except welcome message
        const welcomeMessage = document.querySelector('.system-message');
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeMessage);
        
        // Add all messages from history
        currentConversation.forEach(msg => {
            addMessageToUI(msg.role, msg.content);
        });
    }

    // Scroll to bottom of chat
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Listen for online/offline status changes
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}); 