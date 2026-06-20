# Recursion Tree Visualizer — Design & Spec (v1)

A tool for drawing recursion / DSA trees on screen, for studying. Three synced
panels — **tree**, **call stack**, **DP table** — all driven by a single step
position. Two input modes will exist over time; **v1 is the manual GUI editor**,
the code tracer and recurrence solver come later. All modes produce one shared
`RecursionTree` format that a single renderer draws.

**Stack:** React frontend, **rough.js** for the hand-drawn look on our own
canvas/node model. Python backend only enters later, with the code tracer.

**Priorities (from the user):** learning first, aesthetics second (clarity wins
ties), portability a distant third.

---

## 0. Decisions locked in (read first)

| Topic                | Decision                                                                 |
|----------------------|--------------------------------------------------------------------------|
| Patterns to support  | Tree recursion, backtracking, divide & conquer, DP/memoization (all)     |
| Static vs animated   | **Both** — build static tree first, layer stepping on top                |
| Node carries state   | **Yes** — a state snapshot per node (manual entry in v1)                 |
| Cache hits (DP)      | Separate **DP-table panel**; arrow node→cell on store, **dashed** cell→call on hit |
| Call stack           | **Live stack panel** beside the tree during stepping                     |
| First piece to build | **Manual GUI editor** (code tracer + solver come later)                  |
| Step order in v1     | **Manual & fully editable** — user sets call/return order, fills stack & DP by hand; solver auto-fills later |
| Visual vibe          | **Hand-drawn / Excalidraw style** (via rough.js)                         |
| Render engine        | **rough.js on our own canvas** + our own node model (not embedding Excalidraw) |
| Theme                | **Light-first**, dark supported                                          |
| Layout               | **Free placement + a "tidy up" button** (auto-arrange into a clean tree) |
| Saving               | **Save/load JSON files + export PNG/SVG**                                |
| Node content         | Call label `fn(args)`, return value, state snapshot, step number (labeled zones) |
| Return value shown   | **On the up-arrow AND in the node box**                                  |
| Arrows               | **Two parallel offset arrows** — down = call, up = return               |

---

## 1. Architecture

One idea holds the whole thing together: every input mode is just a **producer**
of a canonical `RecursionTree` JSON. The renderer, layout, and the three panels
never know which producer made the tree.

```
                          ┌──────────────────────┐
  [GUI editor — v1]    ──▶│                      │
  [Python tracer — later]▶│   RecursionTree JSON │──▶ layout ──▶ renderer + 3 panels
  [recurrence solver-later]▶│                    │
                          └──────────────────────┘
```

### Components

| Component        | Tech                         | When  | Responsibility                                |
|------------------|------------------------------|-------|-----------------------------------------------|
| GUI editor       | React                        | v1    | Build/edit a `RecursionTree` by hand          |
| Node model       | TS                           | v1    | In-memory tree + edges + step events          |
| Layout           | d3-hierarchy (tidy tree)     | v1    | "Tidy up" button → clean top-down coordinates |
| Renderer         | React + rough.js (SVG/canvas)| v1    | Hand-drawn nodes, two-arrow edges, colors     |
| Stepping engine  | TS                           | v1    | Drive node `state` + panels by step index     |
| Call-stack panel | React                        | v1    | Live frames at the current step               |
| DP-table panel   | React                        | v1    | Memo cells; store/hit arrows                   |
| Save / export    | TS                           | v1    | JSON file save/load, PNG/SVG export           |
| Tracer           | Python decorator             | later | Run a recursive fn → emit events → tree       |
| Solver           | Python                       | later | Expand a symbolic recurrence / auto-fill order|

### The three synced panels (the heart of v1)

All three read from the same `step` position (a number 0…N over the event
sequence). Moving the step changes all three at once.

```
 ┌──────────────────────────────┬───────────────┐
 │                              │  CALL STACK    │
 │        TREE (center)         │  ┌──────────┐  │
 │   square nodes + 2 arrows    │  │ foo(2,2) │←top│
 │   active path highlighted    │  │ foo(2,3) │  │
 │                              │  └──────────┘  │
 │                              ├───────────────┤
 │                              │  DP TABLE      │
 │                              │  (2,3)→5  ···  │
 └──────────────────────────────┴───────────────┘
            ◀◀  ◀  ▶  ▶▶   step 4 / 11   [scrubber]
```

---

## 2. The canonical format: `RecursionTree`

This is the contract — every producer emits it, the renderer only reads it.
Versioned so saved trees keep working.

```jsonc
{
  "version": "1",
  "meta": {
    "title": "foo(2, 3)",
    "source": "gui",              // "gui" | "tracer" | "solver"
    "function": "foo",            // optional
    "createdAt": "2026-06-20T00:00:00Z"
  },

  "nodes": [
    {
      "id": "n0",
      "parent": null,             // parent id; null for root
      "label": "foo(2, 3)",       // call label fn(args) — node zone 1
      "ret": 5,                   // return value — node zone 2 (also on up-arrow)
      "state_snapshot": "",       // freeform text the user types — node zone 3
      "step_in": 0,               // global seq when this call happens — node zone 4
      "step_out": 11,             // global seq when this call returns
      "depth": 0,
      "order": 0,                 // sibling order, left→right
      "status": "returned",       // lifecycle, see §4
      "pos": { "x": 480, "y": 40 },// manual position (free placement); set by tidy too
      "meta": {}
    }
    // ...children...
  ],

  "edges": [
    // two parallel arrows per parent/child pair:
    { "from": "n0", "to": "n1", "kind": "call",   "seq": 1 },
    { "from": "n1", "to": "n0", "kind": "return", "seq": 4, "value": 3 }
  ],

  // ordered list that drives stepping + the call-stack panel.
  // In v1 the user authors/edits this; later the solver/tracer generates it.
  "steps": [
    { "seq": 0,  "type": "call",   "node": "n0" },
    { "seq": 1,  "type": "call",   "node": "n1" },
    { "seq": 2,  "type": "return", "node": "n1", "value": 3 },
    { "seq": 3,  "type": "call",   "node": "n2" },
    // ...
  ],

  // DP table is its own panel; cells reference nodes for the store/hit arrows.
  "dp": {
    "enabled": true,
    "cells": [
      { "key": "(2,3)", "value": 5, "written_by": "n0", "written_seq": 11 }
    ],
    "hits": [
      { "node": "n7", "cell_key": "(1,2)", "seq": 9 }   // dashed arrow cell→node
    ]
  }
}
```

