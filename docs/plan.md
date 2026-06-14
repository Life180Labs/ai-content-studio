# AI Content Studio: Architecture & Implementation Plan
**Author:** Life180Labs Team 
**Status:** Approved for Implementation
**Version:** 1.0

## 1. Product Summary
AI Content Studio is an AI Content Operating System that enables humans and AI agents to collaboratively create, optimize, manage, and distribute content at scale. It transforms a simple idea into a complete AI-generated video.

## 2. Technology Stack
* **Frontend**: Next.js, TypeScript, TailwindCSS, ShadCN, Framer Motion, Zustand, React Query
* **Backend**: FastAPI, Python, SQLAlchemy, Alembic
* **AI Orchestration**: LangGraph (Manages AI state transitions, agent collaboration, and complex fallback/retry mechanisms).
* **Database & Cache**: PostgreSQL, Redis
* **Storage**: Cloudflare R2
* **Infrastructure & Deployment**: Railway.
* **Monitoring**: Prometheus, Grafana, OpenTelemetry (Integrated alongside Railway metrics).

## 3. System Architecture & Deployment (Railway)
The platform is deployed entirely on Railway.
* **Frontend Service**: Next.js application handling the user interface and state.
* **Backend API Service**: FastAPI handling business logic, user management, and DB interactions.
* **LangGraph Worker Service**: Dedicated Python worker running the LangGraph state machine for complex, long-running AI workflows.
* **Railway Plugins**:
    * PostgreSQL (Primary Data Store)
    * Redis (Caching, Rate Limiting, and Pub/Sub for LangGraph state sync)

## 4. User Journey & Interface Flow

### 4.1. Authentication & Configuration
* **Login/Register**: JWT-based authentication system.
* **Settings (AI Routing Strategy)**: Granular control over the AI Gateway.
    * Define Model Providers, Models, and API Keys.
    * **Fallback Mechanism**: Toggle (Yes/No).
    * If Yes: Select action (Retry or Switch Model).
    * If Retry: Define retry count limit.
    * If Switch Model: Define the fallback model.
    * **Task-Specific Overrides**: Apply distinct models and fallback rules per node (Content Generation, Scripting, Voice Audio, Video Generation, Avatar Generation).

### 4.2. Main Navigation
* **Dashboard**:
    * Active/Recent Projects.
    * Generated Videos grid.
    * **AI Metrics Grid**: Cost metrics, AI model performance/usage metrics.
    * Action Buttons: "Start New Project", "Continue Existing Project".
* **Assets Tab**:
    * Manage global assets reusable across projects.
    * Includes: Avatars, Voices, Brand Kits.
* **Monitoring Tab**:
    * AI Operation Cockpit.
    * Cost by application modules (Voice, Video, Content).
    * AI Request Track (latency, token usage, success/fail rates).

### 4.3. The Video Generation Pipeline
LangGraph will manage the state transitions between these tabs, allowing for dynamic re-generation and human-in-the-loop approvals.

#### Step 1: Canvas Tab (Project Setup)
* **Inputs**: Project Name, Topic.
* **Key Points**: Add manually or use "AI Suggestion" button to auto-populate.
* **Parameters**: Target Audience, Goal, Tone, Length, Platform, Call to Action, Brand Voice.
* **Action**: "Generate Content" → Transitions state to Content generation.

#### Step 2: Content Tab
* **Display**: Shows 2 distinct content variations side-by-side, each scored with an AI Quality Score.
* **Interactions**: Select a variation, regenerate entirely, or improve existing via an "Additional Context/Prompt" input.
* **Action**: "Proceed" → Transitions state to Script generation.

#### Step 3: Script Tab
* **Display**: Loading state (managed via LangGraph streaming), followed by the structured video script.
* **Interactions**: Regenerate or improve the script by providing additional input/feedback.
* **Action**: "Approve & Proceed" → Transitions state to Storyboard generation.

#### Step 4: Storyboard Tab
* **Core Engine**: Automatically converts the approved script into structured, granular scenes.
* **Scene Structure**: Voice text, Visual Prompt, Avatar Action, Camera Direction.
* **Interactions**: Delete scene, regenerate scene, edit details manually, save edits, or add a new scene.
* **Action**: "Approve All Scenes & Proceed" → Transitions state to Voice generation.

#### Step 5: Voice Tab
* **Display**: Available voice narrations dynamically populated based on the model selected in Settings.
* **Interactions**: Preview voice samples, select a narration.
* **Voice Cloning**: Dedicated flow to clone a voice.
* **Action**: "Select & Proceed" → Transitions state to Avatar generation.

#### Step 6: Avatar Tab
* **Display**: Library of pre-existing or platform-provided avatars.
* **Customization**: Create a new avatar via Image Upload or via detailed Text Prompt generation.
* **Action**: "Select & Proceed" → Transitions state to Video generation.

#### Step 7: Video Tab
* **Display**: Grid showing individual videos for each storyboard scene.
* **Generation Logic**: Each scene is rendered combining the voice script, visual prompt, selected avatar, and selected voice narration. Lip-sync must match the narration perfectly.
* **Interactions**: Review and approve each individual scene.
* **Finalization**: "Merge Video" compiles all approved scenes into the final deliverable.
* **Export**: "Download Package" provides a zip containing:
    * Selected content (Text format)
    * Voiceover script (Text format)
    * Final rendered MP4 Video.

## 5. LangGraph AI Orchestration
To support the "Fallback Mechanism" defined in Settings, the AI Gateway will be implemented as a LangGraph state machine.

* **Nodes**: `GenerateContent`, `GenerateScript`, `GenerateStoryboard`, `GenerateVoice`, `GenerateAvatar`, `RenderVideo`.
* **Conditional Edges**: After each node, LangGraph checks for success. If an API error or timeout occurs, it reads the user's `Settings` state.
    * If `Retry` is configured, it loops back to the same node, decrementing the retry counter.
    * If `Switch Model` is configured, it transitions to a fallback node initialized with the secondary model parameters.
* **Human-in-the-loop**: Graph execution pauses at the end of each tab's generation cycle, waiting for explicit user approval (API trigger) before proceeding to the next node.

## 6. Database Updates (PostgreSQL)
* **Settings Table**: New table for `user_ai_preferences` storing dynamic provider models, keys, and granular fallback/retry JSON blobs.
* **Projects Table**: Updated to track the current `langgraph_thread_id` to allow users to resume sessions precisely where they left off.