import { describe, it, expect, beforeEach } from 'vitest'
import type { RecursionTree, TreeNode } from './types'
import {
  emptyTree, newId, addNode, updateNode, deleteNode,
  addStep, removeStep, computeStatusAtStep, getCallStackAtStep, syncNextId,
} from './store'

// Constructs a minimal TreeNode without going through addNode,
// useful for injecting arbitrary IDs into trees.
function makeNode(id: string): TreeNode {
  return {
    id, parent: null, label: '', ret: null, state_snapshot: '',
    step_in: null, step_out: null, depth: 0, order: 0, status: 'called',
    pos: { x: 0, y: 0 }, meta: {},
  }
}

// Builds a RecursionTree literal without calling emptyTree() so _nextId is not reset.
function blankTree(nodes: TreeNode[] = []): RecursionTree {
  return {
    version: '1',
    meta: { title: '', source: 'gui', createdAt: '' },
    nodes,
    edges: [],
    steps: [],
    dp: { enabled: false, cells: [], hits: [], arrays: [] },
  }
}

describe('store', () => {
  // Reset _nextId before every test so node IDs are predictable.
  beforeEach(() => { emptyTree() })

  // ── addNode ──────────────────────────────────────────────────────────────

  describe('addNode', () => {
    it('creates a root: depth 0, null parent, no edges', () => {
      const t = addNode(emptyTree(), null, { x: 0, y: 0 })
      expect(t.nodes).toHaveLength(1)
      expect(t.nodes[0].parent).toBeNull()
      expect(t.nodes[0].depth).toBe(0)
      expect(t.nodes[0].order).toBe(0)
      expect(t.edges).toHaveLength(0)
    })

    it('creates a child: depth 1, correct parent, call + return edges', () => {
      let t = addNode(emptyTree(), null, { x: 0, y: 0 })
      const rootId = t.nodes[0].id
      t = addNode(t, rootId, { x: 0, y: 100 })
      const child = t.nodes[1]
      expect(child.parent).toBe(rootId)
      expect(child.depth).toBe(1)
      expect(t.edges).toHaveLength(2)
      expect(t.edges.find(e => e.kind === 'call' && e.from === rootId && e.to === child.id)).toBeTruthy()
      expect(t.edges.find(e => e.kind === 'return' && e.from === child.id && e.to === rootId)).toBeTruthy()
    })

    it('assigns sequential order to siblings', () => {
      let t = addNode(emptyTree(), null, { x: 0, y: 0 })
      const rootId = t.nodes[0].id
      t = addNode(t, rootId, { x: 0, y: 100 })
      t = addNode(t, rootId, { x: 100, y: 100 })
      expect(t.nodes[1].order).toBe(0)
      expect(t.nodes[2].order).toBe(1)
    })
  })

  // ── deleteNode ────────────────────────────────────────────────────────────

  describe('deleteNode', () => {
    let t: RecursionTree
    let rootId: string
    let childId: string
    let grandchildId: string

    beforeEach(() => {
      t = emptyTree()
      t = addNode(t, null, { x: 0, y: 0 })
      rootId = t.nodes[0].id
      t = addNode(t, rootId, { x: 0, y: 100 })
      childId = t.nodes[1].id
      t = addNode(t, childId, { x: 0, y: 200 })
      grandchildId = t.nodes[2].id
    })

    it('removes the target and all its descendants', () => {
      expect(deleteNode(t, rootId).nodes).toHaveLength(0)
    })

    it('only removes the deleted subtree, leaves sibling branches', () => {
      t = addNode(t, rootId, { x: 100, y: 100 })
      const siblingId = t.nodes[3].id
      const result = deleteNode(t, childId)
      expect(result.nodes.map(n => n.id).sort()).toEqual([rootId, siblingId].sort())
    })

    it('removes all edges connected to deleted nodes', () => {
      const result = deleteNode(t, childId)
      const removed = new Set([childId, grandchildId])
      expect(result.edges.every(e => !removed.has(e.from) && !removed.has(e.to))).toBe(true)
    })

    it('removes steps that reference deleted nodes', () => {
      t = addStep(t, { seq: 0, type: 'call', node: rootId })
      t = addStep(t, { seq: 1, type: 'call', node: childId })
      const result = deleteNode(t, childId)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].node).toBe(rootId)
    })

    it('is a no-op for a non-existent id', () => {
      const result = deleteNode(t, 'ghost')
      expect(result.nodes).toHaveLength(t.nodes.length)
      expect(result.edges).toHaveLength(t.edges.length)
    })

    it('does not throw when parent refs form a cycle', () => {
      // Create A→B→A: root.parent = child, child.parent = root
      t = updateNode(t, rootId, { parent: childId })
      expect(() => deleteNode(t, rootId)).not.toThrow()
    })

    it('removes all nodes involved in a parent cycle', () => {
      t = updateNode(t, rootId, { parent: childId })
      const result = deleteNode(t, rootId)
      expect(result.nodes.find(n => n.id === rootId)).toBeUndefined()
      expect(result.nodes.find(n => n.id === childId)).toBeUndefined()
    })
  })

  // ── computeStatusAtStep ───────────────────────────────────────────────────

  describe('computeStatusAtStep', () => {
    let t: RecursionTree
    let aId: string
    let bId: string

    beforeEach(() => {
      t = emptyTree()
      t = addNode(t, null, { x: 0, y: 0 })
      aId = t.nodes[0].id
      t = addNode(t, aId, { x: 0, y: 100 })
      bId = t.nodes[1].id
      // Sequence: call A → call B → return B → return A
      t = addStep(t, { seq: 0, type: 'call', node: aId })
      t = addStep(t, { seq: 1, type: 'call', node: bId })
      t = addStep(t, { seq: 2, type: 'return', node: bId })
      t = addStep(t, { seq: 3, type: 'return', node: aId })
    })

    it('step 0 (call A): A active, B still called', () => {
      const m = computeStatusAtStep(t, 0)
      expect(m.get(aId)).toBe('active')
      expect(m.get(bId)).toBe('called')
    })

    it('step 1 (call B): both A and B active', () => {
      const m = computeStatusAtStep(t, 1)
      expect(m.get(aId)).toBe('active')
      expect(m.get(bId)).toBe('active')
    })

    it('step 2 (return B): B returning, A still active', () => {
      const m = computeStatusAtStep(t, 2)
      expect(m.get(aId)).toBe('active')
      expect(m.get(bId)).toBe('returning')
    })

    it('step 3 (return A): A returning, B returned', () => {
      const m = computeStatusAtStep(t, 3)
      expect(m.get(aId)).toBe('returning')
      expect(m.get(bId)).toBe('returned')
    })

    it('stepIdx beyond last step gives same result as the last step', () => {
      expect(computeStatusAtStep(t, 99)).toEqual(computeStatusAtStep(t, 3))
    })
  })

  // ── getCallStackAtStep ────────────────────────────────────────────────────

  describe('getCallStackAtStep', () => {
    let t: RecursionTree
    let aId: string
    let bId: string

    beforeEach(() => {
      t = emptyTree()
      t = addNode(t, null, { x: 0, y: 0 })
      aId = t.nodes[0].id
      t = addNode(t, aId, { x: 0, y: 100 })
      bId = t.nodes[1].id
      t = addStep(t, { seq: 0, type: 'call', node: aId })
      t = addStep(t, { seq: 1, type: 'call', node: bId })
      t = addStep(t, { seq: 2, type: 'return', node: bId })
      t = addStep(t, { seq: 3, type: 'return', node: aId })
    })

    it('is empty before any steps (stepIdx -1)', () => {
      expect(getCallStackAtStep(t, -1)).toEqual([])
    })

    it('[A] after step 0', () => {
      expect(getCallStackAtStep(t, 0)).toEqual([aId])
    })

    it('[A, B] after step 1', () => {
      expect(getCallStackAtStep(t, 1)).toEqual([aId, bId])
    })

    it('B is popped on return at step 2', () => {
      expect(getCallStackAtStep(t, 2)).toEqual([aId])
    })

    it('empty after all returns', () => {
      expect(getCallStackAtStep(t, 3)).toEqual([])
    })
  })

  // ── addStep / removeStep ──────────────────────────────────────────────────

  describe('addStep / removeStep', () => {
    it('addStep keeps steps sorted by seq regardless of insertion order', () => {
      let t = addNode(emptyTree(), null, { x: 0, y: 0 })
      const id = t.nodes[0].id
      t = addStep(t, { seq: 5, type: 'call', node: id })
      t = addStep(t, { seq: 2, type: 'return', node: id })
      t = addStep(t, { seq: 8, type: 'call', node: id })
      expect(t.steps.map(s => s.seq)).toEqual([2, 5, 8])
    })

    it('removeStep deletes only the step with the matching seq', () => {
      let t = addNode(emptyTree(), null, { x: 0, y: 0 })
      const id = t.nodes[0].id
      t = addStep(t, { seq: 0, type: 'call', node: id })
      t = addStep(t, { seq: 1, type: 'return', node: id })
      t = removeStep(t, 0)
      expect(t.steps).toHaveLength(1)
      expect(t.steps[0].seq).toBe(1)
    })
  })

  // ── syncNextId ────────────────────────────────────────────────────────────

  describe('syncNextId', () => {
    it('advances _nextId past the highest node ID in the loaded tree', () => {
      // blankTree() is a plain object literal — does NOT call emptyTree() so _nextId stays 0
      const loaded = blankTree([makeNode('n7'), makeNode('n3')])
      syncNextId(loaded)
      expect(newId()).toBe('n8')
    })

    it('leaves _nextId unchanged when all existing IDs are below the current counter', () => {
      syncNextId(blankTree()) // no nodes → no change
      expect(newId()).toBe('n0')
    })
  })
})
