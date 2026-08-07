/**
 * productAnalytics.js — Product & Feature Usage Analytics.
 * Tracks feature adoption, session duration, and user interaction funnels.
 */

class ProductAnalytics {
  constructor() {
    this.sessionStart = Date.now();
    this.events = [];
  }

  track(eventName, properties = {}) {
    const event = {
      name: eventName,
      properties,
      timestamp: Date.now(),
      sessionDurationMs: Date.now() - this.sessionStart,
    };
    this.events.push(event);
    if (typeof window !== "undefined" && window.DEBUG_ANALYTICS) {
      console.log("[Analytics]", eventName, properties);
    }
  }

  getEvents() {
    return [...this.events];
  }
}

export const analytics = new ProductAnalytics();
