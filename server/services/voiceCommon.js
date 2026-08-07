import { randomUUID } from "node:crypto";
import { evaluateBuild } from "./buildEvaluator.js";
import { buildTutorSystemPrompt, buildFallbackTutorReply } from "./tutorPrompt.js";

export const OUTPUT_SAMPLE_RATE = 24000;
export const INPUT_SAMPLE_RATE = 16000;
export const DEFAULT_VOICE_ID = "matthew";
export const VOICE_MAX_TOKENS = 5000;
const conversationSessions = new Map();

export function getVoiceConversationSession(conversationId = null) {
  const id = conversationId || randomUUID();
  if (!conversationSessions.has(id)) {
    conversationSessions.set(id, { id, history: [] });
  }
  return conversationSessions.get(id);
}

export function recentVoiceHistory(session) {
  return (session?.history || []).slice(-6);
}

export function normalizeVoiceHistoryForRealtime(history = []) {
  const normalized = recentVoiceHistory({ history })
    .map((entry) => ({
      role: String(entry?.role || "").trim().toLowerCase(),
      content: String(entry?.content || "").trim(),
    }))
    .filter((entry) => entry.content && (entry.role === "user" || entry.role === "assistant"));

  while (normalized.length && normalized[0].role !== "user") {
    normalized.shift();
  }

  return normalized;
}

export function decodeBase64Audio(audioBase64 = "") {
  return Buffer.from(String(audioBase64 || ""), "base64");
}

export function chunkBuffer(buffer, size = 16384) {
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += size) {
    chunks.push(buffer.subarray(offset, Math.min(offset + size, buffer.length)));
  }
  return chunks;
}

export function pcmToWavBuffer(pcmBuffer, sampleRate = OUTPUT_SAMPLE_RATE, channelCount = 1, bitsPerSample = 16) {
  const blockAlign = (channelCount * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channelCount, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export function buildNarrationPrompt() {
  return `You are Mindscape, narrating in the style of 3Blue1Brown.

Read the provided text aloud with these qualities:
- Warm, curious, and unhurried. Like thinking alongside a friend.
- Pause slightly before key insights to let them land.
- Read formulas naturally: "pi r squared" not "pi times r to the power of two."
- Keep a sense of wonder. Even simple ideas deserve a moment of appreciation.
- Do not add filler. Be concise but never rushed.`;
}

export function buildVoiceCoachPrompt(context = {}, session) {
  if (!context?.plan || !context?.sceneSnapshot) {
    return `You are Mindscape, a spoken spatial-maths tutor in the style of 3Blue1Brown.
- Speak warmly and curiously, like you're exploring an idea together.
- Answer the user's question directly and completely before adding guidance.
- Use as many short spoken sentences as needed to finish one coherent thought, usually 2-5.
- Ask a follow-up question only when it genuinely helps; do not force one every turn.
- If there is no visible scene context yet, speak naturally instead of pretending there is one.`;
  }

  const assessment = evaluateBuild(context.plan, context.sceneSnapshot, context.contextStepId || null);
  const basePrompt = buildTutorSystemPrompt({
    plan: context.plan,
    sceneSnapshot: context.sceneSnapshot,
    sceneContext: context.sceneContext || null,
    learningState: context.learningState || {},
    contextStepId: context.contextStepId || null,
    assessment,
  });
  const historyText = recentVoiceHistory(session)
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");

  return `${basePrompt}

Voice style (3Blue1Brown-inspired):
- You are speaking out loud. Be natural, warm, and conversational.
- Answer direct conceptual questions before coaching the next step.
- Guide with questions when helpful, not by default.
- Never dump a full solution unless the learner asks for it, but do not stop before the main answer is complete.
- If the learner asks for the answer directly, say: "Let's work through it. Look at the scene..."
- Use enough short spoken sentences to finish the idea cleanly, usually 2-4.
- Recent voice conversation:
${historyText || "No prior voice turns."}`;
}

export function buildVoiceFallback({ text, context, userMessage }) {
  if (context?.plan && context?.sceneSnapshot) {
    const assessment = evaluateBuild(context.plan, context.sceneSnapshot, context.contextStepId || null);
    return buildFallbackTutorReply({
      plan: context.plan,
      assessment,
      sceneContext: context.sceneContext || null,
      userMessage: userMessage || text || "Voice request",
      contextStepId: context.contextStepId || null,
    });
  }
  return String(text || "Mindscape voice is unavailable right now. Try a typed follow-up.");
}

export function buildConversationPreambleEvents({
  promptName: _promptName,
  systemPrompt: _systemPrompt,
  history = [],
  playbackMode: _playbackMode = "auto",
}) {
  const events = [];

  // 1. Session start event configuring the max tokens limit
  events.push({
    event: {
      sessionStart: {
        inferenceConfiguration: {
          maxTokens: 5000,
        },
      },
    },
  });

  // 2. Normalize and filter history events
  const normalized = [];
  let userSeen = false;
  for (const entry of history) {
    const role = String(entry?.role || "").trim().toLowerCase();
    const content = String(entry?.content || "").trim();
    if (!content) continue;
    if (role === "user") {
      userSeen = true;
    }
    if (userSeen && (role === "user" || role === "assistant")) {
      normalized.push({
        role: role.toUpperCase(),
        content,
      });
    }
  }

  normalized.forEach((entry, index) => {
    events.push({
      event: {
        contentStart: {
          role: entry.role,
          contentName: `history_${index}`,
        },
      },
    });
  });

  // 3. Prompt start event configuring the audio output mode
  events.push({
    event: {
      promptStart: {
        audioOutputConfiguration: {
          mediaType: "audio/lpcm",
        },
      },
    },
  });

  return events;
}



