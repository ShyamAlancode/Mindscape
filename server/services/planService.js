import { heuristicPlan, heuristicSourceSummary } from "./plan/heuristics.js";
import { interpretQuestionSource } from "./plan/sourceInterpreter.js";
import { planFromNova } from "./plan/novaPlan.js";
import { mergeGeneratedPlan } from "./plan/mergePlan.js";
import { buildSourceEvidence } from "./plan/sourceEvidence.js";
import { buildDemoPreset } from "./plan/demoPreset.js";
import { getLastUsedTextModel, getLessonExemplarById, retrieveLessonExemplar } from "./plan/retrieval.js";
import { buildAnalyticPlan } from "./plan/analytic.js";
import { buildElectricFieldPlan } from "./plan/electricField.js";

export function buildAnalyticPlannerInput({ questionText = "", sourceSummary = {} }) {
  const rawQuestion = String(questionText || sourceSummary.rawQuestion || "").trim();
  const cleanedQuestion = String(sourceSummary.cleanedQuestion || "").trim();
  const givens = Array.isArray(sourceSummary.givens)
    ? sourceSummary.givens.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const relationships = Array.isArray(sourceSummary.relationships)
    ? sourceSummary.relationships.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const diagramSummary = String(sourceSummary.diagramSummary || "").trim();
  const analyticQuestion = rawQuestion || [
    cleanedQuestion,
    ...givens,
    diagramSummary,
    ...relationships,
  ].filter(Boolean).join(". ");

  if (!analyticQuestion) {
    return {
      questionText: "",
      sourceSummary,
    };
  }

  if (!rawQuestion) {
    return {
      questionText: analyticQuestion,
      sourceSummary,
    };
  }

  return {
    questionText: rawQuestion,
    sourceSummary: {
      ...sourceSummary,
      rawQuestion,
      cleanedQuestion: rawQuestion,
    },
  };
}

function buildAgentTrace({ sourceSummary, retrieval, usedNovaPlan, usedAnalyticPlan, usedElectricFieldPlan, llmError }) {
  // Build an honest, dynamic trace that reflects what actually ran
  const inputMode = sourceSummary?.inputMode || "text";
  const givensCount = Array.isArray(sourceSummary?.givens) ? sourceSummary.givens.length : 0;

  let plannerLabel, plannerStatus, plannerSummary;
  if (usedNovaPlan) {
    plannerLabel = "Gemini AI Planner";
    plannerStatus = "ai_generated";
    plannerSummary = retrieval?.matchedTitle
      ? `Gemini generated a custom lesson plan, informed by the '${retrieval.matchedTitle}' pattern (similarity: ${retrieval.score}).`
      : "Gemini AI generated a custom lesson plan tailored to this specific question.";
  } else if (usedElectricFieldPlan) {
    plannerLabel = "Physics Planner";
    plannerStatus = "deterministic";
    plannerSummary = llmError
      ? `AI planning failed (${llmError}). Used the deterministic physics planner as fallback.`
      : "Used the focused electromagnetism planner for charged objects, live field flow, and flux intuition.";
  } else if (usedAnalyticPlan) {
    plannerLabel = "Analytic Solver";
    plannerStatus = "deterministic";
    plannerSummary = llmError
      ? `AI planning failed (${llmError}). Used the deterministic analytic geometry solver as fallback.`
      : "Used the deterministic analytic geometry solver for reliable formulas and scene construction.";
  } else {
    plannerLabel = "Heuristic Planner";
    plannerStatus = "fallback";
    plannerSummary = llmError
      ? `AI planning unavailable (${llmError}). Using keyword-based heuristic lesson plan.`
      : "Used heuristic keyword-matching to build a baseline lesson plan.";
  }

  return [
    {
      id: "source-interpreter",
      label: "Source Interpreter",
      status: inputMode === "image" || inputMode === "multimodal" ? "multimodal" : "ready",
      summary: sourceSummary?.diagramSummary
        ? `Parsed worksheet image: ${sourceSummary.diagramSummary}`
        : `Extracted ${givensCount} given value${givensCount !== 1 ? "s" : ""} from question text.`,
    },
    {
      id: "lesson-planner",
      label: plannerLabel,
      status: plannerStatus,
      summary: plannerSummary,
    },
    {
      id: "build-evaluator",
      label: "Build Evaluator",
      status: "ready",
      summary: "Monitors placed scene objects and checks them against required lesson elements in real-time.",
    },
    {
      id: "tutor-coach",
      label: "Tutor Coach",
      status: "ready",
      summary: retrieval?.matchedTitle && retrieval.score >= 0.15
        ? `Primed with the '${retrieval.matchedTitle}' lesson pattern (match score: ${retrieval.score}).`
        : "Ready to coach the learner based on their live scene interactions and responses.",
    },
  ];
}

