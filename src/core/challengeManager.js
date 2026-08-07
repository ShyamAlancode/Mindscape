/**
 * challengeManager.js — Core logic for gamified math challenges, streaks, scores, and badges.
 */

export class ChallengeManager {
  constructor() {
    this.score = 0;
    this.streak = 0;
    this.solvedCount = 0;
    this.badges = new Set();
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem("mindscape_gamification_profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.score = parsed.score || 0;
        this.streak = parsed.streak || 0;
        this.solvedCount = parsed.solvedCount || 0;
        this.badges = new Set(parsed.badges || []);
      }
    } catch (err) {
      console.warn("[ChallengeManager] LocalStorage load warning:", err.message);
    }
  }

  save() {
    try {
      const payload = {
        score: this.score,
        streak: this.streak,
        solvedCount: this.solvedCount,
        badges: Array.from(this.badges),
      };
      localStorage.setItem("mindscape_gamification_profile", JSON.stringify(payload));
    } catch (err) {
      console.warn("[ChallengeManager] LocalStorage save warning:", err.message);
    }
    this.notify();
  }

  onCorrectAnswer(difficulty = "medium") {
    const points = difficulty === "hard" ? 150 : difficulty === "easy" ? 50 : 100;
    this.streak += 1;
    const multiplier = Math.min(3, 1 + Math.floor(this.streak / 3) * 0.5);
    const addedPoints = Math.round(points * multiplier);
    this.score += addedPoints;
    this.solvedCount += 1;

    // Evaluate Badge Unlocks
    const unlockedNow = [];
    if (this.solvedCount >= 1 && !this.badges.has("first_step")) {
      this.badges.add("first_step");
      unlockedNow.push({ id: "first_step", title: "🌱 First Step", desc: "Solved your first 3D lesson!" });
    }
    if (this.streak >= 3 && !this.badges.has("streak_3")) {
      this.badges.add("streak_3");
      unlockedNow.push({ id: "streak_3", title: "🔥 On Fire", desc: "Achieved a 3-lesson streak!" });
    }
    if (this.solvedCount >= 5 && !this.badges.has("3d_explorer")) {
      this.badges.add("3d_explorer");
      unlockedNow.push({ id: "3d_explorer", title: "📐 3D Explorer", desc: "Completed 5 spatial geometry challenges!" });
    }
    if (this.score >= 500 && !this.badges.has("score_500")) {
      this.badges.add("score_500");
      unlockedNow.push({ id: "score_500", title: "⭐ Math Master", desc: "Earned 500+ challenge points!" });
    }

    this.save();
    return { addedPoints, multiplier, newStreak: this.streak, unlockedNow };
  }

  onIncorrectAnswer() {
    this.streak = 0;
    this.save();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  getState() {
    return {
      score: this.score,
      streak: this.streak,
      solvedCount: this.solvedCount,
      badges: Array.from(this.badges),
    };
  }
}

export const challengeManager = new ChallengeManager();
