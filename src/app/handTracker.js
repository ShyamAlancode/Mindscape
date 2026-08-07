/**
 * handTracker.js — MediaPipe hand tracking lifecycle and gesture signal dispatch.
 * Includes graceful error handling for denied cameras or WASM load failures.
 */

import { FilesetResolver, HandLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class HandTrackerController {
  constructor(options = {}) {
    this.videoEl = options.videoEl || null;
    this.overlayEl = options.overlayEl || null;
    this.landmarker = null;
    this.isRunning = false;
    this.onFrame = options.onFrame || null;
    this.onError = options.onError || null;
  }

  async init() {
    if (this.landmarker) return true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.42,
        minHandPresenceConfidence: 0.38,
        minTrackingConfidence: 0.38,
      });
      return true;
    } catch (err) {
      console.warn("[HandTrackerController] Initialization failed:", err.message);
      this.onError?.(err);
      return false;
    }
  }

  async startCamera() {
    if (!this.videoEl) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { max: 30 } },
      });
      this.videoEl.srcObject = stream;
      await this.videoEl.play();
      this.isRunning = true;
      this.loop();
      return true;
    } catch (err) {
      console.warn("[HandTrackerController] Camera permission denied or device unavailable:", err.message);
      this.onError?.(err);
      return false;
    }
  }

  loop() {
    if (!this.isRunning || !this.landmarker || !this.videoEl) return;
    const now = performance.now();

    if (this.videoEl.readyState >= 2) {
      try {
        const results = this.landmarker.detectForVideo(this.videoEl, now);
        this.onFrame?.(results, now);
      } catch (err) {
        console.warn("[HandTrackerController] Detection frame error:", err.message);
      }
    }

    requestAnimationFrame(() => this.loop());
  }

  stop() {
    this.isRunning = false;
    if (this.videoEl?.srcObject) {
      const tracks = this.videoEl.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      this.videoEl.srcObject = null;
    }
  }
}
