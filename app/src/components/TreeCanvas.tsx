import { useEffect, useRef, useCallback, useState } from 'react'
import rough from 'roughjs'
import type { RecursionTree, TreeNode, NodePos } from '../types'
import type { Theme } from '../theme'

const NODE_W = 160
const NODE_H_BASE = 64
const STATE_ROW_H = 28
const ARROW_OFFSET = 16
const HANDLE_SIZE = 10
const MIN_W = 100
const MIN_H = 50

interface Props {
  tree: RecursionTree
  theme: Theme
  statusOverride?: Map<string, string>
  selectedId: string | null
  onSelectNode: (id: string | null) => void
  onMoveNode: (id: string, pos: NodePos) => void
  onAddNode: (parentId: string | null, pos: NodePos) => void
  onDeleteNode: (id: string) => void
  onUpdateNode: (id: string, patch: Partial<TreeNode>) => void
  connectMode: boolean
  onConnect: (fromId: string, toId: string) => void
}

interface Draft {
  label: string
  state_snapshot: string
  ret: string
  step_in: string
  step_out: string
}

interface ResizeDrag {
  id: string
  startCx: number
  startCy: number
  startW: number
  startH: number
}

function nodeWidth(node: TreeNode) {
  return node.pos.w ?? NODE_W
}

