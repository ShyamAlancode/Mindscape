/**
 * panelBindings.js — Handles DOM event bindings and UI updates for the Tutor Panel.
 */

export function bindTutorPanelEvents(containerEl, callbacks = {}) {
  if (!containerEl) return () => {};

  const sendBtn = containerEl.querySelector("#tutor-send-btn") || containerEl.querySelector(".tutor-send-btn");
  const inputEl = containerEl.querySelector("#tutor-input") || containerEl.querySelector(".tutor-input");

  function handleSend() {
    const text = inputEl ? inputEl.value.trim() : "";
    if (text && typeof callbacks.onSendMessage === "function") {
      callbacks.onSendMessage(text);
      if (inputEl) inputEl.value = "";
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", handleSend);
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  return function cleanup() {
    if (sendBtn) sendBtn.removeEventListener("click", handleSend);
  };
}
