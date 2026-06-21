import type { RecursionTree, TreeNode, TreeEdge, StepEvent, DPCell, DPHit, VisArray, NodePos } from './types'

let _nextId = 0
export const newId = () => `n${_nextId++}`

// Call after loading a saved tree so new node IDs don't collide with existing ones.
export function syncNextId(tree: RecursionTree) {
  for (const n of tree.nodes) {
    const num = parseInt(n.id.replace(/^n/, ''), 10)
    if (!isNaN(num) && num >= _nextId) _nextId = num + 1
  }
}

export function emptyTree(): RecursionTree {
  _nextId = 0
  return {
    version: '1',
    meta: { title: 'Untitled', source: 'gui', createdAt: new Date().toISOString() },
    nodes: [],
    edges: [],
    steps: [],
    dp: { enabled: false, cells: [], hits: [], arrays: [] },
  }
}

// ---- node ops ----------------------------------------------------------------

export function addNode(tree: RecursionTree, parentId: string | null, pos: NodePos): RecursionTree {
  const id = newId()
  const parent = parentId ? tree.nodes.find(n => n.id === parentId) ?? null : null
  const siblings = tree.nodes.filter(n => n.parent === parentId)
  const node: TreeNode = {
    id,
    parent: parentId,
    label: '',
    ret: null,
    state_snapshot: '',
    step_in: null,
    step_out: null,
    depth: parent ? parent.depth + 1 : 0,
    order: siblings.length,
    status: 'called',
    pos,
    meta: {},
  }
  const edges: TreeEdge[] = parentId
    ? [
        ...tree.edges,
        { from: parentId, to: id, kind: 'call', seq: tree.steps.length },
        { from: id, to: parentId, kind: 'return', seq: tree.steps.length + 1 },
      ]
    : tree.edges
  return { ...tree, nodes: [...tree.nodes, node], edges }
}

export function updateNode(tree: RecursionTree, id: string, patch: Partial<TreeNode>): RecursionTree {
  return { ...tree, nodes: tree.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) }
}

export function moveNode(tree: RecursionTree, id: string, pos: NodePos): RecursionTree {
  return updateNode(tree, id, { pos })
}

export function deleteNode(tree: RecursionTree, id: string): RecursionTree {
  const descendants = collectDescendants(tree, id)
  const toRemove = new Set([id, ...descendants])
  return {
    ...tree,
    nodes: tree.nodes.filter(n => !toRemove.has(n.id)),
    edges: tree.edges.filter(e => !toRemove.has(e.from) && !toRemove.has(e.to)),
    steps: tree.steps.filter(s => !toRemove.has(s.node)),
  }
}

function collectDescendants(tree: RecursionTree, id: string, visited = new Set<string>()): string[] {
  if (visited.has(id)) return []
  visited.add(id)
  const children = tree.nodes.filter(n => n.parent === id).map(n => n.id)
  return children.flatMap(c => [c, ...collectDescendants(tree, c, visited)])
}

// ---- edge ops ----------------------------------------------------------------

export function updateEdge(
  tree: RecursionTree,
  from: string,
  to: string,
  kind: 'call' | 'return',
  patch: Partial<TreeEdge>
): RecursionTree {
  return {
    ...tree,
    edges: tree.edges.map(e =>
      e.from === from && e.to === to && e.kind === kind ? { ...e, ...patch } : e
    ),
  }
}

// ---- step ops ----------------------------------------------------------------

export function addStep(tree: RecursionTree, step: StepEvent): RecursionTree {
  const steps = [...tree.steps, step].sort((a, b) => a.seq - b.seq)
  return { ...tree, steps }
}

export function removeStep(tree: RecursionTree, seq: number): RecursionTree {
  return { ...tree, steps: tree.steps.filter(s => s.seq !== seq) }
}

// ---- dp ops ------------------------------------------------------------------

export function addArray(tree: RecursionTree, arr: VisArray): RecursionTree {
  return { ...tree, dp: { ...tree.dp, arrays: [...(tree.dp.arrays ?? []), arr] } }
}

export function removeArray(tree: RecursionTree, id: string): RecursionTree {
  return { ...tree, dp: { ...tree.dp, arrays: (tree.dp.arrays ?? []).filter(a => a.id !== id) } }
}

export function updateArray(tree: RecursionTree, id: string, patch: Partial<VisArray>): RecursionTree {
  return {
    ...tree,
    dp: {
      ...tree.dp,
      arrays: (tree.dp.arrays ?? []).map(a => a.id === id ? { ...a, ...patch } : a),
    },
  }
}

export function addDPCell(tree: RecursionTree, cell: DPCell): RecursionTree {
  return { ...tree, dp: { ...tree.dp, enabled: true, cells: [...tree.dp.cells, cell] } }
}

export function addDPHit(tree: RecursionTree, hit: DPHit): RecursionTree {
  return { ...tree, dp: { ...tree.dp, hits: [...tree.dp.hits, hit] } }
}

// ---- stepping engine --------------------------------------------------------

export function computeStatusAtStep(tree: RecursionTree, stepIdx: number): Map<string, string> {
  const statusMap = new Map<string, string>()
  tree.nodes.forEach(n => statusMap.set(n.id, 'called'))

  const stack: string[] = []
  const steps = tree.steps.slice(0, stepIdx + 1)

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    const isLast = i === steps.length - 1
    if (s.type === 'call') {
      if (isLast) {
        stack.forEach(id => statusMap.set(id, 'active'))
        statusMap.set(s.node, 'active')
      } else {
        stack.push(s.node)
        statusMap.set(s.node, 'active')
      }
    } else {
      stack.pop()
      if (isLast) {
        statusMap.set(s.node, 'returning')
      } else {
        statusMap.set(s.node, 'returned')
      }
    }
  }

  // override with original base/cachehit if not yet touched
  tree.nodes.forEach(n => {
    if (!steps.find(s => s.node === n.id) && (n.status === 'base' || n.status === 'cachehit')) {
      // keep as 'called' until stepped to
    }
  })

  return statusMap
}

export function getCallStackAtStep(tree: RecursionTree, stepIdx: number): string[] {
  const stack: string[] = []
  const steps = tree.steps.slice(0, stepIdx + 1)
  for (const s of steps) {
    if (s.type === 'call') stack.push(s.node)
    else stack.pop()
  }
  return stack
}