export async function generateScenePlan({ questionText = "", imageAsset = null, mode = "guided", sceneSnapshot = null }, emit = async () => {}) {
  let sourceWarning = null;
  let sourceSummary;
  const isOfflineDemo = mode === "demo";
  if (isOfflineDemo) {
    sourceSummary = heuristicSourceSummary({ questionText, imageAsset });
    sourceWarning = "Demo mode uses the local lesson planner; no API key is required.";
  } else {
    try {
      sourceSummary = await interpretQuestionSource({ questionText, imageAsset });
    } catch (err) {
      sourceWarning = `Source interpretation limited: ${err.message}`;
      sourceSummary = heuristicSourceSummary({ questionText, imageAsset });
    }
  }

  const workingQuestion = (sourceSummary.cleanedQuestion || questionText || "").trim();
  const retrieval = isOfflineDemo
    ? { exemplarId: "", matchedTitle: "", score: 0, why: "local demo lesson" }
    : await retrieveLessonExemplar({ questionText: workingQuestion, sourceSummary });
  const matchedExemplar = getLessonExemplarById(retrieval.exemplarId);

  await emit("multimodal_evidence", {
    input_modality: imageAsset
      ? (questionText ? "multimodal" : "image")
      : "text",
    extracted: {
      givens: sourceSummary.givens,
      labels: sourceSummary.labels,
      relationships: sourceSummary.relationships,
      diagram_summary: sourceSummary.diagramSummary,
    },
    retrieval: {
      matched_exemplar: retrieval.exemplarId,
      matched_title: retrieval.matchedTitle,
      similarity_score: retrieval.score,
      why: retrieval.why,
    },
    nova_model_used: getLastUsedTextModel(),
    input_had_image: imageAsset != null,
    systemWarning: sourceWarning,
  });
  // ─── LLM-FIRST planning: always attempt Gemini AI first ───────────────────
  // Heuristics and analytic planners are FALLBACKS ONLY — used only when AI fails.
  let usedNovaPlan = false;
  let usedElectricFieldPlan = false;
  let usedAnalyticPlan = false;
  let llmError = null;
  let mergedPlan = null;

  if (!isOfflineDemo) {
    try {
      const effectiveExemplar = retrieval.score >= 0.10 ? matchedExemplar : null;
      const novaPlan = await planFromNova({
        questionText: workingQuestion,
        mode,
        sceneSnapshot,
        sourceSummary,
        exemplar: effectiveExemplar,
      });
      usedNovaPlan = true;
      // Blend the LLM plan with the heuristic baseline for robustness
      const baselinePlan = heuristicPlan(workingQuestion, mode, sourceSummary);
      mergedPlan = mergeGeneratedPlan({
        baselinePlan,
        novaPlan,
        workingQuestion,
        mode,
      });
    } catch (error) {
      llmError = error?.message ? error.message.slice(0, 120) : String(error);
      console.warn("[Planner] LLM planning failed, using deterministic fallback:", llmError);
    }
  }

  // Fallback chain: electric-field → analytic → heuristic (only if LLM failed or demo mode)
  if (!mergedPlan) {
    const analyticInput = buildAnalyticPlannerInput({ questionText, sourceSummary });
    const electricFieldPlan = buildElectricFieldPlan(workingQuestion, sourceSummary);
    const analyticPlan = buildAnalyticPlan(analyticInput.questionText, analyticInput.sourceSummary);
    usedElectricFieldPlan = Boolean(electricFieldPlan);
    usedAnalyticPlan = Boolean(analyticPlan) && !usedElectricFieldPlan;
    mergedPlan = electricFieldPlan || analyticPlan || heuristicPlan(workingQuestion, mode, sourceSummary);
  }

  const effectiveSourceSummary = mergedPlan.sourceSummary || sourceSummary;
  const sourceEvidence = buildSourceEvidence(effectiveSourceSummary);
  const demoPreset = buildDemoPreset({
    plan: mergedPlan,
    sourceSummary: effectiveSourceSummary,
    exemplar: matchedExemplar,
  });
  const agentTrace = buildAgentTrace({
    sourceSummary: effectiveSourceSummary,
    retrieval,
    usedNovaPlan,
    usedAnalyticPlan,
    usedElectricFieldPlan,
    llmError,
  });

  const scenePlan = {
    ...mergedPlan,
    sourceEvidence,
    agentTrace,
    demoPreset,
  };

  const result = {
    scenePlan,
    sourceEvidence,
    agentTrace,
    demoPreset,
    retrieval,
  };
  await emit("plan", result);
  return result;
}
