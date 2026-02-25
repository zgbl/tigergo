---
name: winrate_loss_ranking
description: Requirements and algorithm for the Winrate Loss Ranking feature in ProblemEditor.js. KataGo returns winrates from Black's perspective only.
---

# Winrate Loss Ranking — Specification

## Overview

The Winrate Loss Ranking displays moves where a player made the biggest mistakes (winrate drops), sorted by severity. It is built in `ProblemEditor.buildWinrateLossRanking()` in `js/ProblemEditor.js`.

## Key Invariant: KataGo Returns Black-Perspective Winrates

All winrate values from the KataGo analysis API are **always from Black's perspective** (0–100%). This is the single most important fact for the loss calculation.

- `winRate = 60` means Black has 60% chance to win, White has 40%.
- `winRate = 30` means Black has 30% chance to win, White has 70%.

## Loss Calculation Formula

Compare consecutive positions `i-1` (before the move) and `i` (after the move). Both winrates are **Black's perspective**.

### Black's move (odd move numbers: 1, 3, 5, ...)

Black wants the winrate to **stay high or increase**. If it drops, Black made a mistake.

```
loss = prevWinRate - currWinRate
```

- Example: prev=55%, curr=52% → loss = 3% (Black lost 3%)

### White's move (even move numbers: 2, 4, 6, ...)

White wants Black's winrate to **drop**. If it rises instead, White made a mistake.

```
loss = currWinRate - prevWinRate
```

- Example: prev=52%, curr=57% → loss = 5% (White lost 5%, because Black's winrate went up)

### Clamping

- If `loss < 0`, set `loss = 0` (not a mistake, the player improved the position)
- Ignore losses ≤ 0.1% (noise)

## Display Requirements

| Requirement | Value |
|---|---|
| Mixed ranking | Black and white moves ranked together |
| Sort order | Descending by loss percentage |
| Max displayed | 50 items |
| Minimum expected | ~20 items for a typical game |
| Filter options | All / Black only / White only |

## Structural Rules

1. The `for` loop that calculates losses must **only** contain the per-move calculation logic.
2. The filtering, sorting, and rendering code must be **outside** the `for` loop (runs once after all moves are processed).
3. Both black and white moves must be pushed to `allLosses` — the push logic must be **outside** the `if (color === 'B') / else` block.

## Data Format

### Analysis Record Structure (from MongoDB)

Each record in `analysisResults` from MongoDB looks like:

```javascript
{
    moveNumber: 12,
    move: {
        color: "black",     // or "white" — FULL WORD, not "B"/"W"
        row: 3,
        col: 15,
        position: "Q16"     // KataGo coordinate format
    },
    analysis: {
        winRate: "55.3",    // STRING from .toFixed(1), always BLACK perspective %
        score: "1.50",      // STRING from .toFixed(2)
        visits: 800,
        ...
    }
}
```

> [!IMPORTANT]
> `winRate` is a **string** (e.g. `"55.3"`) because `AnalysisEngine.js` uses `.toFixed(1)`. `extractWinRate` must `parseFloat()` it.

> [!IMPORTANT]
> `move.color` uses full words (`"black"`, `"white"`), not abbreviations. `getMoveInfo` must normalize this to `"B"` / `"W"`.

### Loss Item Format

Each item in `allLosses`:

```javascript
{
    moveIndex: Number,      // 1-indexed move number
    color: 'B' | 'W',      // who played this move
    coord: String,          // e.g. "Q16"
    lossPercent: Number,    // winrate loss as percentage (e.g. 3.2)
    prevWinRate: Number,    // Black's winrate before this move
    currWinRate: Number,    // Black's winrate after this move
    scoreLoss: Number       // score (目数) change
}
```

## Helper Functions

- `extractWinRate(record)` — extracts Black-perspective winrate from an analysis record. Handles string/number/ratio formats.
- `getMoveInfo(record)` — extracts color ('B'/'W') and coordinate from a move record. Falls back to moveNumber parity if color is not in the data.
- `extractScoreLoss(prev, curr, color)` — calculates score (目数) loss for the move.

## Production Constraints & Stability

### 1. AI Verification Guard
In production (Vercel), a **8-second timeout** is enforced in `KataGoAPI.js` to prevent the platform's 10s execution limit.
- If a candidate move analysis times out, it should be marked as an error.
- Errored moves **MUST NOT** be used for winrate loss ranking or "Best Move" selection.

### 2. Scoring Integrity
When calculating the "Best Move" or marking a "Correct Answer":
- Ensure the move has a valid `aiResult` without error.
- If the best AI move failed due to timeout, fall back to the next best valid move or inform the user rather than showing a zeroed/placeholder score.

## Common Mistakes to Avoid

> [!CAUTION]
> These are mistakes that have occurred in previous refactoring sessions:

1. **Putting `allLosses.push()` only inside one branch** — both black AND white losses must be pushed.
2. **Putting sorting/rendering inside the `for` loop** — this causes the ranking to be rebuilt on every iteration and embeds subsequent methods inside the loop.
3. **Using wrong winrate perspective** — KataGo data is ALWAYS Black's perspective. Do NOT assume it's "side-that-just-moved" perspective.
4. **Limiting the loop range** — always iterate through ALL `analysisResults`, not a hardcoded number like 20.
5. **Not handling object-format moves in `getMoveInfo`** — `record.move` from MongoDB is an object `{color: "black", position: "Q16"}`, NOT a string or array. Must add `typeof move === 'object'` branch.
6. **Forgetting `move.color` uses full words** — MongoDB stores `"black"` / `"white"`, not `"B"` / `"W"`. The normalization code `color.toString().toUpperCase()[0]` handles this correctly ("black"→"B", "white"→"W").
