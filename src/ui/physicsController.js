export function initPhysicsController(appContext) {
  const stageWrap = document.querySelector(".stage-wrap");
  if (!stageWrap) return;

  const physicsToolbar = document.createElement("div");
  physicsToolbar.className = "physics-sim-toolbar";
  physicsToolbar.innerHTML = `
    <div class="physics-tool-group">
      <button id="simPlayPauseBtn" class="sim-btn" data-tooltip="Play / Pause Physics Motion">
        <span class="sim-icon">▶</span>
        <span class="sim-label">Play Sim</span>
      </button>
      <button id="spawnPosChargeBtn" class="sim-btn is-pos-charge" data-tooltip="Add +1q Positive Charge">
        <span class="sim-icon">+q</span>
      </button>
      <button id="spawnNegChargeBtn" class="sim-btn is-neg-charge" data-tooltip="Add -1q Negative Charge">
        <span class="sim-icon">-q</span>
      </button>
      <button id="importCadBtn" class="sim-btn is-cad" data-tooltip="Import 3D CAD (.gltf/.obj/.stl)">
        <span class="sim-icon">📦 CAD</span>
      </button>
      <input id="cadFileInput" type="file" accept=".gltf,.glb,.obj,.stl" hidden />
    </div>
  `;
  stageWrap.appendChild(physicsToolbar);

  const playPauseBtn = document.getElementById("simPlayPauseBtn");
  const spawnPosBtn = document.getElementById("spawnPosChargeBtn");
  const spawnNegBtn = document.getElementById("spawnNegChargeBtn");
  const importCadBtn = document.getElementById("importCadBtn");
  const cadFileInput = document.getElementById("cadFileInput");

  let isPlaying = false;

  playPauseBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playPauseBtn.classList.toggle("is-playing", isPlaying);
    const label = playPauseBtn.querySelector(".sim-label");
    const icon = playPauseBtn.querySelector(".sim-icon");
    if (label && icon) {
      label.textContent = isPlaying ? "Pause Sim" : "Play Sim";
      icon.textContent = isPlaying ? "⏸" : "▶";
    }

    if (appContext?.world?.electricFieldManager) {
      appContext.world.electricFieldManager.setSimulationPlay(isPlaying);
    }
  });

  spawnPosBtn.addEventListener("click", () => {
    const randomOffset = (Math.random() - 0.5) * 2;
    appContext?.sceneRuntime?.addObject?.({
      shape: "sphere",
      label: "+1q Positive Charge",
      color: "#ff4d4d",
      position: [randomOffset - 1, 1, randomOffset],
      params: { radius: 0.35 },
      metadata: {
        physics: { charge: 1, strength: 1 },
      },
    });
  });

  spawnNegBtn.addEventListener("click", () => {
    const randomOffset = (Math.random() - 0.5) * 2;
    appContext?.sceneRuntime?.addObject?.({
      shape: "sphere",
      label: "-1q Negative Charge",
      color: "#48c9ff",
      position: [randomOffset + 1, 1, randomOffset],
      params: { radius: 0.35 },
      metadata: {
        physics: { charge: -1, strength: 1 },
      },
    });
  });

  importCadBtn.addEventListener("click", () => {
    cadFileInput.click();
  });

  cadFileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const { import3DModelFileToScene } = await import("../scene/modelImporter.js");
    for (const file of files) {
      try {
        await import3DModelFileToScene(file, appContext?.sceneRuntime);
      } catch (err) {
        alert(`Failed to import CAD file: ${err.message}`);
      }
    }
    cadFileInput.value = "";
  });
}
