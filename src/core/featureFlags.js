/**
 * featureFlags.js — Feature Flags configuration for Scope Cutting & Cost Control.
 */

export const FEATURE_FLAGS = {
  ENABLE_GESTURE_MODE: typeof window !== "undefined" && window.ENABLE_GESTURE_MODE === true,
  ENABLE_VOICE_MODE: typeof window !== "undefined" && window.ENABLE_VOICE_MODE !== false, // default true
  ENABLE_ANALYTICS: true,
};

export function isFeatureEnabled(flagName) {
  return Boolean(FEATURE_FLAGS[flagName]);
}
