/**
 * index.js — Primary entry point for tutorController module ecosystem.
 * Exports modularized components: TutorSessionLifecycle, bindTutorPanelEvents, TutorEventBridge, bootstrapTutorController.
 */

export { TutorSessionLifecycle } from "./sessionLifecycle.js";
export { bindTutorPanelEvents } from "./panelBindings.js";
export { TutorEventBridge } from "./eventBridge.js";
export { bootstrapTutorController } from "./bootstrap.js";

// Legacy controller interface wrappers for seamless backward compatibility:
export {
  initTutorController,
  updateTutorLabels,
  primeTutorInputs,
  applyGeneratedPlan,
  getQuestionImagePreviewUrl,
  startTutorTurn,
} from "../tutorController.js";
