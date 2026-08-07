import renderMathInElement from "../../node_modules/katex/dist/contrib/auto-render.mjs";

const toggleBtn = document.getElementById("floatingChatToggle");
const chatContainer = document.getElementById("floatingChatbot");
const closeBtn = document.getElementById("floatingChatClose");
const historyEl = document.getElementById("floatingChatHistory");
const formEl = document.getElementById("floatingChatForm");
const inputEl = document.getElementById("floatingChatInput");

const chatHistory = [];
// This will be populated dynamically from the app state
let currentSceneContext = null;

export function updateChatContext(context) {
  currentSceneContext = context;
}

export function initFloatingChat() {
  toggleBtn.addEventListener("click", () => {
    chatContainer.classList.remove("hidden");
    toggleBtn.classList.add("hidden");
    inputEl.focus();
  });

  closeBtn.addEventListener("click", () => {
    chatContainer.classList.add("hidden");
    toggleBtn.classList.remove("hidden");
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formEl.dispatchEvent(new Event("submit"));
    }
  });

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;

    // 1. Add User Message
    appendMessage("user", text);
    chatHistory.push({ role: "user", content: text });
    inputEl.value = "";

    // 2. Add empty Assistant Message
    const msgEl = appendMessage("assistant", "");
    const p = msgEl.querySelector("p");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          context: currentSceneContext
        })
      });

      if (!response.ok) {
        throw new Error("Failed to connect to Chatbot.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        
        // Basic rendering: replace newlines with <br>
        p.innerHTML = fullText.replace(/\n/g, "<br/>");
        historyEl.scrollTop = historyEl.scrollHeight;
      }

      chatHistory.push({ role: "assistant", content: fullText });

      // Process Math explicitly using KaTeX auto-render if available
      try {
        renderMathInElement(msgEl, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
          ]
        });
      } catch (mathErr) {
        console.warn("KaTeX render failed for chat:", mathErr);
      }

    } catch (err) {
      console.error(err);
      p.innerHTML = "<i>Sorry, the connection failed. Please try again.</i>";
    }
  });
}

function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);
  historyEl.appendChild(div);
  historyEl.scrollTop = historyEl.scrollHeight;
  return div;
}
