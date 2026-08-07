# Mindscape AI — AI Spatial Reasoning & STEM 3D Tutor

Mindscape turns static STEM worksheets, 3D CAD models, and physics problems into an interactive, real-time 3D playground. Learners upload diagrams or CAD files, explore electric field vector mechanics, manipulate generated scenes, and participate in multi-user real-time 3D classrooms with live AI spatial tutoring.

---

## Key Capabilities

### ⚡ 1. Advanced Interactive Physics & Vector Simulations
- **Coulomb Force Vector Arrows**: Real-time 3D visualization of pairwise electrostatic forces ($F_{ij} = k \frac{q_i q_j}{r_{ij}^2} \hat{r}_{ij}$) with attraction/repulsion color dynamics and magnitude vectors.
- **Dynamic Field Line Particle Flow**: Interactive RK4 streamline particle flow visualizing electric field lines.
- **Physics Playground Simulation**: Play/Pause trajectory integration accelerating charges under electrostatic forces.

### 📦 2. Custom 3D Model & CAD Importer (.gltf / .glb / .obj / .stl)
- **Drag & Drop Viewport Uploading**: Learners and engineers can drag custom 3D files directly into the Three.js viewport.
- **AI Spatial Analysis Metrics**: Automated geometry extraction (bounding box dimensions $dx, dy, dz$, surface area, estimated volume, vertex & face counts) fed directly to the AI Tutor for spatial reasoning.

### 👥 3. Multi-User Real-Time 3D Classroom (WebSockets)
- **Shared 3D Canvas Rooms**: Join via 6-character room code to connect teachers and learners live.
- **Real-Time Spatial Sync**: Object creation, scaling, rotation, deletion, presence cursor indicators, and tutor hints sync instantly across devices via WebSockets (`wss://`).

---

## Quick Start & Local Setup

### Requirements
- **Node.js 22+**
- **npm**
- Webcam (optional, for hand tracking)
- Microphone (optional, for push-to-talk voice mode)

### Installation

```bash
# Install dependencies
npm install
pip install -r requirements.txt
```

### Environment Configuration

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_google_ai_studio_key
GROQ_API_KEY=your_groq_api_key
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Use `?demo=true` for the offline guided worksheet demo.

### Quality & Test Suite

```bash
npm run quality
```

Runs ESLint and the complete automated unit test suite (170+ tests).

---

## ☁️ Free Cloud Deployment (Render)

Mindscape AI includes a production multi-stage `Dockerfile` (Node 22) and `render.yaml` blueprint for 1-click free deployment on **Render** with full WebSocket (`wss://`) support.

### 1-Click Render Deployment
1. Push code to your GitHub repository.
2. Log into [Render Dashboard](https://dashboard.render.com/) $\rightarrow$ Click **New +** $\rightarrow$ **Blueprint**.
3. Select your repository. Render will automatically detect `render.yaml`, build Vite production assets, and launch the Node.js + WebSocket Web Service for free.

---

## System Architecture

```text
+---------------------------------------------------------------+
| Frontend                                                      |
| Vanilla JS + Three.js + WebSockets                            |
|                                                               |
| - Question & CAD Input (text, image, .gltf, .obj, .stl)       |
| - Physics Simulation & Coulomb Vector Arrow Overlay           |
| - Multi-User Real-Time 3D Classroom UI                        |
| - AI Tutor & KaTeX math rendering                             |
| - Hand tracking & 3D gesture controls                         |
+---------------------------------------------------------------+
                            |
                            | HTTP / SSE / WebSockets (ws://)
                            v
+---------------------------------------------------------------+
| Backend Server                                                |
| Node.js 22 + Hono API + WebSocket Room Manager                |
|                                                               |
| - Real-time Classroom Room Broadcasting                       |
| - Gemini & Groq Hybrid AI Orchestration                       |
| - 3D CAD Geometric Metrics Extraction                         |
| - 3-Tier Model Failover (Gemini -> Groq 70B -> Groq 8B)       |
| - SceneSpec generation & Tutor Streaming                      |
+---------------------------------------------------------------+
                            |
             +--------------+--------------+
             v                             v
+-----------------------+     +-----------------------+
| Google Gemini         |     | Groq (Llama 3)        |
|                       |     |                       |
| - Primary Vision      |     | - Primary Reasoning   |
| - Primary Planning    |     | - Whisper STT         |
| - Failover Chat       |     | - 70B Scene Planning  |
+-----------------------+     +-----------------------+
```

---

## License & Credits

Built with Three.js, Hono, Node.js 22, Google Gemini API, and Groq SDK.
