/**
 * challengePanel.js — UI renderer for gamification badges, streak counters, and challenge overlay.
 */

import { challengeManager } from "../core/challengeManager.js";

export function initChallengeUI() {
  const container = document.createElement("div");
  container.id = "gamification-banner";
  container.className = "gamification-banner hidden";
  container.innerHTML = `
    <div class="game-stat"><span class="game-icon">🔥</span> Streak: <strong id="game-streak-val">0</strong></div>
    <div class="game-stat"><span class="game-icon">⭐</span> Score: <strong id="game-score-val">0</strong></div>
    <div class="game-badges" id="game-badge-container"></div>
  `;

  document.body.appendChild(container);

  challengeManager.subscribe(({ score, streak, badges }) => {
    const streakEl = document.getElementById("game-streak-val");
    const scoreEl = document.getElementById("game-score-val");
    const badgeContainer = document.getElementById("game-badge-container");

    if (streakEl) streakEl.innerText = streak;
    if (scoreEl) scoreEl.innerText = score;

    if (badgeContainer) {
      const badgeIcons = {
        first_step: "🌱",
        streak_3: "🔥",
        "3d_explorer": "📐",
        score_500: "⭐",
      };
      badgeContainer.innerHTML = badges
        .map((b) => `<span class="badge-tag" title="${b}">${badgeIcons[b] || "🏆"}</span>`)
        .join("");
    }
  });

  // Attach toggle to challenge button in index.html
  const challengeBtn = document.getElementById("challengeModeBtn");
  if (challengeBtn) {
    challengeBtn.addEventListener("click", () => {
      container.classList.toggle("hidden");
      const isVisible = !container.classList.contains("hidden");
      challengeBtn.style.background = isVisible ? "rgba(2, 132, 199, 0.2)" : "";
    });
  }
}
