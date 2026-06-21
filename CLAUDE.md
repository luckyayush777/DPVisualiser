# CLAUDE.md — Agent Guide for RecurViz

Read this first on every fresh context. It tells you what the project is, where
code lives, and where to make what change. For deeper specs see
[DESIGN.md](DESIGN.md) (data format + visual spec) and
[FEATURES.md](FEATURES.md) (feature backlog with status).

## What this is

**RecurViz** — a recursion-tree visualizer for studying DSA. You draw recursion
trees (Fibonacci, subset-sum, etc.) on a canvas: call arrows go down (blue),
return arrows go up (green), nodes are color-coded by lifecycle state. There is a
step timeline to "play back" the recursion, a call-stack view, a DP/memo table,
and reference arrays.

Three planned input modes, all producing one shared `RecursionTree` JSON:
1. **Manual GUI editor** — built (this is the whole app today)
2. **Python code tracer** — later, not started
3. **Recurrence-relation solver** — later, not started

Priorities, in order: **learning clarity > aesthetics (hand-drawn rough.js look)
> portability**.

## Stack

React 19 + TypeScript + Vite. Canvas rendering via **rough.js** (hand-drawn
style). Auto-layout via **d3-hierarchy**. No backend — state lives in React +
localStorage. Tests via **Vitest** (pure store functions only — no DOM/canvas).

## Run / check

The app lives in `app/` (NOT the repo root). Always `cd app` first.

```bash
cd app
npm run dev        # dev server → http://localhost:5173
npm run build      # tsc -b && vite build
npx tsc -p tsconfig.app.json --noEmit   # type-check only — RUN THIS after edits
npm test           # vitest run (fast, ~100 ms)
npm run test:watch # vitest watch mode
```

**After any source change: run the type-check AND the tests.** The type-check
catches type errors; the tests catch logic bugs in pure store functions.

## Tests

Tests live at `app/src/store.test.ts` and cover `store.ts` exclusively.
`store.ts` functions are pure `(tree, …) => tree`, so they run in Node with no
browser or DOM required — this makes them fast and reliable.

**What is covered (high ROI):**
- `addNode` — depth, parent, sibling order, call+return edges
- `deleteNode` — subtree removal, edge/step cleanup, non-existent id no-op,
  **cycle safety** (parent-reference cycles no longer infinite-loop)
- `computeStatusAtStep` — full call/return status transitions
- `getCallStackAtStep` — push/pop correctness
- `addStep` / `removeStep` — sort order, targeted removal
- `syncNextId` — prevents ID collisions after loading a saved tree

**What is NOT covered (too DOM/canvas-dependent to unit-test cheaply):**
- Canvas rendering, drag, resize, zoom, pan — test manually
- React component wiring (App.tsx, NodeEditor, etc.) — test manually

When you add a new pure function to `store.ts`, add a corresponding test group
in `store.test.ts`. Keep each test self-contained: call `emptyTree()` to reset
`_nextId` and get a fresh tree, then build the scenario with the store's own
functions.

## Directory map

```
Dynamic/                  repo root (git repo: DPVisualiser on GitHub)
├── CLAUDE.md             this file
├── DESIGN.md            data-format + visual spec (node anatomy, lifecycle, colors)
├── FEATURES.md          feature backlog F-001…F-004 with build status
├── README.md
└── app/                  the actual application
    ├── index.html
    ├── package.json
    ├── tsconfig.app.json strict flags live here (see Gotchas)
    └── src/
        ├── main.tsx      React entry
        ├── App.tsx       ROOT component: state, undo/redo, localStorage, layout, all handlers, sidebar+topbar
        ├── types.ts      ALL TypeScript interfaces. Canonical RecursionTree shape. Zero runtime exports.
        ├── store.ts      ALL pure tree-mutation functions (addNode, updateNode, addArray, stepping engine…)
        ├── store.test.ts unit tests for store.ts (Vitest, Node-only, no DOM)
        ├── theme.ts      LIGHT + DARK theme objects (colors) + Theme interface
        ├── layout.ts     tidyLayout() — d3-hierarchy auto-layout ("Tidy up" button)
        ├── io.ts         saveJSON / loadJSON / exportPNG
        └── components/
            ├── TreeCanvas.tsx    the canvas: rough.js rendering + ALL mouse/drag/resize/inline-edit interaction
            ├── NodeEditor.tsx    sidebar form for the selected node
            ├── StepsPanel.tsx    step timeline + playback controls
            ├── CallStackPanel.tsx call-stack display at current step
            ├── DPPanel.tsx       DP/memo cells + cache hits
            └── ArraysPanel.tsx   reference arrays (the array the DP structure indexes into)
```

## Data model (the one thing to understand)

Everything is a single `RecursionTree` object (defined in `types.ts`). One tree
lives in `App.tsx` state, auto-saved to `localStorage['recurviz-tree']`.

