import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

export const parsedModelCache = new Map();

export async function parse3DModelFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  let loadedObject = null;

  if (extension === "gltf" || extension === "glb") {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(arrayBuffer, "", resolve, reject);
    });
    loadedObject = gltf.scene;
  } else if (extension === "obj") {
    const loader = new OBJLoader();
    const text = new TextDecoder().decode(arrayBuffer);
    loadedObject = loader.parse(text);
  } else if (extension === "stl") {
    const loader = new STLLoader();
    const geometry = loader.parse(arrayBuffer);
    const material = new THREE.MeshStandardMaterial({
      color: "#7cf7e4",
      roughness: 0.3,
      metalness: 0.2,
    });
    loadedObject = new THREE.Mesh(geometry, material);
  } else {
    throw new Error(`Unsupported 3D file format: .${extension}`);
  }

  return processParsedModel(loadedObject, file.name, extension);
}

function processParsedModel(object, fileName, format) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetScale = 2.0 / maxDim;
  object.scale.set(targetScale, targetScale, targetScale);

  const scaledBox = new THREE.Box3().setFromObject(object);
  const scaledSize = new THREE.Vector3();
  scaledBox.getSize(scaledSize);

  let vertexCount = 0;
  let faceCount = 0;
  let surfaceArea = 0;
  let meshVolume = 0;

  object.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const geo = child.geometry.isBufferGeometry ? child.geometry : new THREE.BufferGeometry().fromGeometry(child.geometry);
      const pos = geo.attributes.position;
      if (pos) {
        vertexCount += pos.count;
      }
      if (geo.index) {
        faceCount += geo.index.count / 3;
      } else if (pos) {
        faceCount += pos.count / 3;
      }

      if (pos) {
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        const p3 = new THREE.Vector3();
        const count = geo.index ? geo.index.count : pos.count;
        for (let i = 0; i < count; i += 3) {
          const idx1 = geo.index ? geo.index.getX(i) : i;
          const idx2 = geo.index ? geo.index.getX(i + 1) : i + 1;
          const idx3 = geo.index ? geo.index.getX(i + 2) : i + 2;
          p1.fromBufferAttribute(pos, idx1);
          p2.fromBufferAttribute(pos, idx2);
          p3.fromBufferAttribute(pos, idx3);

          const edge1 = p2.clone().sub(p1);
          const edge2 = p3.clone().sub(p1);
          surfaceArea += edge1.cross(edge2).length() * 0.5;

          meshVolume += p1.dot(p2.clone().cross(p3)) / 6.0;
        }
      }
    }
  });

  meshVolume = Math.abs(meshVolume);
  const bboxVolume = scaledSize.x * scaledSize.y * scaledSize.z;

  const modelId = `model_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  parsedModelCache.set(modelId, object);

  return {
    modelId,
    name: fileName,
    format,
    metrics: {
      dimensions: [
        Number(scaledSize.x.toFixed(3)),
        Number(scaledSize.y.toFixed(3)),
        Number(scaledSize.z.toFixed(3)),
      ],
      boundingVolume: Number(bboxVolume.toFixed(3)),
      estimatedMeshVolume: Number(meshVolume.toFixed(3)),
      surfaceArea: Number(surfaceArea.toFixed(3)),
      vertexCount,
      faceCount,
    },
  };
}

export async function import3DModelFileToScene(file, sceneRuntime) {
  const parsed = await parse3DModelFile(file);

  const spec = {
    id: parsed.modelId,
    label: file.name.replace(/\.[^/.]+$/, ""),
    shape: "custom_model",
    color: "#7cf7e4",
    position: [0, parsed.metrics.dimensions[1] / 2, 0],
    rotation: [0, 0, 0],
    params: {
      modelId: parsed.modelId,
      fileName: file.name,
      format: parsed.format,
      dimensions: parsed.metrics.dimensions,
    },
    metadata: {
      cadImport: true,
      metrics: parsed.metrics,
    },
  };

  if (sceneRuntime?.addObject) {
    sceneRuntime.addObject(spec);
  }
  return spec;
}

export function setupDragAndDropImporter(targetEl, appContext) {
  if (!targetEl) return;

  const dragClass = "drag-over-active";

  targetEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    targetEl.classList.add(dragClass);
  });

  targetEl.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    targetEl.classList.remove(dragClass);
  });

  targetEl.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    targetEl.classList.remove(dragClass);

    const files = Array.from(e.dataTransfer.files).filter((file) => {
      const ext = file.name.split(".").pop().toLowerCase();
      return ["gltf", "glb", "obj", "stl"].includes(ext);
    });

    for (const file of files) {
      try {
        await import3DModelFileToScene(file, appContext?.sceneRuntime);
      } catch (err) {
        console.error("Error importing dropped 3D model:", err);
        alert(`Failed to import ${file.name}: ${err.message}`);
      }
    }
  });
}
