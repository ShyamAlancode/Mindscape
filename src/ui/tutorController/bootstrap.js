/**
 * bootstrap.js — Orchestrates initialization of TutorSessionLifecycle, PanelBindings, and EventBridge.
 */

import { TutorSessionLifecycle } from "./sessionLifecycle.js";
import { bindTutorPanelEvents } from "./panelBindings.js";
import { TutorEventBridge } from "./eventBridge.js";

export function bootstrapTutorController(containerEl, options = {}) {
  const lifecycle = new TutorSessionLifecycle(options);
  const bridge = new TutorEventBridge();

  const cleanupBindings = bindTutorPanelEvents(containerEl, {
    onSendMessage: (msg) => {
      bridge.emit("message", { text: msg });
    },
  });

  return {
    lifecycle,
    bridge,
    destroy() {
      cleanupBindings();
      lifecycle.reset();
    },
  };
}
