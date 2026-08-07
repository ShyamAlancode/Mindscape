const PROFILE_KEY = "mindscape.learning-profile.v1";

function emptyProfile() {
  return { lessonsStarted: 0, lessonsCompleted: 0, topics: {}, recentLessons: [], updatedAt: null };
}

export function loadLearningProfile(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PROFILE_KEY) || "null");
    return parsed && typeof parsed === "object" ? { ...emptyProfile(), ...parsed, topics: parsed.topics || {}, recentLessons: parsed.recentLessons || [] } : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function recordLesson(profile, plan, outcome = "started") {
  const topic = plan?.lessonMetadata?.curriculum?.topic || "Interactive Problem Solving";
  const next = structuredClone(profile || emptyProfile());
  const current = next.topics[topic] || { started: 0, completed: 0 };
  if (outcome === "completed") {
    next.lessonsCompleted += 1;
    current.completed += 1;
  } else {
    next.lessonsStarted += 1;
    current.started += 1;
  }
  next.topics[topic] = current;
  next.recentLessons = [{ topic, outcome, at: Date.now(), question: plan?.problem?.question || "" }, ...next.recentLessons].slice(0, 8);
  next.updatedAt = Date.now();
  return next;
}

export function recordLearningSignal(profile, plan, signal = "interaction") {
  const topic = plan?.lessonMetadata?.curriculum?.topic || "Interactive Problem Solving";
  const next = structuredClone(profile || emptyProfile());
  const current = next.topics[topic] || { started: 0, completed: 0 };
  current.signals = { ...(current.signals || {}), [signal]: Number(current.signals?.[signal] || 0) + 1 };
  next.topics[topic] = current;
  next.updatedAt = Date.now();
  return next;
}

export function saveLearningProfile(profile, storage = globalThis.localStorage) {
  try { storage?.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* local storage is optional */ }
  return profile;
}

export function profileSummary(profile) {
  const completed = Number(profile?.lessonsCompleted || 0);
  const topicCount = Object.keys(profile?.topics || {}).length;
  return completed ? `${completed} lesson${completed === 1 ? "" : "s"} completed across ${topicCount} topic${topicCount === 1 ? "" : "s"}` : "Your learning journey starts with this lesson.";
}

export function recommendNextFocus(profile) {
  const topics = Object.entries(profile?.topics || {});
  if (!topics.length) return "Start with one visual lesson and Mindscape will suggest what to explore next.";
  const [topic, data] = topics.sort(([, a], [, b]) => {
    const aScore = Number(a.completed || 0) + Number(a.signals?.prediction_submitted || 0) * 0.5;
    const bScore = Number(b.completed || 0) + Number(b.signals?.prediction_submitted || 0) * 0.5;
    return aScore - bScore;
  })[0];
  return data.completed ? `Keep building ${topic} with a transfer problem.` : `Continue ${topic}: make a prediction, then test it in the scene.`;
}
