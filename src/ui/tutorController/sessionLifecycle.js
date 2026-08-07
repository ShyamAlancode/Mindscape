/**
 * sessionLifecycle.js — Handles session startup, stage advancement, and teardown for TutorController.
 */

export class TutorSessionLifecycle {
  constructor(options = {}) {
    this.stage = options.initialStage || "orient";
    this.history = [];
    this.active = false;
  }

  startSession(initialState = {}) {
    this.active = true;
    this.stage = initialState.stage || "orient";
    this.history = initialState.history || [];
    return { active: this.active, stage: this.stage };
  }

  advanceStage(nextStage) {
    if (!nextStage) return this.stage;
    this.stage = nextStage;
    return this.stage;
  }

  recordTurn(turn) {
    if (turn) {
      this.history.push({ ...turn, timestamp: Date.now() });
    }
    return this.history;
  }

  reset() {
    this.stage = "orient";
    this.history = [];
    this.active = false;
  }
}