function nodeHeight(node: TreeNode) {
  if (node.pos.h !== undefined) return node.pos.h
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
  onUpdateNode,
  connectMode,
  onConnect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [resizeDrag, setResizeDrag] = useState<ResizeDrag | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ label: '', state_snapshot: '', ret: '', step_in: '', step_out: '' })

  const getStatus = useCallback(
    (node: TreeNode) => statusOverride?.get(node.id) ?? node.status,
    [statusOverride]
  )

  const nodeAt = useCallback(
    (cx: number, cy: number) => {
      const wx = (cx - pan.x) / scale
      const wy = (cy - pan.y) / scale
      return [...tree.nodes].reverse().find(n => {
        const nw = nodeWidth(n)
        const nh = nodeHeight(n)
        return wx >= n.pos.x && wx <= n.pos.x + nw && wy >= n.pos.y && wy <= n.pos.y + nh
      })
    },
    [tree.nodes, pan, scale]
  )

  // Returns true if (cx,cy) canvas coords are over the resize handle of the selected node
  const onResizeHandle = useCallback(
    (cx: number, cy: number) => {
      if (!selectedId) return false
      const node = tree.nodes.find(n => n.id === selectedId)
      if (!node) return false
      const wx = (cx - pan.x) / scale
      const wy = (cy - pan.y) / scale
      const nw = nodeWidth(node)
      const nh = nodeHeight(node)
      const hx = node.pos.x + nw - HANDLE_SIZE
      const hy = node.pos.y + nh - HANDLE_SIZE
      return wx >= hx && wx <= node.pos.x + nw + 2 && wy >= hy && wy <= node.pos.y + nh + 2
    },
    [selectedId, tree.nodes, pan, scale]
  )

  useEffect(() => {
    if (editingId) labelInputRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        // Pinch-to-zoom on macOS trackpad (ctrlKey is set by the OS for pinch)
        const rect = canvas.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
        setScale(prev => {
          const next = Math.min(5, Math.max(0.1, prev * factor))
          const actualFactor = next / prev
          setPan(p => ({ x: cx - (cx - p.x) * actualFactor, y: cy - (cy - p.y) * actualFactor }))
          return next
        })
      } else {
        // Two-finger scroll → pan
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rc = rough.canvas(canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(scale, scale)

    // draw edges
    for (const edge of tree.edges) {
      const fromNode = tree.nodes.find(n => n.id === edge.from)
      const toNode = tree.nodes.find(n => n.id === edge.to)
      if (!fromNode || !toNode) continue

      const isCall = edge.kind === 'call'
      const color = isCall ? theme.edge.call : theme.edge.return

      const parentNode = isCall ? fromNode : toNode
      const childNode  = isCall ? toNode  : fromNode
      const pnw = nodeWidth(parentNode)
      const ph  = nodeHeight(parentNode)

      const axX1 = parentNode.pos.x + pnw / 2
      const axY1 = parentNode.pos.y + ph
      const axX2 = childNode.pos.x  + nodeWidth(childNode) / 2
      const axY2 = childNode.pos.y

      const dxA = axX2 - axX1
      const dyA = axY2 - axY1
      const len = Math.sqrt(dxA * dxA + dyA * dyA) || 1
      const perpX = (-dyA / len) * ARROW_OFFSET
      const perpY = ( dxA / len) * ARROW_OFFSET

      let x1: number, y1: number, x2: number, y2: number

      if (isCall) {
        // call: parent-bottom → child-top, offset to +perp side
        x1 = axX1 + perpX;  y1 = axY1 + perpY
        x2 = axX2 + perpX;  y2 = axY2 + perpY
      } else {
        // return: child-top → parent-bottom, offset to -perp side (opposite)
        x1 = axX2 - perpX;  y1 = axY2 - perpY
        x2 = axX1 - perpX;  y2 = axY1 - perpY
      }

      rc.line(x1, y1, x2, y2, {
        stroke: color,
        strokeWidth: 1.5,
        roughness: 0.8,
        bowing: 0,
      })

      drawArrowhead(ctx, x1, y1, x2, y2, color)

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
      const nw = nodeWidth(node)
      const nh = nodeHeight(node)
      const isSelected = node.id === selectedId
      const isEditing = node.id === editingId

      rc.rectangle(node.pos.x, node.pos.y, nw, nh, {
        fill: colors.fill,
        stroke: isEditing ? theme.node.active.stroke : isSelected ? '#f97316' : colors.stroke,
        strokeWidth: isSelected || isEditing ? 2 : 1.5,
        roughness: 1.4,
        fillStyle: 'solid',
      })

      const zone2y = node.pos.y + 38
      if (node.state_snapshot) {
        const zone3y = node.pos.y + 38 + STATE_ROW_H
        rc.line(node.pos.x, zone2y, node.pos.x + nw, zone2y, {
          stroke: colors.stroke, strokeWidth: 0.8, roughness: 0.5,
        })
        rc.line(node.pos.x, zone3y, node.pos.x + nw, zone3y, {
          stroke: colors.stroke, strokeWidth: 0.8, roughness: 0.5,
        })
      } else {
        rc.line(node.pos.x, zone2y, node.pos.x + nw, zone2y, {
          stroke: colors.stroke, strokeWidth: 0.8, roughness: 0.5,
        })
      }

      if (!isEditing) {
        ctx.save()
        ctx.font = 'bold 12px monospace'
        ctx.fillStyle = theme.text

        if (node.step_in !== null) {
          ctx.font = '10px monospace'
          ctx.fillStyle = theme.textMuted
          ctx.fillText(`#${node.step_in}`, node.pos.x + 5, node.pos.y + 14)
        }
        ctx.font = 'bold 12px monospace'
        ctx.fillStyle = theme.text
        const labelX = node.step_in !== null ? node.pos.x + 28 : node.pos.x + 8
        const maxChars = Math.max(6, Math.floor(nw / 8) - 2)
        ctx.fillText(truncate(node.label || '(empty)', maxChars), labelX, node.pos.y + 24)

        if (node.state_snapshot) {
          ctx.font = '11px monospace'
          ctx.fillStyle = theme.textMuted
          ctx.fillText(truncate(node.state_snapshot, Math.max(6, Math.floor(nw / 7) - 1)), node.pos.x + 8, node.pos.y + 38 + 18)
        }

        if (node.ret !== null) {
          ctx.font = '11px monospace'
          ctx.fillStyle = theme.edge.return
          ctx.fillText(`↑ ${node.ret}`, node.pos.x + 8, node.pos.y + nh - 10)
        }
        ctx.restore()
      }
    }

    // draw resize handles (on top of all nodes, crisp)
    for (const node of tree.nodes) {
      if (node.id !== selectedId) continue
      const nw = nodeWidth(node)
      const nh = nodeHeight(node)
      const hx = node.pos.x + nw - HANDLE_SIZE
      const hy = node.pos.y + nh - HANDLE_SIZE
      ctx.save()
      ctx.fillStyle = theme.node.active.stroke
      ctx.strokeStyle = theme.canvas
      ctx.lineWidth = 1.5
      ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE)
      ctx.strokeRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE)
      ctx.restore()
    }

    ctx.restore()
  }, [tree, theme, selectedId, editingId, statusOverride, getStatus, pan, scale])

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

  function openEdit(node: TreeNode) {
    onSelectNode(node.id)
    setEditingId(node.id)
    setDraft({
      label: node.label,
      state_snapshot: node.state_snapshot,
      ret: node.ret ?? '',
      step_in: node.step_in !== null ? String(node.step_in) : '',
      step_out: node.step_out !== null ? String(node.step_out) : '',
    })
  }

  function commitEdit() {
    if (!editingId) return
    onUpdateNode(editingId, {
      label: draft.label,
      state_snapshot: draft.state_snapshot,
      ret: draft.ret || null,
      step_in: draft.step_in !== '' ? Number(draft.step_in) : null,
      step_out: draft.step_out !== '' ? Number(draft.step_out) : null,
    })
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleOverlayKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
  }

  // --- interaction ---

  function handleMouseDown(e: React.MouseEvent) {
    if (editingId) {
      commitEdit()
      return
    }

    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // Check resize handle first (only for selected node)
    if (onResizeHandle(cx, cy)) {
      const node = tree.nodes.find(n => n.id === selectedId)!
      setResizeDrag({
        id: selectedId!,
        startCx: cx,
        startCy: cy,
        startW: nodeWidth(node),
        startH: nodeHeight(node),
      })
      return
    }

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
      setDrag({ id: node.id, ox: (cx - pan.x) / scale - node.pos.x, oy: (cy - pan.y) / scale - node.pos.y })
    } else {
      onSelectNode(null)
      setPanDrag({ startX: cx, startY: cy, panX: pan.x, panY: pan.y })
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    if (resizeDrag) {
      const node = tree.nodes.find(n => n.id === resizeDrag.id)
      if (!node) return
      const newW = Math.max(MIN_W, resizeDrag.startW + (cx - resizeDrag.startCx) / scale)
      const newH = Math.max(MIN_H, resizeDrag.startH + (cy - resizeDrag.startCy) / scale)
      onMoveNode(resizeDrag.id, { ...node.pos, w: newW, h: newH })
      return
    }

    if (drag) {
      const existing = tree.nodes.find(n => n.id === drag.id)?.pos ?? {}
      onMoveNode(drag.id, { ...existing, x: (cx - pan.x) / scale - drag.ox, y: (cy - pan.y) / scale - drag.oy })
    } else if (panDrag) {
      setPan({ x: panDrag.panX + cx - panDrag.startX, y: panDrag.panY + cy - panDrag.startY })
    }
  }

  function handleMouseUp() {
    setDrag(null)
    setResizeDrag(null)
    setPanDrag(null)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (connectMode) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const node = nodeAt(cx, cy)
    if (node) {
      openEdit(node)
    } else {
      onAddNode(null, { x: (cx - pan.x) / scale - NODE_W / 2, y: (cy - pan.y) / scale - NODE_H_BASE / 2 })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      onDeleteNode(selectedId)
    }
  }

  const editNode = editingId ? tree.nodes.find(n => n.id === editingId) ?? null : null
  const editColors = editNode ? (theme.node[getStatus(editNode)] ?? theme.node.called) : null

  const inputBase: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: theme.text,
    fontFamily: 'monospace',
    fontSize: 12,
    width: '100%',
    padding: 0,
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={window.innerWidth - 320}
        height={window.innerHeight - 80}
        style={{
          background: theme.canvas,
          cursor: resizeDrag ? 'se-resize' : connectMode ? 'crosshair' : 'default',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      />

      {editNode && editColors && (
        <div
          style={{
            position: 'absolute',
            left: editNode.pos.x * scale + pan.x,
            top: editNode.pos.y * scale + pan.y,
            width: nodeWidth(editNode) * scale,
            background: editColors.fill,
            border: `2px solid ${theme.node.active.stroke}`,
            borderRadius: 3,
            fontFamily: 'monospace',
            fontSize: 12,
            zIndex: 10,
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
          onKeyDown={handleOverlayKeyDown}
        >
          {/* Zone 1: step_in / step_out + label */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 5px', gap: 3 }}>
            <input
              type="number"
              value={draft.step_in}
              onChange={e => setDraft(d => ({ ...d, step_in: e.target.value }))}
              placeholder="#in"
              style={{ ...inputBase, width: 30, color: theme.textMuted, fontSize: 10 }}
            />
            <input
              type="number"
              value={draft.step_out}
              onChange={e => setDraft(d => ({ ...d, step_out: e.target.value }))}
              placeholder="#out"
              style={{ ...inputBase, width: 30, color: theme.textMuted, fontSize: 10 }}
            />
            <input
              ref={labelInputRef}
              value={draft.label}
              onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
              placeholder="fn(args)"
              style={{ ...inputBase, flex: 1, fontWeight: 'bold' }}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: editColors.stroke, opacity: 0.4, margin: '0 4px' }} />

          {/* Zone 2: state snapshot */}
          <div style={{ padding: '4px 5px' }}>
            <input
              value={draft.state_snapshot}
              onChange={e => setDraft(d => ({ ...d, state_snapshot: e.target.value }))}
              placeholder="state snapshot…"
              style={{ ...inputBase, color: theme.textMuted }}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: editColors.stroke, opacity: 0.4, margin: '0 4px' }} />

          {/* Zone 3: return value */}
          <div style={{ padding: '4px 5px' }}>
            <input
              value={draft.ret}
              onChange={e => setDraft(d => ({ ...d, ret: e.target.value }))}
              placeholder="↑ return value"
              style={{ ...inputBase, color: theme.edge.return }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
