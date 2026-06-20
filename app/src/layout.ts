import { hierarchy, tree } from 'd3-hierarchy'
import type { RecursionTree, TreeNode, NodePos } from './types'

const H_GAP = 160
const V_GAP = 120
const NODE_W = 160

export function tidyLayout(rtree: RecursionTree): Map<string, NodePos> {
  const posMap = new Map<string, NodePos>()
  const roots = rtree.nodes.filter(n => n.parent === null)
  if (roots.length === 0) return posMap

  // build a d3 hierarchy from the first root (or all roots if forest)
  const childMap = new Map<string | null, TreeNode[]>()
  rtree.nodes.forEach(n => {
    const key = n.parent
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key)!.push(n)
  })
  childMap.forEach(arr => arr.sort((a, b) => a.order - b.order))

  function buildHierarchy(node: TreeNode): { data: TreeNode; children?: ReturnType<typeof buildHierarchy>[] } {
    const children = childMap.get(node.id)
    if (!children || children.length === 0) return { data: node }
    return { data: node, children: children.map(buildHierarchy) }
  }

  let xOffset = 0
  for (const root of roots) {
    const h = hierarchy(buildHierarchy(root), d => d.children)
    const layout = tree<ReturnType<typeof buildHierarchy>>()
      .nodeSize([NODE_W + H_GAP, V_GAP])
      .separation(() => 1)

    layout(h)

    // find min x to shift all nodes right of xOffset
    let minX = Infinity
    h.each(d => { if ((d as any).x < minX) minX = (d as any).x })

    h.each(d => {
      const nodeData = (d as any).data.data as TreeNode
      posMap.set(nodeData.id, {
        x: (d as any).x - minX + xOffset + NODE_W / 2,
        y: (d as any).y + 60,
      })
    })

    // compute width of this tree to offset the next root
    let maxX = -Infinity
    h.each(d => { if ((d as any).x > maxX) maxX = (d as any).x })
    xOffset += maxX - minX + NODE_W + H_GAP * 2
  }

  return posMap
}
