let currentPreset = null;
let apiKey = "";

// DOM Elements
const apiKeyInput = document.getElementById("apiKey");
const presetButtons = document.querySelectorAll(".preset-btn");
const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

// Event Listeners
apiKeyInput.addEventListener("input", (e) => {
  apiKey = e.target.value;
  updateSendButtonState();
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    presetButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentPreset = button.dataset.preset;
    updateSendButtonState();
  });
});

userInput.addEventListener("input", updateSendButtonState);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

function updateSendButtonState() {
  sendButton.disabled = !apiKey || !currentPreset || !userInput.value.trim();
}

// This function only adds messages to the UI and doesn't store them for API calls
function addMessage(content, isUser = false) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  messageDiv.classList.add(isUser ? "user-message" : "assistant-message");
  messageDiv.textContent = content;
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
  chatMessages.appendChild(loadingMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // Each message is sent as an independent request without chat history
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano-2025-04-14", // Using the fastest model available
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
        temperature: 0.7,
      }),
    });

    // Remove loading indicator
    chatMessages.removeChild(loadingMessage);

    if (!response.ok) {
      throw new Error("API request failed");
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
      "Error: Failed to get response from ChatGPT. Please check your API key and try again.",
      false
    );
    console.error("Error:", error);
  }
}

function getSystemMessage(preset) {
  // These are placeholder system messages - you can replace them with your own
  const systemMessages = {
    corrector:
      "Our output is exactly the same thing the user wrote, but corrected grammatically and orthographically.",
    prompt:
      "You are a prompt engineering expert. Help users create effective prompts for various AI models and applications.",
    planner:
      "You are a project planning assistant. Help users break down projects into manageable tasks and create effective project plans.",
  };
  return systemMessages[preset] || "";
}