- `nodes: TreeNode[]` — each has `id`, `parent`, `label` (`fn(args)`), `ret`,
  `state_snapshot`, `step_in`/`step_out`, `status`, and `pos` (`{x, y, w?, h?}`).
- `edges: TreeEdge[]` — `call` and `return` edges between node ids. Every
  parent→child link creates BOTH a call and a return edge.
- `steps: StepEvent[]` — ordered call/return events; drive the timeline playback
  and the computed node statuses (`store.ts` → `computeStatusAtStep`).
- `dp: DPData` — `{ enabled, cells, hits, arrays }`. `arrays: VisArray[]` are the
  reference arrays shown in ArraysPanel.

Node lifecycle `status`: `called → active → returning → returned`, plus `base`
and `cachehit`. Colors per status are in `theme.ts` (both LIGHT and DARK). Call
arrow = blue, return arrow = green, dp = purple.

## Where to make what change

| Task | File(s) |
|---|---|
| Add/rename a field on a node, edge, step, dp, array | `types.ts` first, then `store.ts` (mutators), then UI |
| Change how nodes/edges/arrows are drawn | `TreeCanvas.tsx` (the big `useEffect` that renders) |
| Change canvas interaction (drag, resize, click, inline edit, pan) | `TreeCanvas.tsx` (the `handleMouse*` fns + state) |
| Change colors / add a status color | `theme.ts` (update BOTH `LIGHT` and `DARK`) |
| Change the sidebar form for a selected node | `NodeEditor.tsx` |
| Change DP table / cache hits | `DPPanel.tsx` |
| Change reference arrays | `ArraysPanel.tsx` |
| Change step timeline / playback / stepping logic | `StepsPanel.tsx` (UI) + `store.ts` (`computeStatusAtStep`, `getCallStackAtStep`) |
| Add a pure tree operation | `store.ts` (keep it pure: `(tree, …) => tree`), then add a handler in `App.tsx` |
| Add a toolbar button / wire a new handler | `App.tsx` |
| Auto-layout behavior ("Tidy up") | `layout.ts` |
| Save/load/export | `io.ts` |

### Standard wiring pattern for a new tree operation
1. Add/extend the type in `types.ts`.
2. Write a pure function in `store.ts`: `export function foo(tree, args): RecursionTree`.
3. In `App.tsx`, add `const handleFoo = useCallback((args) => commit(t => foo(t, args)), [commit])`.
4. Pass `handleFoo` down to the relevant component as a prop.
5. Type-check.

Use `commit(...)` (not raw `setTree`) for anything that should be **undoable**.
The one exception in the code is node dragging/resizing, which uses raw
`setTree`/`onMoveNode` because it fires too often to record every frame in
history.

## Gotchas (these WILL bite you)

- **`verbatimModuleSyntax: true`** (in `tsconfig.app.json`). `types.ts` has zero
  runtime exports — they are all interfaces/types. You MUST use
  `import type { … }` for anything from `types.ts`, and for the `Theme` interface
  from `theme.ts`. Import the runtime values `LIGHT`/`DARK` normally but split:
  `import { LIGHT, DARK } from './theme'` and
  `import type { Theme } from './theme'`. A plain `import` of a type throws an
  ESM "does not provide an export" error at runtime.
- **`noUnusedLocals` + `noUnusedParameters: true`.** Unused vars/params fail the
  type-check. Prefix intentionally-unused params with `_` (e.g. `_theme`, `_t`).
- **Theme changes go in BOTH `LIGHT` and `DARK`.** Dark mode is the default
  (`darkMode` initial state is `true` in `App.tsx`).
- **localStorage migration.** When you add a field to `DPData`/tree, old saved
  trees in localStorage won't have it. `App.tsx`'s lazy initializer normalizes on
  load (e.g. `if (!loaded.dp.arrays) loaded.dp.arrays = []`). Add a similar guard
  for new required fields.
- **Node size persistence.** `pos.w`/`pos.h` are optional. When moving a node,
  spread the existing `pos` so you don't wipe `w`/`h`
  (`{ ...existing, x, y }`). Helpers `nodeWidth`/`nodeHeight` in `TreeCanvas.tsx`
  fall back to defaults when unset.

## Known rough edges / open issues

- **Diagonal arrow attachment.** Call/return arrows are separated by a
  perpendicular offset (`ARROW_OFFSET`) computed per-edge in `TreeCanvas.tsx`.
  For steep diagonal edges the endpoints can drift off the node's
  top/bottom-center, so an arrow can look like it starts "from nowhere." A
  cleaner approach is to anchor at exact top/bottom-center and separate only
  horizontally. Left as-is per user ("its fine for now") — revisit if asked.

## Conventions

- Styling is inline `React.CSSProperties` pulling colors from the `theme` object.
  No CSS framework. Monospace font everywhere.
- Keep `store.ts` functions pure and immutable (spread, don't mutate). Side
  effects (localStorage, history) live in `App.tsx`.
- Match the surrounding code's terse style; this is a personal study tool, not a
  library.
