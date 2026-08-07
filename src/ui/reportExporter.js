/**
 * reportExporter.js — Captures 3D WebGL viewport snapshots, lesson history, formulas,
 * and generates printable PDF homework reports.
 */

export function exportPdfReport({
  world = null,
  questionText = "3D STEM Lesson",
  lessonPlan = null,
  history = [],
  finalAnswer = null,
} = {}) {
  // 1. Capture WebGL Canvas Screenshot
  let canvasDataUrl = "";
  if (world?.renderer?.domElement) {
    try {
      world.render(); // Ensure fresh frame render before capture
      canvasDataUrl = world.renderer.domElement.toDataURL("image/png");
    } catch (err) {
      console.warn("[ReportExporter] Canvas capture warning:", err.message);
    }
  }

  // 2. Format Conversation History
  const transcriptHtml = (history || [])
    .map((item) => {
      const isUser = item.role === "user" || item.role === "learner";
      const sender = isUser ? "Learner" : "Mindscape Tutor";
      const bg = isUser ? "#f3f4f6" : "#e0f2fe";
      return `<div style="background:${bg}; padding:10px 14px; border-radius:6px; margin-bottom:8px;">
        <strong style="color:${isUser ? "#374151" : "#0369a1"};">${sender}:</strong>
        <p style="margin:4px 0 0 0;">${escapeHtml(item.content || "")}</p>
      </div>`;
    })
    .join("");

  // 3. Build Printable HTML Document Window
  const reportWindow = window.open("", "_blank", "width=900,height=1000");
  if (!reportWindow) {
    alert("Please allow popups to generate the PDF report.");
    return;
  }

  const formula = lessonPlan?.answerScaffold?.formula || lessonPlan?.sceneFocus?.primaryInsight || "";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  reportWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mindscape AI - Lesson Report</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 30px; line-height: 1.5; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { color: #0f172a; margin: 0; font-size: 24px; }
    .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
    .date { color: #64748b; font-size: 12px; }
    .section { margin-bottom: 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .scene-img { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #cbd5e1; display: block; margin: 10px auto; }
    .formula-box { background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px; font-size: 15px; font-family: monospace; font-weight: bold; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px; text-align:right;">
    <button onclick="window.print()" style="background:#0284c7; color:#fff; border:none; padding:10px 20px; font-size:14px; font-weight:bold; border-radius:6px; cursor:pointer;">Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <h1>Mindscape AI — 3D Lesson Report</h1>
      <div class="subtitle">Interactive STEM Learning & Socratic Dialogue Summary</div>
    </div>
    <div class="date">${dateStr}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Question / Problem Statement</h2>
    <p style="font-size:16px; font-weight:600; color:#334155; margin:0;">${escapeHtml(questionText)}</p>
  </div>

  ${
    canvasDataUrl
      ? `<div class="section">
          <h2 class="section-title">3D Viewport Visual Evidence</h2>
          <img class="scene-img" src="${canvasDataUrl}" alt="3D Scene State" />
         </div>`
      : ""
  }

  ${
    formula
      ? `<div class="section">
          <h2 class="section-title">Key Formula & Governing Insight</h2>
          <div class="formula-box">${escapeHtml(formula)}</div>
         </div>`
      : ""
  }

  ${
    finalAnswer
      ? `<div class="section">
          <h2 class="section-title">Final Worked Answer</h2>
          <div style="font-size:18px; font-weight:bold; color:#166534; background:#f0fdf4; padding:10px 14px; border-radius:6px; border:1px solid #bbf7d0;">${escapeHtml(String(finalAnswer))}</div>
         </div>`
      : ""
  }

  <div class="section">
    <h2 class="section-title">Socratic Tutor Transcript</h2>
    ${transcriptHtml || "<p style='color:#94a3b8;'>No conversation turns recorded.</p>"}
  </div>
</body>
</html>`);

  reportWindow.document.close();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
