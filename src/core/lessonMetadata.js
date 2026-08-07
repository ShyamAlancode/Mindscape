const CURRICULUM_RULES = [
  { pattern: /surface area|volume|cuboid|cube|cylinder|cone|prism|net\b/i, gradeBand: "Class 6-8", strand: "Geometry", topic: "Mensuration" },
  { pattern: /line.*plane|vector|cross product|dot product|skew lines|coordinate/i, gradeBand: "Class 11-12", strand: "Mathematics", topic: "3D Geometry & Vectors" },
  { pattern: /electric field|charge|flux|dipole/i, gradeBand: "Class 11-12", strand: "Physics", topic: "Electrostatics" },
  { pattern: /derivative|integral|limit|tangent/i, gradeBand: "Class 11-12", strand: "Mathematics", topic: "Calculus" },
  { pattern: /matrix|eigen|gradient|differential equation/i, gradeBand: "Undergraduate", strand: "Mathematics", topic: "Advanced Visual Mathematics" },
];

export function inferLessonMetadata({ question = "", questionType = "", analyticContext = null } = {}) {
  const text = `${question} ${questionType} ${analyticContext?.subtype || ""}`;
  const match = CURRICULUM_RULES.find((rule) => rule.pattern.test(text));
  const verifiedLocal = Boolean(analyticContext) || ["volume", "surface_area"].includes(questionType);

  return {
    curriculum: match
      ? { board: "CBSE-aligned", gradeBand: match.gradeBand, strand: match.strand, topic: match.topic }
      : { board: "General", gradeBand: "Class 6-10", strand: "Spatial Reasoning", topic: "Interactive Problem Solving" },
    verification: {
      status: verifiedLocal ? "verified_local" : "model_assisted",
      label: verifiedLocal ? "Verified from the given structure" : "Model-assisted interpretation",
      detail: verifiedLocal
        ? "Mindscape uses deterministic geometry or analytic reasoning before creating the explanation."
        : "Mindscape validates the scene plan and will ask for clarification when the input is ambiguous.",
    },
    storyboard: {
      canReplay: true,
      canRewind: true,
      canInterrupt: true,
    },
  };
}

export function normalizeLessonMetadata(value = {}, fallback = {}) {
  const inferred = inferLessonMetadata(fallback);
  const curriculum = value.curriculum || inferred.curriculum;
  const verification = value.verification || inferred.verification;
  return {
    curriculum: {
      board: String(curriculum.board || inferred.curriculum.board),
      gradeBand: String(curriculum.gradeBand || inferred.curriculum.gradeBand),
      strand: String(curriculum.strand || inferred.curriculum.strand),
      topic: String(curriculum.topic || inferred.curriculum.topic),
    },
    verification: {
      status: ["verified_local", "model_assisted", "needs_clarification"].includes(verification.status)
        ? verification.status
        : inferred.verification.status,
      label: String(verification.label || inferred.verification.label),
      detail: String(verification.detail || inferred.verification.detail),
    },
    storyboard: {
      canReplay: value.storyboard?.canReplay !== false,
      canRewind: value.storyboard?.canRewind !== false,
      canInterrupt: value.storyboard?.canInterrupt !== false,
    },
  };
}
