import {
  converseGemini,
  converseGeminiStream,
  embedGemini,
  visionGemini,
} from "../middleware/gemini.js";
import {
  converseGroq,
  converseGroqStream,
  transcribeGroq,
  visionGroq,
} from "../middleware/groq.js";
import { getModelCandidateOrder, rememberWorkingModel } from "./modelRouter.js";
import { PLACEHOLDER_SCENE_SPEC } from "./plan/shared.js";

const DEFAULT_MODEL_TIMEOUT_MS = 18000;

export function modelTimeoutMs(options = {}) {
  const configured = Number(options.timeoutMs ?? process.env.MODEL_TIMEOUT_MS ?? DEFAULT_MODEL_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.max(1, Math.min(configured, 120000)) : DEFAULT_MODEL_TIMEOUT_MS;
}

export async function withModelTimeout(task, timeoutMs, label = "Model") {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeModelIds(kind, modelIds = null) {
  const ids = Array.isArray(modelIds) ? modelIds : getModelCandidateOrder(kind);
  return [...new Set(
    ids
      .map((modelId) => String(modelId || "").trim())
      .filter(Boolean)
  )];
}

function buildAggregateModelError(kind, attempts = []) {
  const detail = attempts
    .map(({ modelId, error }) => `${modelId}: ${error?.message || error}`)
    .join(" | ");
  return new Error(detail
    ? `All ${kind} model candidates failed. ${detail}`
    : `All ${kind} model candidates failed.`);
}

/**
 * Core invoker that tries model candidates in order.
 */
export async function runWithModelFailover(kind, run, options = {}) {
  const modelIds = normalizeModelIds(kind, options.modelIds);
  if (!modelIds.length) {
    if (kind === "vision") return PLACEHOLDER_SCENE_SPEC;
    throw new Error(`No ${kind} model candidates are configured.`);
  }

  const attempts = [];
  const timeoutMs = modelTimeoutMs(options);
  for (const modelId of modelIds) {
    try {
      const result = await withModelTimeout(() => run(modelId), timeoutMs, `Model ${modelId}`);
      rememberWorkingModel(kind, modelId);
      return result;
    } catch (error) {
      const errorMsg = error?.message || String(error);
      const isRetryable = errorMsg.includes("Connection error") || errorMsg.includes("ECONNRESET") || errorMsg.includes("ETIMEDOUT");
      
      if (isRetryable) {
        console.warn(`[Failover] Model ${modelId} failed with transient error. Retrying...`);
        try {
          const retryResult = await withModelTimeout(() => run(modelId), timeoutMs, `Model ${modelId}`);
          rememberWorkingModel(kind, modelId);
          return retryResult;
        } catch (retryError) {
          console.warn(`[Failover] Model ${modelId} retry failed:`, retryError.message);
        }
      }
      
      console.warn(`[Failover] Model ${modelId} failed for ${kind}:`, errorMsg.slice(0, 200));
      attempts.push({ modelId, error });
    }
  }

  // Final emergency fallbacks
  if (kind === "vision") {
    console.error("Critical vision failure, returning placeholder.");
    return PLACEHOLDER_SCENE_SPEC;
  }

  throw buildAggregateModelError(kind, attempts);
}

/**
 * Higher-level wrapper for Chat/Reasoning (Handles both Groq and Gemini).
 */
export async function converseWithModelFailover(kind, systemPrompt, messages, options = {}) {
  return runWithModelFailover(kind, (modelId) => {
    if (modelId.startsWith("gemini")) {
      return converseGemini(modelId, systemPrompt, messages, options);
    }
    return converseGroq(modelId, systemPrompt, messages, options);
  });
}

/**
 * Streaming Chat/Reasoning.
 */
export async function* converseStreamWithModelFailover(kind, systemPrompt, messages, options = {}, overrides = {}) {
  const mergedOptions = { ...options, ...overrides };
  const modelIds = normalizeModelIds(kind, mergedOptions.modelIds);
  if (!modelIds.length) {
    throw new Error(`No ${kind} model candidates are configured.`);
  }

  const attempts = [];
  for (const modelId of modelIds) {
    let yieldedChunk = false;
    try {
      let stream;
      if (mergedOptions.converseNovaStream) {
        stream = mergedOptions.converseNovaStream(modelId, systemPrompt, messages, mergedOptions);
      } else if (modelId.startsWith("gemini")) {
        stream = converseGeminiStream(modelId, systemPrompt, messages, mergedOptions);
      } else if (modelId.includes("nova") || modelId.includes("amazon")) {
        const { converseNovaStream } = await import("../middleware/bedrock.js");
        stream = converseNovaStream(modelId, systemPrompt, messages, mergedOptions);
      } else {
        stream = converseGroqStream(modelId, systemPrompt, messages, mergedOptions);
      }

      for await (const chunk of stream) {
        yieldedChunk = true;
        yield chunk;
      }
      rememberWorkingModel(kind, modelId);
      return;
    } catch (error) {
      attempts.push({ modelId, error });
      if (yieldedChunk) throw error;
    }
  }

  throw buildAggregateModelError(kind, attempts);
}

/**
 * Embedding-specific wrapper.
 */
export async function invokeEmbeddingWithModelFailover(kind, text, options = {}) {
  return runWithModelFailover(kind, (_modelId) => embedGemini(text, options));
}

/**
 * Vision-specific wrapper.
 */
export async function invokeVisionWithModelFailover(kind, prompt, imageAsset, options = {}) {
  return runWithModelFailover(kind, (modelId) => {
    if (modelId.startsWith("gemini")) {
      return visionGemini(modelId, prompt, imageAsset, options);
    }
    return visionGroq(modelId, prompt, imageAsset, options);
  });
}

/**
 * Transcription-specific wrapper.
 */
export async function invokeTranscriptionWithModelFailover(kind, audioSource, options = {}) {
  return runWithModelFailover(kind, (_modelId) => transcribeGroq(audioSource, options));
}
