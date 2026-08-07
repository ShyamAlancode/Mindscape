/**
 * planFetcher.js — Fetches 3D scene plans from the /api/plan endpoint via SSE streams.
 */

export async function fetchScenePlan({ questionText, imageAsset, sceneSnapshot, mode = "guided" }, onEvent = () => {}) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionText,
      imageAsset,
      sceneSnapshot,
      mode,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Plan request failed (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPlan = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const block of lines) {
      const eventMatch = block.match(/^event:\s*(.+)$/m);
      const dataMatch = block.match(/^data:\s*(.+)$/m);

      if (dataMatch) {
        const eventName = eventMatch ? eventMatch[1].trim() : "message";
        try {
          const payload = JSON.parse(dataMatch[1].trim());
          onEvent(eventName, payload);
          if (eventName === "plan") {
            finalPlan = payload;
          }
        } catch (err) {
          console.warn("[PlanFetcher] SSE parse error:", err.message);
        }
      }
    }
  }

  return finalPlan;
}
