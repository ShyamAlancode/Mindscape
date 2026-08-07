# Mindscape

Mindscape turns a static maths or physics worksheet into an interactive 3D lesson. Learners upload a diagram or type a question, inspect and manipulate the generated scene, then explain their reasoning to receive focused feedback rather than just an answer.

The flagship flow is a surface-area lesson: worksheet to labelled 3D solid, then exploration, prediction, explanation, and a follow-up challenge.

## Try the judge-safe demo

Start the app and open [http://localhost:3000/?demo=true](http://localhost:3000/?demo=true). The guided cuboid surface-area lesson runs through the local planner and does not require API keys. It is designed for a reliable demo recording or judge review.

## Local setup

### Requirements

- Node.js 20+
- npm
- Webcam for hand tracking
- Microphone for push-to-talk voice mode

### Install

```bash
npm install
pip install -r requirements.txt
```

### Environment

Create `.env.local` in the project root:

```env
GEMINI_API_KEY=your_google_ai_studio_key
GROQ_API_KEY=your_groq_api_key
```

The app requires these keys for vision (Gemini), conversational tutoring (Groq), and transcription (Groq).

## Run

```bash
npm run dev
```

Then open `http://localhost:3000`. Use `?demo=true` for the no-key guided worksheet demo.

## Verify

```bash
npm run quality
```

This runs linting and the complete automated test suite.

## Built with Codex and GPT-5.6

Codex and GPT-5.6 were used to stabilize the interactive lesson flow, repair the streaming voice lifecycle, add a no-key demo path, strengthen test coverage, and refine the submission-ready product experience. The project keeps deterministic lesson and scene fallbacks so the core learning journey remains demonstrable when external model services are unavailable.

## Architecture
 
 ### High-level system design
 
 ```text
 +---------------------------------------------------------------+
 | Frontend                                                      |
 | Vanilla JS + Three.js                                         |
 |                                                               |
 | - Question input (text, image, screenshot)                    |
 | - 3D scene rendering                                          |
 | - Tutor panel                                                 |
 | - Voice UI (Browser Web Speech API)                           |
 | - Hand tracking                                               |
 | - KaTeX rendering                                             |
 | - Real-time "Limited Mode" alerts                             |
 +---------------------------------------------------------------+
                            |
                            | HTTP / SSE
                            v
 +---------------------------------------------------------------+
 | Backend                                                       |
 | Node.js + Hono API                                            |
 |                                                               |
 | - Request validation                                          |
 | - Gemini & Groq Hybrid integration                            |
 | - 3-Tier Model Failover (Gemini -> Groq 70B -> Groq 8B)       |
 | - Text-as-Vision Fallback (Rescues scene interpretation)      |
 | - SceneSpec generation (Strict JSON enforcement)              |
 | - Tutor streaming                                             |
 | - Voice pipeline coordination (Whisper STT)                   |
 +---------------------------------------------------------------+
                            |
             +--------------+--------------+
             v                             v
 +-----------------------+     +-----------------------+
 | Google Gemini         |     | Groq (Llama 3)        |
 |                       |     |                       |
 | - Primary Vision      |     | - Primary Reasoning   |
 | - Primary Planning    |     | - Whisper STT (v3)    |
 | - Failover Chat       |     | - 70B Scene Planning  |
 |                       |     | - Visual Failover     |
 +-----------------------+     +-----------------------+
 ```

## Hardened Failover System

The system is built for hackathon-grade resiliency:
- **Vision Fallback**: If Gemini 2.0 Flash hits quota or fails, the system automatically falls back to **Llama 3.2 11B Vision** on Groq.
- **Interpretation Fallback**: If all vision models fail to interpret a diagram, the system uses the high-capacity **Llama 3.3 70B** to interpret the question text alone, ensuring a valid 3D scene is still built.
- **Search Fallback**: Semantic search (Gemini Embeddings) automatically falls back to **Lexical Keyword Search** if the API key is restricted or out of quota.
- **Transparency**: The UI displays a "Limited Mode" warning in the evidence panel whenever the system is operating in a fallback state.
