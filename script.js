let currentPreset = "fast"; // Set "fast" as the default model
let apiKey = "";

// Create a custom extension to handle code blocks with language
const codeLanguageExtension = {
  type: 'output',
  filter: function(text) {
    return text.replace(/<pre><code class="([^"]+)">/g, function(match, language) {
      // Extract the language name after 'language-' if it exists
      const langMatch = language.match(/language-(\w+)/);
      if (langMatch) {
        return `<pre><code class="language-${langMatch[1]}">`;
      }
      return match;
    });
  }
};

let converter = new showdown.Converter({
  tables: true,
  tasklists: true,
  strikethrough: true,
  simplifiedAutoLink: true,
  parseImgDimensions: true,
  simpleLineBreaks: true,
  ghCodeBlocks: true,
  ghMentions: false,
  emoji: true,
  openLinksInNewWindow: true
}); // Initialize Showdown converter with options

// Add the custom extension
converter.addExtension(codeLanguageExtension);

// DOM Elements
const apiKeyInput = document.getElementById("apiKey");
const apiKeySection = document.getElementById("apiKeySection");
const presetSelect = document.getElementById("presetSelect");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const currentAgentDisplay = document.getElementById("currentAgent");
const clearChatButton = document.getElementById("clearChat");
const editApiKeyBtn = document.getElementById("editApiKey");

// Check for saved API key
document.addEventListener("DOMContentLoaded", () => {
  // Set "fast" as the default selected value in the dropdown
  presetSelect.value = "fast";
  // Update the displayed agent name
  currentAgentDisplay.textContent = presetSelect.options[presetSelect.selectedIndex].text;
  
  // Check for saved API key
  const savedApiKey = localStorage.getItem("chatgpt_api_key");
  
  if (savedApiKey) {
    apiKey = savedApiKey;
    apiKeyInput.value = savedApiKey;
    // Hide API key section if we already have a key
    apiKeySection.classList.add("collapsed");
    editApiKeyBtn.classList.remove("hidden");
  }
  
  updateSendButtonState();

  // Mobile keyboard handler
  handleMobileKeyboard();
});

// Event Listeners
apiKeyInput.addEventListener("input", (e) => {
  apiKey = e.target.value;
  if (apiKey.trim()) {
    localStorage.setItem("chatgpt_api_key", apiKey);
    // Collapse the API key section when key is entered
    apiKeySection.classList.add("collapsed");
    editApiKeyBtn.classList.remove("hidden");
  }
  updateSendButtonState();
});

// Edit API key button
editApiKeyBtn.addEventListener("click", () => {
  apiKeySection.classList.remove("collapsed");
  editApiKeyBtn.classList.add("hidden");
  setTimeout(() => apiKeyInput.focus(), 300);
});

presetSelect.addEventListener("change", () => {
  currentPreset = presetSelect.value;
  currentAgentDisplay.textContent = presetSelect.options[presetSelect.selectedIndex].text;
  updateSendButtonState();
});

userInput.addEventListener("input", updateSendButtonState);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

clearChatButton.addEventListener("click", () => {
  chatMessages.innerHTML = "";
  showToast("Chat cleared!");
});

function updateSendButtonState() {
  sendButton.disabled = !apiKey || !currentPreset || !userInput.value.trim();
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

// This function only adds messages to the UI and doesn't store them for API calls
function addMessage(content, isUser = false) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  messageDiv.classList.add(isUser ? "user-message" : "assistant-message");
  
  // For assistant messages, create a wrapper to hold both message and copy button
  if (!isUser) {
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    
    // Convert markdown to HTML for assistant messages
    messageContent.innerHTML = converter.makeHtml(content);
    
    const copyButton = document.createElement("button");
    copyButton.className = "copy-btn";
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyButton.title = "Copy to clipboard";
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(content)
        .then(() => showToast("Copied to clipboard!"))
        .catch(err => showToast("Failed to copy text"));
    });
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(copyButton);
    
    // Apply Prism.js syntax highlighting after message is added to DOM
    setTimeout(() => {
      if (window.Prism) {
        messageContent.querySelectorAll('pre code').forEach((block) => {
          if (!block.className.includes('language-')) {
            block.className = 'language-javascript'; // Default to JavaScript
          }
          Prism.highlightElement(block);
        });
      }
    }, 0);
  } else {
    messageDiv.textContent = content;
  }
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  // No message history is tracked for API calls - each request is independent
}

async function sendMessage() {
  if (!apiKey || !currentPreset || !userInput.value.trim()) return;

  const message = userInput.value.trim();
  addMessage(message, true);
  userInput.value = "";
  updateSendButtonState();

  // Create improved loading indicator
  const loadingMessage = document.createElement("div");
  loadingMessage.classList.add("message", "assistant-message", "loading");
  
  const loadingDots = document.createElement("div");
  loadingDots.className = "loading-dots";
  
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    loadingDots.appendChild(dot);
  }
  
  loadingMessage.appendChild(loadingDots);
  chatMessages.appendChild(loadingMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // Determine which model to use based on the preset
    let modelToUse;
    
    if (currentPreset === "fast") {
      modelToUse = "gpt-4.1-mini"; // Mini for Fast mode
    } else if (currentPreset === "corrector") {
      modelToUse = "gpt-4.1-nano"; // Nano for Text Corrector
    }
    
    // Each message is sent as an independent request without chat history
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: getSystemMessage(currentPreset),
          },
          {
            role: "user",
            content: message,
          },
          // No chat history is stored or sent
        ],
        temperature: currentPreset === "corrector" ? 0.3 : 0.7, // Lower temperature for corrector
      }),
    });

    // Remove loading indicator
    chatMessages.removeChild(loadingMessage);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "API request failed");
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    addMessage(assistantMessage, false);
  } catch (error) {
    // Remove loading indicator in case of error
    if (chatMessages.contains(loadingMessage)) {
      chatMessages.removeChild(loadingMessage);
    }

    addMessage(
      `Error: ${error.message || "Failed to get response from ChatGPT. Please check your API key and try again."}`,
      false
    );
    console.error("Error:", error);
  }
}

function getSystemMessage(preset) {
  // These are placeholder system messages - you can replace them with your own
  const systemMessages = {
    fast:
      "You are a fast model; respond very quickly.",
    corrector:
      "You are using GPT-4.1-nano. Our output is exactly the same thing the user wrote, but corrected grammatically and orthographically. Be very concise.",
  };
  return systemMessages[preset] || "";
}

// Handle mobile keyboard opening/closing
function handleMobileKeyboard() {
  const container = document.querySelector('.container');
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  
  if (isMobile) {
    // When input is focused (keyboard appears)
    userInput.addEventListener('focus', () => {
      container.classList.add('keyboard-open');
      // Scroll to bottom when keyboard opens
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 300);
    });
    
    // When input loses focus (keyboard closes)
    userInput.addEventListener('blur', () => {
      container.classList.remove('keyboard-open');
    });
    
    // Detect orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 300);
    });
    
    // Ensure scrolling works properly on iOS
    chatMessages.style.webkitOverflowScrolling = 'touch';
  }
}
