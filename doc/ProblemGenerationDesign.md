# Problem Generation System Design

## 1. Overview
A specialized interface (`ProblemEditor.html`) to create Go problems from analyzed SGF games. It bridges the gap between raw AI analysis and educational content by allowing human instructors to select, refine, and grade specific board positions.

## 2. Requirement Analysis
The system needs to satisfy the following core requirements:
1.  **Selection**: Load analyzed SGFs and navigate to interesting positions from `SGFAnalysis.html`.
2.  **Discovery**: Filter moves based on criteria like "Winrate Drop > 2%".
3.  **Refinement**: Manually add candidate points (A, B, C...) and review existing AI candidates.
4.  **Verification**: Submit selected candidates (AI + Manual) for fresh AI analysis to determine exact values.
5.  **Grading**: Automatically grade answers based on loss (Winrate/Score) compared to the best move.
6.  **Output**: Save the "Problem" for use in exams.

## 3. User Interface (`ProblemEditor.html`)

### 3.1 Layout Structure
The page will maintain a similar aesthetic to `SGFAnalysis.html` but simplified for editing focus.

*   **Left Sidebar (Navigation & Discovery)**:
    *   **Game Info**: Text summary.
    *   **Filter Panel**:
        *   Input: `Min Winrate Drop (%)` (Default: 2)
        *   Input: `Min Score Loss (pts)` (Default: 1.0)
        *   Button: `Find Next Candidate` (Scans forward for matching moves).
    *   **Move List**: Standard move tree optimized for jumping.

*   **Center Area (Board Interaction)**:
    *   **Go Board**: Large interactive board.
    *   **Overlays**:
        *   **AI Moves**: Standard Green/Blue dots (can be toggled off).
        *   **Problem Candidates**: Large A, B, C, D labels.
    *   **Interaction Mode**:
        *   *View Mode*: Navigate moves.
        *   *Edit Mode*: Click on empty intersection -> Adds a Candidate Point (A, B... sequence). Click existing candidate -> Remove.

*   **Right Panel (Problem Editor)**:
    *   **Question Settings**:
        *   `Question Type`: [ Choice / Interactive ]
        *   `Description`: Textarea (e.g., "Black to live", "Find the tesuji").
        *   `Difficulty`: Star rating.
    *   **Candidates Table**:
        *   Columns: Label (A), Coordinate (Q16), Win% (AI), Loss, Score (Points).
        *   **Row Actions**: Delete, Set as Correct (Manual override).
    *   **Analysis Control**:
        *   Button: `Analyze Candidates` (Runs short/medium playouts on all defined candidates).
        *   Status: Progress bar for batch analysis.
    *   **Grading Preview**:
        *   Shows calculated points (0-100) for each answer based on loss.

## 4. Workflow Logic

### 4.1 Discovery Flow
1.  User enters `ProblemEditor.html` with `gameId`.
2.  System loads full analysis results.
3.  User sets "Winrate Drop > 5%".
4.  User clicks "Next".
5.  JavaScript logic scans `window.analysisResults` starting from `currentMoveIndex + 1`.
6.  Finds Move 53 where `winRateLoss > 0.05`.
7.  `boardController.goToMove(52)` (Wait at the move *before* the mistake).
8.  User sees the board state. This is the "Question Start".

### 4.2 Candidate Selection & Verification
1.  **AI Suggestions**: The editor automatically imports the top 3 AI moves from the existing analysis as candidates A, B, C.
2.  **Manual Addition**: User clicks ‘D4’. A new candidate ‘D’ appears in the table with "Stats: Unknown".
3.  **Verification**:
    *   User clicks "Analyze Candidates".
    *   System sends a batch request (or sequential requests) to `AnalysisEngine` for each candidate coordinate.
    *   Each request asks for e.g., 400 visits to get stable winrates.
    *   Table updates with fresh Win% and Score.

### 4.3 Grading Logic
The system automatically assigns scores:
1.  Identify `BestWinRate` among candidates.
2.  For each candidate `i`:
    *   `Loss = BestWinRate - CandidateWinRate`
    *   If `Loss < Threshold_Perfect (e.g. 2%)`: Score = 100 (Correct)
    *   If `Loss < Threshold_Good (e.g. 5%)`: Score = 80 (Good)
    *   If `Loss < Threshold_Bad (e.g. 15%)`: Score = 40 (Bad)
    *   Else: Score = 0 (Blunder)

## 5. Technical Architecture

### 5.1 New Components
*   **ProblemEditor.html**: Entry point.
*   **js/ProblemEditor.js**: Orchestrates the UI.
    *   `findNextCandidate(criteria)`
    *   `addCandidate(coord)`
    *   `analyzeCandidates(list)`
*   **js/ProblemGrader.js**: Encapsulates the scoring math.

### 5.2 Reuse
*   `js/SGFAnalysis.js` (for loading/parsing).
*   `js/BoardController.js` (needs update to support "Candidate Edit Mode").
*   `js/AnalysisEngine.js` (logic exists, need to verify "Analyze specific move" support).

### 5.3 Data Persistence
*   **API**: `POST /api/problems/save`
*   **Schema**:
    ```json
    {
      "gameId": "...",
      "moveNumber": 52,
      "generatedAt": "ISO...",
      "settings": { ... },
      "candidates": [ ... ]
    }
    ```

## 6. Implementation Plan / Roadmap
1.  **Phase 1: Setup**: Clone `SGFAnalysis.html` to `ProblemEditor.html` and strip unused UI.
2.  **Phase 2: Discovery**: Implement the logic to scan analysis results and jump to "interesting moves".
3.  **Phase 3: Interaction**: specific BoardController mode for clicking to add A/B/C labels.
4.  **Phase 4: AI Loop**: Implement the "Analyze Candidates" button to fetch data for user-selected points.
5.  **Phase 5: Grading**: Implement the math to convert Win% diff to "Score".
