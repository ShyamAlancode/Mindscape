import { randomUUID } from "node:crypto";
import { getModelCandidateOrder, rememberWorkingModel } from "./modelRouter.js";
import { buildVoiceFallback, getVoiceConversationSession } from "./voiceCommon.js";

function createAsyncQueue() {
  const values = [];
  const waiters = [];
  let closed = false;
  return {
    push(value) {
      if (closed) return false;
      const waiter = waiters.shift();
      if (waiter) waiter(value); else values.push(value);
      return true;
    },
    nextValue() {
      if (values.length) return Promise.resolve(values.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
    close() {
      closed = true;
      while (waiters.length) waiters.shift()(null);
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        const value = await this.nextValue();
        if (value == null) return;
        yield value;
      }
    },
  };
}

function safeContent(value = "") {
  return String(value || "").trim();
}

function hasAwsCredentials() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export function createVoiceSessionManager({
  hasAwsCredentials: canUseNativeVoice = hasAwsCredentials,
  getModelCandidateOrder: modelCandidates = getModelCandidateOrder,
  rememberWorkingModel: rememberModel = rememberWorkingModel,
  startBidirectionalStream = null,
  generateRecoveredVoiceReply: recoverReply = null,
} = {}) {
  const sessions = new Map();

  function ensureSession(sessionId = null) {
    const conversation = getVoiceConversationSession(sessionId);
    if (!sessions.has(conversation.id)) {
      sessions.set(conversation.id, { id: conversation.id, conversation, state: "idle", subscribers: new Set(), currentTurn: null });
    }
    return sessions.get(conversation.id);
  }

  function publish(session, payload) {
    const event = { sessionId: session.id, ...payload };
    session.subscribers.forEach((subscriber) => subscriber.push(event));
  }

  function setState(session, state) {
    if (session.state === state) return;
    session.state = state;
    publish(session, { type: "state", state });
  }

  function finalizeTurn(session, turn, result = {}) {
    if (turn.closed || session.currentTurn?.id !== turn.id) return;
    turn.closed = true;
    const inputTranscript = safeContent(result.inputTranscript ?? turn.inputTranscript ?? turn.userText);
    const assistantText = safeContent(result.assistantText ?? turn.fallbackText);
    if (inputTranscript) {
      session.conversation.history.push({ role: "user", content: inputTranscript });
      session.conversation.history.push({ role: "assistant", content: assistantText });
    }
    session.currentTurn = null;
    publish(session, {
      type: "done", conversationId: session.id, inputTranscript, assistantText,
      source: result.source || "nova-sonic", fallbackUsed: Boolean(result.fallbackUsed),
      actions: result.actions || [], sceneCommand: result.sceneCommand || null,
      focusTargets: result.focusTargets || [], assessment: result.assessment || null,
    });
    setState(session, "idle");
  }

  async function recoverMetadata(turn, assistantText, inputTranscript) {
    try {
      const generateReply = recoverReply || (await import("./voiceReplyFallback.js")).generateRecoveredVoiceReply;
      return await generateReply({
        inputTranscript, assistantTextOverride: assistantText, mode: turn.mode,
        context: turn.context, session: turn.session, voiceId: turn.voiceId, suppressAudio: true,
      }) || {};
    } catch (error) {
      console.warn("Voice metadata recovery failed:", error?.message || error);
      return {};
    }
  }

  async function consumeNativeStream(session, turn, output) {
    const contentRoles = new Map();
    let transcript = turn.userText;
    let assistantText = "";
    try {
      for await (const packet of output) {
        if (turn.interrupted) return;
        const event = packet?.event || {};
        if (event.contentStart) {
          contentRoles.set(event.contentStart.contentId, event.contentStart.role);
        }
        if (event.textOutput) {
          const content = safeContent(event.textOutput.content);
          const role = contentRoles.get(event.textOutput.contentId);
          if (role === "USER") {
            transcript += content;
            publish(session, { type: "input_transcript", content: safeContent(transcript), delta: content });
          } else if (role === "ASSISTANT") {
            assistantText += content;
            publish(session, { type: "assistant_text", content: assistantText, delta: content, generationStage: "PARTIAL" });
          }
        }
        if (event.audioOutput && contentRoles.get(event.audioOutput.contentId) === "ASSISTANT") {
          publish(session, { type: "assistant_audio", content: event.audioOutput.content, sampleRateHertz: event.audioOutput.sampleRateHertz || 24000 });
        }
      }
      if (turn.interrupted) return;
      const inputTranscript = safeContent(transcript);
      if (!inputTranscript) {
        finalizeTurn(session, turn, { assistantText: "I didn't catch anything. Try again.", fallbackUsed: true, source: "caption-only" });
        return;
      }
      const metadata = await recoverMetadata(turn, assistantText, inputTranscript);
      const finalText = safeContent(assistantText || metadata.assistantText || turn.fallbackText);
      publish(session, { type: "input_transcript", content: inputTranscript, delta: inputTranscript });
      publish(session, { type: "assistant_text", content: finalText, delta: "", generationStage: "FINAL" });
      finalizeTurn(session, turn, { ...metadata, assistantText: finalText, inputTranscript, source: "nova-sonic", fallbackUsed: false });
    } catch {
      if (!turn.interrupted) {
        finalizeTurn(session, turn, { assistantText: turn.fallbackText, inputTranscript: transcript, source: "caption-only", fallbackUsed: true });
      }
    }
  }

  function subscribe(sessionId) {
    const session = ensureSession(sessionId);
    const queue = createAsyncQueue();
    session.subscribers.add(queue);
    queue.push({ sessionId: session.id, type: "state", state: session.state });
    return { next: () => queue.nextValue(), close: () => { session.subscribers.delete(queue); queue.close(); } };
  }

  async function startTurn({ sessionId, playbackMode = "auto", voiceId = null, mode = "coach", context = null, text = "" }) {
    const session = ensureSession(sessionId);
    if (session.currentTurn && !session.currentTurn.closed) return { sessionId: session.id, alreadyActive: true };
    const turn = {
      id: randomUUID(), playbackMode, voiceId, mode, context, userText: safeContent(text), inputTranscript: "",
      fallbackText: buildVoiceFallback({ text, context, userMessage: text }), hasAudio: false, closed: false, interrupted: false, session: session.conversation, inputQueue: createAsyncQueue(),
    };
    session.currentTurn = turn;
    if (!canUseNativeVoice()) {
      finalizeTurn(session, turn, { assistantText: "Voice mode is unavailable. Type your question and I'll help from there.", fallbackUsed: true, source: "caption-only" });
      return { sessionId: session.id, turnId: turn.id, fallbackUsed: true };
    }
    let stream = null;
    let modelId = null;
    const openBidirectionalStream = startBidirectionalStream || (await import("../middleware/bedrock.js")).startBidirectionalStream;
    for (const candidate of modelCandidates("voice")) {
      try {
        stream = await openBidirectionalStream(candidate, turn.inputQueue);
        modelId = candidate;
        rememberModel("voice", candidate);
        break;
      } catch (error) {
        console.warn("Native voice candidate failed:", error?.message || error);
      }
    }
    if (!stream) {
      finalizeTurn(session, turn, { assistantText: "Voice mode is unavailable. Type your question and I'll help from there.", fallbackUsed: true, source: "caption-only" });
      return { sessionId: session.id, turnId: turn.id, fallbackUsed: true };
    }
    setState(session, turn.userText ? "processing" : "listening");
    if (turn.userText) {
      turn.inputQueue.push({ event: { textInput: { content: turn.userText } } });
      turn.inputQueue.push({ event: { sessionEnd: {} } });
      turn.inputQueue.close();
    }
    void consumeNativeStream(session, turn, stream);
    return { sessionId: session.id, turnId: turn.id, modelId, fallbackUsed: false };
  }

  async function appendAudio({ sessionId, audioBase64 }) {
    const turn = ensureSession(sessionId).currentTurn;
    if (!turn || turn.closed) return { accepted: false };
    turn.hasAudio = true;
    turn.inputQueue.push({ event: { audioInput: { content: audioBase64 } } });
    return { accepted: true };
  }

  async function stopTurn(sessionId) {
    const session = ensureSession(sessionId);
    const turn = session.currentTurn;
    if (!turn || turn.closed) return { stopped: false };
    if (!turn.userText && !turn.hasAudio) {
      turn.inputQueue.close();
      finalizeTurn(session, turn, { assistantText: "I didn't catch anything. Try again.", fallbackUsed: true, source: "caption-only" });
      return { stopped: true, emptyInput: true };
    }
    turn.inputQueue.push({ event: { sessionEnd: {} } });
    turn.inputQueue.close();
    return { stopped: true, emptyInput: false };
  }

  async function interruptTurn(sessionId) {
    const session = ensureSession(sessionId);
    const turn = session.currentTurn;
    if (turn) { turn.interrupted = true; turn.closed = true; turn.inputQueue.close(); }
    session.currentTurn = null;
    setState(session, "idle");
    publish(session, { type: "interrupted" });
    return { interrupted: true };
  }

  return {
    createSession: () => { const session = ensureSession(); return { sessionId: session.id, state: session.state }; },
    subscribe, startTurn, appendAudio, stopTurn, interruptTurn,
  };
}

export const voiceSessionManager = createVoiceSessionManager();
