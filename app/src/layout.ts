import { hierarchy, tree } from 'd3-hierarchy'
import type { RecursionTree, TreeNode, NodePos } from './types'

const H_GAP = 160
const V_GAP = 80      // gap between bottom of one level and top of the next
const NODE_W = 160
const NODE_H_BASE = 64
const STATE_ROW_H = 28

function nodeH(node: TreeNode): number {
  if (node.pos.h !== undefined) return node.pos.h
  return node.state_snapshot ? NODE_H_BASE + STATE_ROW_H : NODE_H_BASE
}

export function tidyLayout(rtree: RecursionTree): Map<string, NodePos> {
  const posMap = new Map<string, NodePos>()
  const roots = rtree.nodes.filter(n => n.parent === null)
  if (roots.length === 0) return posMap

  const childMap = new Map<string | null, TreeNode[]>()
  rtree.nodes.forEach(n => {
    const key = n.parent
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key)!.push(n)
  })
  childMap.forEach(arr => arr.sort((a, b) => a.order - b.order))

  // Recompute depth from actual parent-child structure.
  // node.depth is not reliable when nodes are connected via the Connect tool
  // (handleConnect sets parent but does not update depth).
  const computedDepth = new Map<string, number>()
  function assignDepth(nodeId: string, d: number) {
    computedDepth.set(nodeId, d)
    const children = childMap.get(nodeId) ?? []
    children.forEach(c => assignDepth(c.id, d + 1))
  }
  roots.forEach(r => assignDepth(r.id, 0))
  // Nodes unreachable from any root (disconnected) default to 0
  rtree.nodes.forEach(n => { if (!computedDepth.has(n.id)) computedDepth.set(n.id, 0) })

  const maxDepth = Math.max(0, ...rtree.nodes.map(n => computedDepth.get(n.id)!))

  // Y per level: tallest node at each level + V_GAP between levels
  const levelMaxH: number[] = []
  for (let d = 0; d <= maxDepth; d++) {
    const atDepth = rtree.nodes.filter(n => computedDepth.get(n.id) === d)
    levelMaxH[d] = atDepth.length > 0 ? Math.max(...atDepth.map(nodeH)) : NODE_H_BASE
  }
  const levelY: number[] = [60]
  for (let d = 1; d <= maxDepth; d++) {
    levelY[d] = levelY[d - 1] + levelMaxH[d - 1] + V_GAP
  }

  // Horizontal spacing uses widest node so no overlap after resizing
  const maxNodeW = Math.max(NODE_W, ...rtree.nodes.map(n => n.pos.w ?? NODE_W))

  function buildHierarchy(node: TreeNode): { data: TreeNode; children?: ReturnType<typeof buildHierarchy>[] } {
    const children = childMap.get(node.id)
    if (!children || children.length === 0) return { data: node }
    return { data: node, children: children.map(buildHierarchy) }
  }

  let xOffset = 0
  for (const root of roots) {
    const h = hierarchy(buildHierarchy(root), d => d.children)
    // y=1 because we supply Y ourselves; x spacing uses maxNodeW
    const layout = tree<ReturnType<typeof buildHierarchy>>()
      .nodeSize([maxNodeW + H_GAP, 1])
      .separation(() => 1)

    layout(h)

    let minX = Infinity
    h.each(d => { if ((d as any).x < minX) minX = (d as any).x })

    h.each(d => {
      const nodeData = (d as any).data.data as TreeNode
      const depth = computedDepth.get(nodeData.id) ?? 0
      posMap.set(nodeData.id, {
        x: (d as any).x - minX + xOffset + NODE_W / 2,
        y: levelY[depth] ?? 60,
      })
    })

    let maxX = -Infinity
    h.each(d => { if ((d as any).x > maxX) maxX = (d as any).x })
    xOffset += maxX - minX + maxNodeW + H_GAP * 2
  }

  return posMap
}
