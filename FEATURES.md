# RecurViz — Feature Requests

Tracked features not yet built. Each entry has enough detail to implement without
re-asking questions. Ordered by rough priority.

---

## F-001 — Inline node editing (double-click to edit)

**Status:** built  
**Priority:** high

Double-clicking a node on the canvas opens an inline edit mode directly on the
node — no sidebar required.

### Behaviour

- **Trigger:** double-click any node on the canvas.
- **Mode:** the node expands in-place into an editable form, replacing its
  rendered zones with input fields. The rest of the canvas stays visible and
  non-interactive while a node is being edited.
- **Fields exposed (matching the 4 zones):**
  1. Call label `fn(args)` — text input, top zone
  2. State snapshot — text input, middle zone (hidden if empty, clicking the
     zone area reveals it)
  3. Return value — text input, bottom zone
  4. Step in / step out — two small number inputs, corner of the node
- **Confirm:** press **Enter** or click anywhere outside the node to commit.
- **Cancel:** press **Escape** to discard changes and return to rendered view.
- **Sidebar stays in sync:** if the node is also selected (single-click selects,
  double-click selects + enters edit mode), the sidebar fields reflect the same
  values in real time.

### Visual treatment

- The node border changes to the `active` stroke color (blue) to signal edit mode.
- Input fields use the same monospace font, same background as the node fill — so
  it feels like editing text directly on the canvas, not a form overlaid on it.
- Cursor auto-focuses the label field when edit mode opens.

### What it does NOT do

- Does not change the node's position or connect/disconnect edges.
- Does not open for the step-in / step-out fields on a single-click (those remain
  sidebar-only unless you double-click the node, which gives you all fields).

---

## F-002 — Label autocomplete

**Status:** not built  
**Priority:** low (explicitly flagged as overambitious — implement after F-001)

While typing a node label in inline edit mode (or the sidebar), the tool suggests
completions drawn from labels already on the canvas.

### Behaviour

- **Source:** the suggestion pool is every unique label string currently in the
  tree (e.g. if there are 10 nodes labelled `fib(n-1)`, `fib(n-2)`, `fib(3)`
  etc., all distinct labels are candidates).
- **Trigger:** suggestions appear after the user types 2+ characters that match
  the prefix of an existing label.
- **Display:** a small dropdown below the active input field, listing up to 5
  matches ranked by frequency (most-used label first, then alphabetical).
- **Accept:** Tab or arrow-down + Enter picks the top suggestion. Clicking a
  suggestion also accepts it.
- **Dismiss:** Escape or continuing to type past a non-matching prefix hides the
  dropdown.
- **Scope:** label field only (zone 1). State snapshot and return value fields do
  not autocomplete.

### Why frequency ranking matters here

When drawing a Fibonacci tree you'll type `fib(n-1)` many times. Frequency
ranking means after the first few nodes, one or two keystrokes + Tab fills the
label. This is the core value of the feature.

### What it does NOT do

- Does not suggest across saved files — pool is the current canvas only.
- Does not parse the label as code or infer argument patterns (e.g. will not
  auto-increment `fib(3)` to `fib(4)`). Pure string matching only in v1.
- Does not autocomplete in the step timeline or DP table panels.

---

## F-003 — Node resizing

**Status:** built  
**Priority:** medium

Nodes have a fixed size today. This feature lets you resize individual nodes by
dragging a handle, and resize all nodes at once via the select tool (F-004).

### Single-node resize

- **Trigger:** when a node is selected, a small square resize handle appears at
  its bottom-right corner.
- **Drag the handle** to freely resize width and height. Minimum size is clamped
  so the content zones remain readable (roughly 100×50px).
- The four content zones reflow to fit: label zone and return zone scale with
  height; state snapshot zone expands or collapses as vertical space allows.
- `pos.w` and `pos.h` are added to the node's position record in the
  `RecursionTree` format so sizes persist across save/load.
- Arrow attachment points (the top/bottom edge midpoints) update automatically
  to track the new node dimensions.

### What it does NOT do

- Does not maintain aspect ratio — width and height resize independently.
- Does not auto-resize to fit text content (that is a separate potential feature).
- Does not resize connected child nodes.

---

## F-004 — Select tool (multi-select + bulk resize)

**Status:** not built  
**Priority:** medium (pair with F-003)

A dedicated select mode that lets you rubber-band select multiple nodes and apply
a uniform size to all of them at once.

### Modes

The toolbar gains a mode toggle (or keyboard shortcut `S`):

| Mode       | Cursor      | Click behaviour                        |
|------------|-------------|----------------------------------------|
| Default    | default     | single-click selects one node          |
| Select     | crosshair   | drag to draw a selection rectangle     |

### Rubber-band select

- Click and drag on empty canvas → draws a dashed selection rectangle.
- All nodes whose bounding box intersects the rectangle are selected on mouse-up.
- Selected nodes are highlighted with an orange outline (same color as the current
  single-selection highlight).
- Shift-click a node to add/remove it from the current selection without
  clearing the rest.
- Click empty canvas to deselect all.

### Bulk operations on a selection

With multiple nodes selected:

- **Drag any selected node** → moves all selected nodes together, preserving
  their relative positions.
- **Resize handle** → appears as a single handle in the bottom-right of the
  bounding box of the entire selection. Dragging it sets all selected nodes to
  the same width and height (uniform resize). This is the primary use case:
  "make all my fib nodes the same size".
- **Delete** → removes all selected nodes (and their edges/descendants, same
  rules as single-node delete).

### What it does NOT do

- Does not align or distribute nodes (that is a separate layout feature).
- Does not allow resizing individual nodes within a multi-selection independently
  — for that, deselect and resize one at a time via F-003.
