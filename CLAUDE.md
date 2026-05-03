# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

No test runner or linter is configured. There is no TypeScript — the project is plain ES module JavaScript.

## Architecture

Vanilla JS + Vite, no framework. Three layers:

**Game logic** (`src/game/`) — pure JS, no DOM access:
- `deck.js` — `Card` and `Deck` classes. `Deck` holds 6 standard decks and auto-reshuffles when < 52 cards remain.
- `strategy.js` — Basic strategy tables (6-deck, S17, DAS). `getAction(playerCards, dealerUpcard, {canDouble, canSplit, canSurrender})` returns the ideal action code: `H`, `S`, `D`, `Ds`, `SP`, or `R`. Also exports `handValue`, `isSoft`, `isPair`, `actionLabel`, `actionExplanation`.
- `scorer.js` — Tracks decisions vs. strategy; exposes `accuracy` %.
- `engine.js` — Event-driven state machine (`State.IDLE → DEALING → PLAYER_TURN → DEALER_TURN → PAYOUT`). All async game flow lives here. Emits events that the UI layer listens to; never touches the DOM.

**UI layer** (`src/main.js`) — all DOM manipulation:
- Subscribes to engine events (`cardDealt`, `cardFlipped`, `playerTurn`, `handSplit`, `result`, `handComplete`, `decision`, etc.) and updates the DOM.
- Card elements are created with `makeCardEl()` and appended to hand area divs. CSS handles the flip animation via `.face-down` toggle. Deal animation uses the `.card-enter` class.
- `getOrCreateHandSlot(idx)` dynamically creates hand slot divs for split hands.

**Tutorial** (`src/tutorial/tutorial.js`) — self-contained modal with 7 slides. Uses `localStorage.tutorialSeen` to auto-show on first visit.

## Key design decisions

- **Engine events fire after state mutations**: hand arrays are updated before `cardDealt` is emitted, so event handlers can safely read `engine.playerHands[handIdx]`.
- **Split rendering**: `handSplit` handler clears both hand slot areas immediately (`innerHTML = ''`) and re-renders from engine state before the new cards are dealt. Do not use the animated `clearArea()` here.
- **Scoring**: `_recordDecision` in the engine compares the player's action against the "ideal" action (all options available) and accounts for standard fallbacks (e.g., `D→H` when doubling isn't available).
- **Betting mode**: bet is deducted at `deal()` time, not when chips are placed. `betChanged` event updates the DEAL button enabled state.
- **Card CSS**: cards use `transform-style: preserve-3d` with front/back faces. `.face-down` adds `rotateY(180deg)` to `.card-inner`. Flip uses a two-step: add `.flipping` (→ 90°), then remove `.face-down` and `.flipping`.