### Why each piece exists

- **`edges` holds two arrows** per pair (`call` down, `return` up) because you
  want both drawn as parallel offset arrows, and the return arrow is labeled with
  `value`. `parent` still gives the structural tree for layout.
- **`steps`** is the single ordered timeline. The scrubber/step controls walk it;
  the call-stack panel is reconstructed by replaying `call`/`return` up to the
  current `seq` (push on call, pop on return). In v1 you edit this list directly
  (reorder, insert, delete); later it's generated.
- **`step_in` / `step_out`** on a node let the static tree show step numbers and
  let the renderer know when a node is active (between in and out).
- **`dp`** is separate so the DP table renders as its own panel with store arrows
  (node→cell) and dashed hit arrows (cell→node).

---

## 3. Node anatomy (4 labeled zones)

Each square node (rough.js rectangle, hand-drawn stroke) shows:

```
 ┌─────────────────────┐
 │ #3        foo(2, 3) │   step number (corner)  +  call label fn(args)
 ├─────────────────────┤
 │  state: [Q . . .]   │   state snapshot (user-typed; optional per node)
 ├─────────────────────┤
 │  ↑ returns 5        │   return value (also labels the up-arrow)
 └─────────────────────┘
```

Keep it scannable — clarity is priority #1. State zone collapses if empty.

---

## 4. Node lifecycle (`status`) → color scheme

Drives both the static colors and the stepping animation. A purely static view
can show everything as `returned`; stepping flips statuses by `seq`.

| status      | meaning                              | color (default, tweakable) |
|-------------|--------------------------------------|----------------------------|
| `called`    | call arrow drawn, not yet executing  | dim outline                |
| `active`    | currently on the call stack          | blue                       |
| `returning` | just produced its return value       | amber (brief flash)        |
| `returned`  | done, value known                    | green                      |
| `base`      | base case / leaf                     | gray                       |
| `cachehit`  | resolved via DP table (no recursion) | purple (dashed hit arrow)  |

Arrows: **call = blue, return = green** (matching the down/up semantics). Single
source of truth = a `theme` object in the frontend, mirrored in this doc so GUI
and renderer never drift. Light theme first, dark theme as an alternate palette.

---

## 5. v1 — the manual GUI editor (build this)

Authoring flow, all hand-done and fully editable:

- **Add node**: click canvas → square node appears; type the call label.
- **Connect**: drag parent→child to create the `call` (down) edge; the matching
  `return` (up) edge is auto-created so you can label it with the value. Drawn as
  two parallel offset arrows.
- **Edit node**: fill the four zones (label, return value, state snapshot, step
  number). Empty zones collapse.
- **Free placement** with drag; a **"Tidy up"** button runs d3-hierarchy to
  auto-arrange into a clean top-down tree (writes `pos`).
- **Step timeline**: an editable `steps` list — add/reorder/delete call & return
  events. Step controls (◀◀ ◀ ▶ ▶▶ + scrubber) replay it; the **call-stack
  panel** and node statuses update live.
- **DP table panel**: add memo cells by hand; draw a store arrow from a node to a
  cell, and a dashed hit arrow from a cell to a reusing node.
- **Save/Load**: write/read `RecursionTree` JSON files. **Export** PNG/SVG for
  notes.

Everything the later solver will automate (step order, stack, DP fills) is
manual and editable in v1 — so v1 is useful immediately and the solver just
becomes another producer of the same fields.

---

## 6. Later phases (designed for, not built yet)

- **Code tracer (Python):** `@trace` decorator records `call`/`return` events
  with deep-copied state snapshots, folds them into a `RecursionTree` (incl.
  `steps` and `dp`). Runs via a local backend or Pyodide — decided then;
  portability is low priority so a local backend is fine.
- **Recurrence solver:** symbolic cost recurrences (`T(n)=2T(n/2)+n`) expanded
  into a tree with per-level cost in `meta`; and auto-generation of a correct
  `steps`/stack/DP fill for a hand-drawn or code-derived tree. Arbitrary
  functions aren't symbolically solvable (halting problem) — those go through
  the tracer.

---

## 7. Build order (v1)

1. **Lock `RecursionTree` schema** (§2) — the contract.
2. **Node model + renderer** — rough.js square nodes, two-arrow edges, 4 zones,
   free placement, colors. Get a hand-drawn static tree on screen.
3. **"Tidy up" layout** — d3-hierarchy → `pos`.
4. **Save/load JSON + PNG/SVG export.**
5. **Stepping engine + controls** — walk `steps`, flip `status`.
6. **Call-stack panel** — replay steps to current `seq`.
7. **DP-table panel** — cells + store/hit arrows.

Steps 1–4 give a usable hand-drawn tree tool. 5–7 add the synced study panels.
The tracer and solver come after, plugging into the same format.
```
