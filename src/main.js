import { bootstrapApp } from "./app.js";
import { initTutorController, updateTutorLabels } from "./ui/tutorController.js";
import { initDemoMode } from "./ui/demoMode.js";
import { initFloatingChat } from "./ui/chatController.js?v=2";
import { MeasurementToolManager } from "./render/measurementTools.js";
import { exportPdfReport } from "./ui/reportExporter.js";
import { initChallengeUI } from "./ui/challengePanel.js";
import { initClassroomUI } from "./ui/classroomPanel.js";
import { initPhysicsController } from "./ui/physicsController.js";
import { setupDragAndDropImporter } from "./scene/modelImporter.js";

const appContext = bootstrapApp();
const isDemoMode = new URLSearchParams(window.location.search).get("demo") === "true";

// Initialize tutor system
initTutorController(appContext);
if (isDemoMode) {
  void initDemoMode();
}

// Initialize Chatbot
initFloatingChat();

// Initialize Gamification Banner
initChallengeUI();

// Initialize Real-Time Classroom, Physics Controller & CAD Drag-and-Drop
initClassroomUI(appContext);
initPhysicsController(appContext);
setupDragAndDropImporter(document.querySelector(".stage-wrap"));

// ─── 3D Measurement & Toolbar Wiring ─────────────────────────────────────────
let measurementTools = null;
if (appContext?.world) {
  measurementTools = new MeasurementToolManager(appContext.world);
}

const rulerBtn = document.getElementById("rulerBtn");
const protractorBtn = document.getElementById("protractorBtn");
const clearMeasurementsBtn = document.getElementById("clearMeasurementsBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");

if (rulerBtn) {
  rulerBtn.addEventListener("click", () => {
    if (!measurementTools && appContext?.world) {
      measurementTools = new MeasurementToolManager(appContext.world);
    }
    const isActive = rulerBtn.classList.contains("active");
    rulerBtn.classList.toggle("active", !isActive);
    if (protractorBtn) protractorBtn.classList.remove("active");
    measurementTools?.setMode(!isActive ? "ruler" : "off");
  });
}

if (protractorBtn) {
  protractorBtn.addEventListener("click", () => {
    if (!measurementTools && appContext?.world) {
      measurementTools = new MeasurementToolManager(appContext.world);
    }
    const isActive = protractorBtn.classList.contains("active");
    protractorBtn.classList.toggle("active", !isActive);
    if (rulerBtn) rulerBtn.classList.remove("active");
    measurementTools?.setMode(!isActive ? "protractor" : "off");
  });
}

if (clearMeasurementsBtn) {
  clearMeasurementsBtn.addEventListener("click", () => {
    measurementTools?.clearAllMeasurements();
    if (rulerBtn) rulerBtn.classList.remove("active");
    if (protractorBtn) protractorBtn.classList.remove("active");
    measurementTools?.setMode("off");
  });
}

if (exportPdfBtn) {
  exportPdfBtn.addEventListener("click", () => {
    const questionInput = document.getElementById("questionInput");
    const questionText = questionInput?.value || "Mindscape 3D STEM Learning Lesson";
    exportPdfReport({
      world: appContext?.world,
      questionText,
      lessonPlan: null,
      history: [],
      finalAnswer: null,
    });
  });
}

// Add label rendering and measurement updates to the animation loop
function tutorRenderLoop() {
  updateTutorLabels();
  measurementTools?.update();
  requestAnimationFrame(tutorRenderLoop);
}
requestAnimationFrame(tutorRenderLoop);
