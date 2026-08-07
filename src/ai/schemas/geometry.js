/**
 * geometry.js — 3D Solid & Spatial Geometry Schemas
 * Standard schemas and helpers for 3D shapes (cuboids, cylinders, cones, spheres).
 */

export const VALID_QUESTION_TYPES = ["volume", "surface_area", "composite", "spatial", "comparison"];
export const VALID_LIVE_CHALLENGE_METRICS = ["volume", "surfaceArea"];
export const VALID_STEP_ACTIONS = ["add", "verify", "adjust", "observe", "answer"];
export const VALID_INPUT_MODES = ["text", "image", "multimodal"];


export function normalizeQuestionType(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return "spatial";
  return VALID_QUESTION_TYPES.includes(normalized) ? normalized : "spatial";
}

export function isGeometryMetric(metric) {
  return VALID_LIVE_CHALLENGE_METRICS.includes(metric);
}
