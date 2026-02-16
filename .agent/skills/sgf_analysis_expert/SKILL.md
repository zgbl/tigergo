---
name: sgf_analysis_expert
description: Expert knowledge on TigerGo's SGF Analysis features, requirements, and implementation details.
---

# SGF Analysis Expert Skill

This skill provides context and requirements for the TigerGo SGF Analysis feature. When working on SGF analysis related tasks, refer to these requirements and implementation details.

## Feature-to-Page Mapping

To ensure architectural consistency, the AI must follow this mapping when modifying or adding features:

### 1. Analysis Core
- **Desktop**: `SGFAnalysis.html` (Main entry, full-featured UI).
- **Mobile**: `SGFAnalysisMobile.html` (Touch-optimized, narrow borders).
- **Logic**: `js/SGFAnalysis.js` (Shared analysis engine logic).

### 2. Go Board & Stones
- **Renderer**: `js/GoBoard12.js` (Core rendering logic).
- **Controller**: `js/BoardController.js` (Interaction handling).
- **Styles**: `css/SGFAnalysis.css` (Desktop) & `css/SGFAnalysisMobile.css` (Mobile).

### 3. Question Making (New)
- **Problem List/Manager**: `SGFAnalysis.html` (Desktop interface for selecting/viewing questions).
- **Quiz Player**: `Quiz.html` (Dedicated page for solving generated questions).
- **Logic**: `js/CandidatePointsDisplay.js` (Handles marking A/B/C/D points).

### 4. Internationalization (i18n)
- **Logic**: `js/i18n.js` (Translation engine).
- **Switcher**: Located in headers of both `SGFAnalysis.html` and `SGFAnalysisMobile.html`.

### 1. KataGo Analysis Integration
- **Backend**: Uses a Python KataGo server.
- **Proxy**: Next.js backend provides an endpoint `/api/katago/select-move/[botName]` to proxy requests to the Python server.
- **CORS**: The backend is configured to handle CORS to allow the frontend to connect.
- **Frontend**: The frontend connects to the Next.js proxy endpoint, not directly to the Python server (to avoid mixed content/safety issues).

### 2. Test Question UI
The "Test" or "Study" mode allows users to generate and solve problems based on the analysis.
- **Generated Questions List**: A visible list of all generated questions.
- **Navigation**: "Next" and "Previous" buttons to cycle through questions.
- **Interactive Preview**: Clicking a question or using navigation updates the board to the problem position.
- **Visual Labels**: Candidate points on the board are labeled with A/B/C/D for clarity.

### 3. Mobile Experience
- **Mobile Page**: `SGFAnalysisMobile.html` provides a mobile-optimized interface.
- **Design**: Uses Tailwind CSS for responsive design.
- **Functionality**: Maintains core SGF loading, analysis controls, and board display.
- **Access**: The main PC page (`SGFAnalysis.html`) has a "Switch to Mobile" button.
- **Back to Desktop**: The mobile page must have a "Back to Desktop" button (footer/header) to return to `SGFAnalysis.html`.
- **Critical Logic**: Mobile page MUST:
    - Initialize global variables (`window.currentMoves`, `window.currentMoveIndex`) for `GoBoard12.js`.
    - Provide global `calculateBoardSize()` and `updateStoneSizeCSS()` functions for `BoardController.js`.

### 4. SGF Question Making (Automation)
This module defines the logic for automatically screening and generating Go problems from SGF analysis results.

#### 4.1 Execution Flow
1.  **Quick SGF Analysis**:
    - Call KataGo engine with playouts between 100-400.
    - Generate winrate graph and score lead data.
2.  **Question Selection Criteria**:
    - **Mistakes**: Points where winrate drops > 5% or score loss > 2 points.
    - **Critical Moments**: High-tension areas where winrate fluctuates between 40%-60%.
    - **Density Control**: Maximum 1 question per 10 moves to avoid clutter.
3.  **Deep Review & Generation**:
    - Perform high-playout analysis (> 1000) on selected points.
    - **Metadata**: Include question description (e.g., "How should Black respond?"), difficulty, and category.
    - **Candidates**: Label Top 3 AI moves as Correct/Sub-optimal (A, B, C) and the actual game move as the Error case if it was a mistake.
4.  **Storage & Database**:
    - Save via backend API (e.g., `/api/questions/save`).
    - Required Data: `sgf_hash`, `move_index`, `options` (coordinates + labels), `correct_answer`, `context_sgf`.

### 5. Analysis Result Storage
- **Format**: JSON (Preferred for structure and parsing)
- **Content Requirements**:
    - **Move Information**: Move number, Player color.
    - **Current Site Stats**: Win rate, Score lead (points difference).
    - **Candidates**: Store top 10 candidates. Each candidate must include:
        - Move coordinate, Win rate, Score lead, Win rate loss, Score loss.

## Verification Checklist
1.  **Network**: Analysis requests succeed (200 OK) to `/api/katago/...`.
2.  **Questions**: Generating questions works, and navigation updates the board correctly with labels A/B/C/D.
3.  **Mobile**: The mobile page loads, renders the board, and analysis/language switching works.
4.  **Logic**: Automated question selection respects the winrate/score loss thresholds defined in Section 4.1.

### 6. Problem Generation Page (New)
A specialized tool for manually creating and refining Go problems from analyzed games.

#### 6.1 Workflow
1.  **Entry**: "Create Problem" (制作题目) button in `SGFAnalysis.html`.
2.  **Selection**: Opens `ProblemEditor.html` with the current game loaded.
3.  **Discovery**:
    - **Conditions**: User sets thresholds (e.g., Winrate Drop > 2%).
    - **Navigation**: "Next Candidate" button jumps to moves meeting criteria.
4.  **Refinement**:
    - **Board Interaction**: User clicks the board to add manual candidate points (A, B, C, D) not found by AI.
    - **AI Verify**: "Analyze Candidates" button runs KataGo on all selected points (AI + Manual).
    - **Stop**: Manual stop button.
5.  **Grading & Saving**:
    - System calculates Winrate Loss / Score Loss for each candidate.
    - **Best Move**: Automatically marked as Correct Answer.
    - **Partial Credit**: Other moves graded based on loss magnitude.
    - **Save**: Stores problem set for "Exam Mode".
