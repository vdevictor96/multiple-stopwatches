# Work Plan: localStorage Persistence for Multiple Stopwatches

## Overview

Add localStorage persistence so stopwatch state (names, elapsed times, keybinds, macros, visual order) survives browser refresh and close. Stopwatches restore paused with correct elapsed times. This is a small-scale, single-file change to `multiple-stopwatches_script.js`.

## Technical Approach

**Storage format:** Single JSON object keyed under `multiple-stopwatches-state` with: `{ stopwatches, keybindMap, order, numIds }`. Stopwatches array holds `{ id, name, keybind, elapsedTime }`. Keybind map: `key -> array of stopwatch IDs` (not object refs).

**Save:** Central `saveState()` function serializes current state (excluding DOM refs). Compute elapsed for running stopwatches as `prevTime + (Date.now() - startTime)/1000`. Derive visual order from `allStopwatches.children` (skip id `"0"`). Call `saveState()` from all mutation points.

**Restore:** On load, check localStorage before default `addStopwatch()`. If data exists, parse with `try/catch`, validate structure, then build DOM and state from persisted data. Recreate `keybindObj` from IDs, restore sidebar macros. Handle corrupted/missing data by falling back to empty state.

**Throttling:** For `updateStopwatches()` (runs every 10ms), debounce saves (e.g. save at most every 500ms while any stopwatch is running).

---

## Task Checklist

- [x] **1. Define storage schema and helpers**
  - Add `STORAGE_KEY` constant
  - Implement `getSerializableState()` → `{ stopwatches, keybindMap, order, numIds }`
  - Implement `saveState()` that calls `localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()))`

- [x] **2. Implement restore flow**
  - Add `loadState()` that parses JSON with try/catch, returns `null` on error/invalid data
  - Add `restoreFromState(data)` that creates DOM nodes, populates `stopwatchArray`/`keybindObj`, inserts in order, sets `numIds`
  - Ensure restored stopwatches are paused (no `going` class, `prevTime` = elapsed, `startTime` = 0)

- [x] **3. Wire save into mutation points**
  - Call `saveState()` from: `addStopwatch`, `removeStopwatch`, `clear`, `clickTimeButtonEvent`, `nameChangeEvent`, `keybindChangeEvent`, `addMacroKeybind`, `removeKeybind`, drop handler
  - Add throttled save for running timer: debounce (e.g. 500ms) inside `updateStopwatches` when any stopwatch is `going`

- [x] **4. Integrate restore on load**
  - Replace initial `addStopwatch()` with: `const data = loadState(); if (data) restoreFromState(data); else addStopwatch();`
  - Ensure `removeAll` resets `numIds` and clears localStorage (or save after removal)

- [x] **5. Edge cases and validation**
  - Validate parsed data (arrays/objects present, IDs consistent)
  - Fallback to empty state on corrupt/invalid data
  - Sanity-check `keybindMap` keys reference existing stopwatch IDs; drop invalid refs

---

## Acceptance Criteria Checklist

- [x] Stopwatch names, elapsed times, and keybinds persist across page refresh
- [x] Macro keybinds persist across page refresh
- [x] Visual order of stopwatches persists across page refresh
- [x] Running stopwatches restore as paused with correct elapsed time
- [x] Adding/removing/clearing stopwatches updates localStorage
- [x] No performance degradation from frequent saves (throttle running timer saves)
- [x] Graceful handling of corrupted/missing localStorage data (fallback to empty state)
