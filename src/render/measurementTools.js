/**
 * measurementTools.js — Interactive 3D Ruler & Protractor Tools for Three.js Viewport.
 * Allows users to pick vertices/points on 3D meshes to calculate real-time spatial distances and angles.
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export class MeasurementToolManager {
  constructor(world) {
    this.world = world; // { scene, camera, renderer, domElement }
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.mode = "off"; // "ruler" | "protractor" | "off"
    this.selectedPoints = [];
    this.measurementGroup = new THREE.Group();
    this.measurementGroup.name = "measurement-tools-group";

    if (this.world?.scene) {
      this.world.scene.add(this.measurementGroup);
    }

    this.onPointerDownBound = this.onPointerDown.bind(this);
  }

  setMode(mode) {
    this.clearSelection();
    this.mode = mode;

    const domElement = this.world?.domElement || this.world?.renderer?.domElement;
    if (!domElement) return;

    domElement.removeEventListener("pointerdown", this.onPointerDownBound);
    if (this.mode === "ruler" || this.mode === "protractor") {
      domElement.addEventListener("pointerdown", this.onPointerDownBound);
      domElement.style.cursor = "crosshair";
    } else {
      domElement.style.cursor = "default";
    }
  }

  clearSelection() {
    this.selectedPoints = [];
  }

  clearAllMeasurements() {
    this.clearSelection();
    while (this.measurementGroup.children.length > 0) {
      const child = this.measurementGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.measurementGroup.remove(child);
    }
    // Remove DOM overlays for measurements
    document.querySelectorAll(".3d-measurement-label").forEach((el) => el.remove());
  }

  onPointerDown(event) {
    if (this.mode === "off") return;

    const domElement = this.world?.domElement || this.world?.renderer?.domElement;
    if (!domElement) return;

    const rect = domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.world.camera);
    const intersects = this.raycaster.intersectObjects(this.world.scene.children, true);

    // Filter out measurement group objects and background plane
    const validIntersects = intersects.filter((hit) => {
      let curr = hit.object;
      while (curr) {
        if (curr === this.measurementGroup || curr.name === "ground-grid" || curr.type === "GridHelper") {
          return false;
        }
        curr = curr.parent;
      }
      return true;
    });

    if (validIntersects.length > 0) {
      const hitPoint = validIntersects[0].point.clone();
      this.addPoint(hitPoint);
    }
  }

  addPoint(point) {
    this.selectedPoints.push(point);
    this.drawPointMarker(point);

    if (this.mode === "ruler" && this.selectedPoints.length === 2) {
      this.createRulerMeasurement(this.selectedPoints[0], this.selectedPoints[1]);
      this.clearSelection();
    } else if (this.mode === "protractor" && this.selectedPoints.length === 3) {
      this.createProtractorMeasurement(this.selectedPoints[0], this.selectedPoints[1], this.selectedPoints[2]);
      this.clearSelection();
    }
  }

  drawPointMarker(point) {
    const geo = new THREE.SphereGeometry(0.08, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, depthTest: false });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(point);
    sphere.renderOrder = 999;
    this.measurementGroup.add(sphere);
  }

  createRulerMeasurement(p1, p2) {
    const distance = p1.distanceTo(p2);

    // Draw line
    const points = [p1, p2];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3, depthTest: false });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 998;
    this.measurementGroup.add(line);

    // Midpoint for label
    const midPoint = p1.clone().add(p2).multiplyScalar(0.5);
    this.createDomLabel(midPoint, `${distance.toFixed(2)} units`, "ruler");
  }

  createProtractorMeasurement(p1, vertexPoint, p2) {
    const v1 = p1.clone().sub(vertexPoint).normalize();
    const v2 = p2.clone().sub(vertexPoint).normalize();
    const dot = Math.max(-1, Math.min(1, v1.dot(v2)));
    const angleRad = Math.acos(dot);
    const angleDeg = (angleRad * (180 / Math.PI)).toFixed(1);

    // Draw two ray lines
    const lineGeo1 = new THREE.BufferGeometry().setFromPoints([vertexPoint, p1]);
    const lineGeo2 = new THREE.BufferGeometry().setFromPoints([vertexPoint, p2]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff4500, linewidth: 3, depthTest: false });

    const l1 = new THREE.Line(lineGeo1, lineMat);
    const l2 = new THREE.Line(lineGeo2, lineMat);
    l1.renderOrder = 998;
    l2.renderOrder = 998;

    this.measurementGroup.add(l1);
    this.measurementGroup.add(l2);

    this.createDomLabel(vertexPoint, `Angle: ${angleDeg}°`, "protractor");
  }

  createDomLabel(position3D, text, type) {
    const label = document.createElement("div");
    label.className = `3d-measurement-label measurement-${type}`;
    label.style.position = "absolute";
    label.style.padding = "4px 8px";
    label.style.background = type === "ruler" ? "rgba(0, 255, 255, 0.85)" : "rgba(255, 69, 0, 0.85)";
    label.style.color = "#000";
    label.style.fontWeight = "bold";
    label.style.fontSize = "12px";
    label.style.borderRadius = "4px";
    label.style.pointerEvents = "none";
    label.style.transform = "translate(-50%, -100%)";
    label.style.zIndex = "1000";
    label.innerText = text;

    document.body.appendChild(label);

    // Store position and label binding
    label._pos3D = position3D;
    this.updateDomLabelPosition(label);
  }

  updateDomLabelPosition(label) {
    if (!this.world?.camera || !label._pos3D) return;

    const vec = label._pos3D.clone();
    vec.project(this.world.camera);

    const domElement = this.world?.domElement || this.world?.renderer?.domElement;
    if (!domElement) return;

    const rect = domElement.getBoundingClientRect();
    const x = (vec.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-(vec.y * 0.5) + 0.5) * rect.height + rect.top;

    if (vec.z > 1) {
      label.style.display = "none";
    } else {
      label.style.display = "block";
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    }
  }

  update() {
    // Update all DOM label positions on camera movement
    document.querySelectorAll(".3d-measurement-label").forEach((label) => {
      this.updateDomLabelPosition(label);
    });
  }
}
