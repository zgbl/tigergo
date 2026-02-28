---
description: Mandatory UI standards for the TigerGo Go Board display.
---

# Go Board UI Standards

> [!IMPORTANT]
> **PERMANENT PROTECTION**: The features documented here (especially the Last Move Triangle) are CORE architectural requirements. They MUST NOT be removed, modified to be less visible, or disabled during refactoring. If a refactor breaks these features, it is a FAILURE of the implementation.

## 1. Last Move Marker (Mandatory)

The last played stone MUST always be marked with a triangle to help the user identify the most recent move.

### Technical Implementation
- **Class Name**: `.last-move-triangle`
- **Centralized Logic**: Use `BoardController.renderLastMoveMarker()` whenever possible.
- **Synchronization**: MUST ensures that the global `window.updateMoveInfo` is synchronized with the controller's version to catch all navigation types.
- **Styling Rules**:
    - **Color**: White triangle on black stones, Black triangle on white stones.
    - **Position**: Centered on the stone (`top: 50%; left: 50%; transform: translate(-50%, -50%);`).
    - **Size (Critical)**: Must be clearly visible.
        - `border-left/right`: `16%` of `cellSize` (total width 32%)
        - `border-bottom`: `28%` of `cellSize`
    - **Z-Index**: Should be `15` to appear above stones and most markers.
    - **Interactions**: `pointer-events: none` to prevent interference with clicks.

### CSS Reference
```css
.last-move-triangle {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 0; height: 0;
    border-left: 7px solid transparent; /* Proportional to cellSize */
    border-right: 7px solid transparent;
    border-bottom: 12px solid #ffffff; /* Or #000000 */
    z-index: 15;
    pointer-events: none;
    filter: drop-shadow(0 0 1px rgba(0,0,0,0.3));
}
```

## 2. Stone Rendering

### Sizing
- **Stone Size**: Must be exactly `95%` of the cell size (`cellSize * 0.95`).
- **Standardization**: Do not use `0.98`, `0.9`, or other variants. Standardizing at `0.95` ensures a consistent gap between stones.

## 3. Resize Handling

- All board views MUST support responsive resizing without losing the current game state.
- Use `BoardController.refreshBoard()` to handle resize events instead of manual re-rendering logic.
