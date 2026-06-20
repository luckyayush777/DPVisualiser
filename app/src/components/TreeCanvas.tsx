import { useEffect, useRef, useCallback, useState } from 'react'
import rough from 'roughjs'
import type { RecursionTree, TreeNode, NodePos } from '../types'
import type { Theme } from '../theme'

const NODE_W = 160
const NODE_H_BASE = 64
const STATE_ROW_H = 28
const ARROW_OFFSET = 10

interface Props {
  tree: RecursionTree
  theme: Theme
  statusOverride?: Map<string, string>
  selectedId: string | null
  onSelectNode: (id: string | null) => void
  onMoveNode: (id: string, pos: NodePos) => void
  onAddNode: (parentId: string | null, pos: NodePos) => void
  onDeleteNode: (id: string) => void
  connectMode: boolean
  onConnect: (fromId: string, toId: string) => void
}

function nodeHeight(node: TreeNode) {
  return node.state_snapshot ? NODE_H_BASE + STATE_ROW_H : NODE_H_BASE
}

export default function TreeCanvas({
  tree,
  theme,
  statusOverride,
  selectedId,
  onSelectNode,
  onMoveNode,
  onAddNode,
  onDeleteNode,
  connectMode,
  onConnect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const getStatus = useCallback(
    (node: TreeNode) => statusOverride?.get(node.id) ?? node.status,
    [statusOverride]
  )

  const nodeAt = useCallback(
    (cx: number, cy: number) => {
      const wx = cx - pan.x
      const wy = cy - pan.y
      return [...tree.nodes].reverse().find(n => {
        const h = nodeHeight(n)
        return wx >= n.pos.x && wx <= n.pos.x + NODE_W && wy >= n.pos.y && wy <= n.pos.y + h
      })
    },
    [tree.nodes, pan]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rc = rough.canvas(canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(pan.x, pan.y)

    // draw edges
    for (const edge of tree.edges) {
      const fromNode = tree.nodes.find(n => n.id === edge.from)
      const toNode = tree.nodes.find(n => n.id === edge.to)
      if (!fromNode || !toNode) continue

      const isCall = edge.kind === 'call'
      const color = isCall ? theme.edge.call : theme.edge.return

      // Determine parent and child regardless of edge direction
      const parentNode = isCall ? fromNode : toNode
      const childNode  = isCall ? toNode  : fromNode
      const ph = nodeHeight(parentNode)

      // Axis: parent-bottom-center → child-top-center
      const axX1 = parentNode.pos.x + NODE_W / 2
      const axY1 = parentNode.pos.y + ph
      const axX2 = childNode.pos.x  + NODE_W / 2
      const axY2 = childNode.pos.y

      // Perpendicular unit vector (CCW 90° of travel direction)
      const dxA = axX2 - axX1
      const dyA = axY2 - axY1
      const len = Math.sqrt(dxA * dxA + dyA * dyA) || 1
      const perpX = (-dyA / len) * ARROW_OFFSET
      const perpY = ( dxA / len) * ARROW_OFFSET

      // Call: left of travel (+perp), Return: right of travel (-perp)
      const sign = isCall ? 1 : -1
      let x1: number, y1: number, x2: number, y2: number

      if (isCall) {
        x1 = axX1 + sign * perpX;  y1 = axY1 + sign * perpY
        x2 = axX2 + sign * perpX;  y2 = axY2 + sign * perpY
      } else {
        // return arrow travels child-top → parent-bottom, opposite side
        x1 = axX2 - sign * perpX;  y1 = axY2 - sign * perpY
        x2 = axX1 - sign * perpX;  y2 = axY1 - sign * perpY
      }

      rc.line(x1, y1, x2, y2, {
        stroke: color,
        strokeWidth: 1.5,
        roughness: 1.2,
        bowing: 0.5,
      })

      // arrowhead
      drawArrowhead(ctx, x1, y1, x2, y2, color)

      // label on return arrow
      if (!isCall && edge.value) {
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        ctx.save()
        ctx.font = '11px monospace'
        ctx.fillStyle = color
        ctx.fillText(edge.value, mx + 4, my)
        ctx.restore()
      }
    }

    // draw nodes
    for (const node of tree.nodes) {
      const status = getStatus(node)
      const colors = theme.node[status] ?? theme.node.called
      const h = nodeHeight(node)
      const isSelected = node.id === selectedId

      rc.rectangle(node.pos.x, node.pos.y, NODE_W, h, {
        fill: colors.fill,
        stroke: isSelected ? '#f97316' : colors.stroke,
        strokeWidth: isSelected ? 2 : 1.5,
        roughness: 1.4,
        fillStyle: 'solid',
      })

      // zone dividers
      const zone2y = node.pos.y + 38
      if (node.state_snapshot) {
        const zone3y = node.pos.y + 38 + STATE_ROW_H
        rc.line(node.pos.x, zone2y, node.pos.x + NODE_W, zone2y, {
          stroke: colors.stroke, strokeWidth: 0.8, roughness: 0.5,
        })
        rc.line(node.pos.x, zone3y, node.pos.x + NODE_W, zone3y, {
          stroke: colors.stroke, strokeWidth: 0.8, roughness: 0.5,
        })
      } else {
        rc.line(node.pos.x, zone2y, node.pos.x + NODE_W, zone2y, {
          stroke: colors.stroke, strokeWidth: 0.8, roughness: 0.5,
        })
      }

      ctx.save()
      ctx.font = 'bold 12px monospace'
      ctx.fillStyle = theme.text

      // zone 1: step_in (top-left) + label (top-right area)
      if (node.step_in !== null) {
        ctx.font = '10px monospace'
        ctx.fillStyle = theme.textMuted
        ctx.fillText(`#${node.step_in}`, node.pos.x + 5, node.pos.y + 14)
      }
      ctx.font = 'bold 12px monospace'
      ctx.fillStyle = theme.text
      const labelX = node.step_in !== null ? node.pos.x + 28 : node.pos.x + 8
      ctx.fillText(truncate(node.label || '(empty)', 14), labelX, node.pos.y + 24)

      // zone 2: state snapshot
      if (node.state_snapshot) {
        ctx.font = '11px monospace'
        ctx.fillStyle = theme.textMuted
        ctx.fillText(truncate(node.state_snapshot, 18), node.pos.x + 8, node.pos.y + 38 + 18)
      }

      // zone 3 (or 2 if no snapshot): return value
      const retY = node.state_snapshot ? node.pos.y + h - 10 : node.pos.y + h - 10
      if (node.ret !== null) {
        ctx.font = '11px monospace'
        ctx.fillStyle = theme.edge.return
        ctx.fillText(`↑ ${node.ret}`, node.pos.x + 8, retY)
      }
      ctx.restore()
    }

    ctx.restore()
  }, [tree, theme, selectedId, statusOverride, getStatus, pan])

  function drawArrowhead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const size = 8
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - size * Math.cos(angle - 0.4), y2 - size * Math.sin(angle - 0.4))
    ctx.lineTo(x2 - size * Math.cos(angle + 0.4), y2 - size * Math.sin(angle + 0.4))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function truncate(s: string, max: number) {
    return s.length > max ? s.slice(0, max) + '…' : s
  }

  // --- interaction ---

  function handleMouseDown(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const node = nodeAt(cx, cy)

    if (connectMode) {
      if (node) {
        if (!connectFrom) {
          setConnectFrom(node.id)
          onSelectNode(node.id)
        } else if (connectFrom !== node.id) {
          onConnect(connectFrom, node.id)
          setConnectFrom(null)
          onSelectNode(null)
        }
      } else {
        setConnectFrom(null)
        onSelectNode(null)
      }
      return
    }

    if (node) {
      onSelectNode(node.id)
      setDrag({ id: node.id, ox: cx - pan.x - node.pos.x, oy: cy - pan.y - node.pos.y })
    } else {
      onSelectNode(null)
      setPanDrag({ startX: cx, startY: cy, panX: pan.x, panY: pan.y })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    if (drag) {
      onMoveNode(drag.id, { x: cx - pan.x - drag.ox, y: cy - pan.y - drag.oy })
    } else if (panDrag) {
      setPan({ x: panDrag.panX + cx - panDrag.startX, y: panDrag.panY + cy - panDrag.startY })
    }
  }

  function handleMouseUp() {
    setDrag(null)
    setPanDrag(null)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (connectMode) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const node = nodeAt(cx, cy)
    if (!node) {
      onAddNode(null, { x: cx - pan.x - NODE_W / 2, y: cy - pan.y - NODE_H_BASE / 2 })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      onDeleteNode(selectedId)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth - 320}
      height={window.innerHeight - 80}
      style={{ background: theme.canvas, cursor: connectMode ? 'crosshair' : 'default', display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    />
  )
}
