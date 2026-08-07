/**
 * calculus.js — Physics Fields & Calculus Schemas
 * Schemas for vector fields, charge distributions, electric dipoles, and Gaussian flux surfaces.
 */

export const FIELD_PLAYGROUND_TYPES = ["single-charge", "dipole", "gaussian-flux", "vector-field-3d"];

export function isFieldPlayground(type) {
  return FIELD_PLAYGROUND_TYPES.includes(type);
}

export function computeFieldMagnitude(charge, distance, k = 8.99e9) {
  if (distance <= 0) return 0;
  return (k * Math.abs(charge)) / (distance * distance);
}
