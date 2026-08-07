/**
 * vectors.js — Vector & Analytic Geometry Schemas
 * Schemas for 3D vector lines, planes, angles, skew line distances, and linear systems.
 */

export const ANALYTIC_SUBTYPES = ["line-plane-intersection", "line-plane-angle", "skew-lines-distance", "plane-plane-intersection"];

export function isAnalyticSubtype(subtype) {
  return ANALYTIC_SUBTYPES.includes(subtype);
}

export function pointsMatch(a = [], b = [], tolerance = 0.001) {
  return Array.isArray(a)
    && Array.isArray(b)
    && a.length === 3
    && b.length === 3
    && a.every((val, idx) => Math.abs(Number(val) - Number(b[idx])) <= tolerance);
}

export function roundVector(vec = [], digits = 4) {
  const scale = 10 ** digits;
  return vec.map((val) => Math.round((Number(val) || 0) * scale) / scale);
}
