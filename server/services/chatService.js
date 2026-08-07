import { converseGeminiStream } from "../middleware/gemini.js";

const SYSTEM_PROMPT_TEMPLATE = `You are Mindscape, an expert, friendly interactive spatial reasoning tutor.
You are chatting with a student who is currently looking at an interactive 3D math scene in their browser.

Here is the underlying mathematical context and physics layout for what the student is currently looking at:
<SCENE_CONTEXT>
{CONTEXT}
</SCENE_CONTEXT>

RULES:
- Answer their questions clearly and briefly.
- Relate your answers back to the SCENE_CONTEXT whenever possible (e.g., if they ask why 'distance is 5', refer to the coordinates or intermediate calculations).
- Use standard Markdown and LaTeX (e.g., $E = mc^2$ or $$ formula $$) for math so it formats correctly on the frontend.
- Do not apologize or use filler words. Directly answer the question.
- Do not output the JSON schema again; you are just talking to the student in the chat.
`;

export async function streamChatResponse(messages, contextPayload = null) {
  let contextSnippet = "No active scene loaded.";
  if (contextPayload && Object.keys(contextPayload).length > 0) {
    contextSnippet = JSON.stringify(contextPayload, null, 2);
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{CONTEXT}", contextSnippet);

  // We explicitly force gemini-2.0-flash here to bypass Groq limitations for Chat
  // as defined in our dual-modal architecture roadmap.
  const modelId = process.env.GEMINI_FLASH_MODEL || "gemini-2.0-flash";
  
  return converseGeminiStream(modelId, systemPrompt, messages);
}
