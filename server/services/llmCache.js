/**
 * llmCache.js — In-memory LRU Cache for normalized math question responses.
 * Prevents redundant LLM calls and cuts API costs dramatically for viral/repeated questions.
 */

class LLMCache {
  constructor(maxSize = 500, ttlMs = 24 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  normalizeKey(questionText = "") {
    return String(questionText || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9\s=+\-*/^(),.]/g, "");
  }

  get(questionText) {
    const key = this.normalizeKey(questionText);
    if (!key) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(questionText, value) {
    const key = this.normalizeKey(questionText);
    if (!key || !value) return;

    if (this.cache.size >= this.maxSize) {
      // LRU eviction: delete oldest key
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const llmCache = new LLMCache();
