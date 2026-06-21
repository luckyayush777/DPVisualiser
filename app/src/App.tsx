import { useState, useCallback, useEffect, useRef } from 'react'
import TreeCanvas from './components/TreeCanvas'
import NodeEditor from './components/NodeEditor'
import CallStackPanel from './components/CallStackPanel'
import StepsPanel from './components/StepsPanel'
import DPPanel from './components/DPPanel'
import ArraysPanel from './components/ArraysPanel'
import type { RecursionTree, TreeNode, NodePos, StepEvent, DPCell, DPHit, VisArray } from './types'
import { LIGHT, DARK } from './theme'
import type { Theme } from './theme'
import {
  emptyTree, addNode, updateNode, moveNode, deleteNode,
  addStep, removeStep, addDPCell, addDPHit,
  addArray, removeArray, updateArray,
  computeStatusAtStep, getCallStackAtStep, updateEdge, syncNextId,
} from './store'
import { tidyLayout } from './layout'
import { saveJSON, loadJSON, exportPNG } from './io'

export default function App() {
  const [tree, setTree] = useState<RecursionTree>(() => {
    try {
      const saved = localStorage.getItem('recurviz-tree')
      if (!saved) return emptyTree()
      const loaded = JSON.parse(saved) as RecursionTree
      if (!loaded.dp.arrays) loaded.dp.arrays = []
      syncNextId(loaded)
      return loaded
    } catch {
      return emptyTree()
    }
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [connectMode, setConnectMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const past = useRef<RecursionTree[]>([])
  const future = useRef<RecursionTree[]>([])

  // Use inside setTree updater so we always see latest state
  const commit = useCallback((fn: (t: RecursionTree) => RecursionTree) => {
    setTree(current => {
      past.current = [...past.current.slice(-49), current]
      future.current = []
      return fn(current)
    })
  }, [])

  const undo = useCallback(() => {
    setTree(current => {
      if (past.current.length === 0) return current
      const prev = past.current[past.current.length - 1]
      past.current = past.current.slice(0, -1)
      future.current = [current, ...future.current.slice(0, 49)]
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    setTree(current => {
      if (future.current.length === 0) return current
      const next = future.current[0]
      future.current = future.current.slice(1)
      past.current = [...past.current.slice(-49), current]
      return next
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('recurviz-tree', JSON.stringify(tree))
  }, [tree])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const theme: Theme = darkMode ? DARK : LIGHT

  const selectedNode = tree.nodes.find(n => n.id === selectedId) ?? null
  const returnEdge = selectedNode
    ? tree.edges.find(e => e.from === selectedId && e.kind === 'return')
    : undefined

  const statusOverride = tree.steps.length > 0
    ? computeStatusAtStep(tree, currentStep)
    : undefined
  const callStack = getCallStackAtStep(tree, currentStep)

  const handleAddNode = useCallback((parentId: string | null, pos: NodePos) => {
    commit(t => addNode(t, parentId, pos))
  }, [commit])

  const handleMoveNode = useCallback((id: string, pos: NodePos) => {
    setTree(t => moveNode(t, id, pos))
  }, [])

  const handleUpdateNode = useCallback((patch: Partial<TreeNode>) => {
    if (!selectedId) return
    commit(t => updateNode(t, selectedId, patch))
  }, [selectedId, commit])

  const handleUpdateNodeById = useCallback((id: string, patch: Partial<TreeNode>) => {
    commit(t => updateNode(t, id, patch))
  }, [commit])

  const handleAddArray = useCallback((arr: VisArray) => {
    commit(t => addArray(t, arr))
  }, [commit])

  const handleRemoveArray = useCallback((id: string) => {
    commit(t => removeArray(t, id))
  }, [commit])

  const handleUpdateArray = useCallback((id: string, patch: Partial<VisArray>) => {
    commit(t => updateArray(t, id, patch))
  }, [commit])

  const handleEdgeValueChange = useCallback((val: string) => {
    if (!selectedId) return
    const re = tree.edges.find(e => e.from === selectedId && e.kind === 'return')
    if (!re) return
    commit(t => updateEdge(t, re.from, re.to, 'return', { value: val }))
  }, [selectedId, tree.edges, commit])

  const handleDeleteNode = useCallback((id: string) => {
    commit(t => deleteNode(t, id))
    setSelectedId(null)
  }, [commit])

  const handleConnect = useCallback((fromId: string, toId: string) => {
    commit(t => {
      const updated = updateNode(t, toId, { parent: fromId })
      const callEdge = { from: fromId, to: toId, kind: 'call' as const, seq: t.steps.length }
      const retEdge = { from: toId, to: fromId, kind: 'return' as const, seq: t.steps.length + 1 }
      const filtered = updated.edges.filter(e =>
        !(e.from === fromId && e.to === toId) && !(e.from === toId && e.to === fromId)
      )
      return { ...updated, edges: [...filtered, callEdge, retEdge] }
    })
    setConnectMode(false)
  }, [commit])

  const handleAddChild = useCallback(() => {
    if (!selectedId) return
    const parent = tree.nodes.find(n => n.id === selectedId)!
    const pos: NodePos = { x: parent.pos.x + 40, y: parent.pos.y + 140 }
    commit(t => addNode(t, selectedId, pos))
  }, [selectedId, tree.nodes, commit])

  const handleTidyUp = useCallback(() => {
    const posMap = tidyLayout(tree)
    commit(t => ({
      ...t,
      nodes: t.nodes.map(n => {
        if (!posMap.has(n.id)) return n
        const { x, y } = posMap.get(n.id)!
        return { ...n, pos: { ...n.pos, x, y } }
      }),
    }))
  }, [tree, commit])

  const handleLoad = useCallback(async () => {
    try {
      const loaded = await loadJSON()
      setTree(loaded)
      setSelectedId(null)
      setCurrentStep(0)
    } catch { /* cancelled */ }
  }, [])

  const sidebarStyle: React.CSSProperties = {
    width: 260,
    minWidth: 260,
    height: '100vh',
    overflowY: 'auto',
    background: theme.panel,
    borderLeft: `1px solid ${theme.border}`,
    display: 'flex',
    flexDirection: 'column',
  }

  const topbarStyle: React.CSSProperties = {
    height: 44,
    background: theme.panel,
    borderBottom: `1px solid ${theme.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 8,
    fontFamily: 'monospace',
    fontSize: 13,
    color: theme.text,
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: theme.bg }}>
      <div style={topbarStyle}>
        <span style={{ fontWeight: 700, marginRight: 4 }}>RecurViz</span>
        <input
          value={tree.meta.title}
          onChange={e => commit(t => ({ ...t, meta: { ...t.meta, title: e.target.value } }))}
          placeholder="Untitled"
          style={{
            background: 'transparent', border: 'none', borderBottom: `1px solid ${theme.border}`,
            color: theme.text, fontFamily: 'monospace', fontSize: 13, width: 160, outline: 'none',
          }}
        />
        <div style={{ flex: 1 }} />
        <Btn theme={theme} onClick={undo}>⌫ Undo</Btn>
        <Btn theme={theme} onClick={redo}>Redo ⌦</Btn>
        <Btn theme={theme} onClick={handleTidyUp}>Tidy up</Btn>
        <Btn theme={theme} active={connectMode} onClick={() => setConnectMode(v => !v)}>
          {connectMode ? 'Cancel' : 'Connect'}
        </Btn>
        <Btn theme={theme} onClick={() => handleAddNode(null, { x: 200, y: 60 })}>+ Root</Btn>
        <Btn theme={theme} onClick={() => saveJSON(tree)}>Save</Btn>
        <Btn theme={theme} onClick={handleLoad}>Load</Btn>
        <Btn theme={theme} onClick={() => {
          const c = document.querySelector('canvas') as HTMLCanvasElement
          if (c) exportPNG(c, tree.meta.title)
        }}>PNG</Btn>
        <Btn theme={theme} onClick={() => setDarkMode(v => !v)}>{darkMode ? 'Light' : 'Dark'}</Btn>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TreeCanvas
            tree={tree}
            theme={theme}
            statusOverride={statusOverride}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
            onMoveNode={handleMoveNode}
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onUpdateNode={handleUpdateNodeById}
            connectMode={connectMode}
            onConnect={handleConnect}
          />
        </div>

        <div style={sidebarStyle}>
          {selectedNode ? (
            <NodeEditor
              node={selectedNode}
              returnEdge={returnEdge}
              theme={theme}
              onChange={handleUpdateNode}
              onEdgeValueChange={handleEdgeValueChange}
              onDelete={() => handleDeleteNode(selectedId!)}
              onAddChild={handleAddChild}
            />
          ) : (
            <div style={{ padding: 12, color: theme.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: theme.text, marginBottom: 8 }}>RecurViz</div>
              <div>Double-click canvas → add node</div>
              <div>Click node → select &amp; edit</div>
              <div>Drag node → reposition</div>
              <div>Connect → link parent to child</div>
              <div>Delete/Backspace → remove node</div>
              <div style={{ marginTop: 8 }}>Drag empty canvas → pan</div>
            </div>
          )}

          <StepsPanel
            tree={tree}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onAddStep={(s: StepEvent) => commit(t => addStep(t, s))}
            onRemoveStep={(seq: number) => commit(t => removeStep(t, seq))}
            theme={theme}
          />

          <CallStackPanel tree={tree} callStack={callStack} theme={theme} />

          <ArraysPanel
            tree={tree}
            theme={theme}
            onAddArray={handleAddArray}
            onRemoveArray={handleRemoveArray}
            onUpdateArray={handleUpdateArray}
          />

          <DPPanel
            tree={tree}
            theme={theme}
            onAddCell={(cell: DPCell) => commit(t => addDPCell(t, cell))}
            onAddHit={(hit: DPHit) => commit(t => addDPHit(t, hit))}
          />

          <div style={{ padding: '10px 12px', marginTop: 'auto', fontFamily: 'monospace', fontSize: 10, color: theme.textMuted }}>
            <div style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Legend</div>
            {Object.entries(theme.node).map(([status, colors]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={{ width: 12, height: 12, background: colors.fill, border: `1.5px solid ${colors.stroke}`, borderRadius: 2 }} />
                <span>{status}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
              <span style={{ color: theme.edge.call }}>↓ call</span>
              <span style={{ color: theme.edge.return }}>↑ return</span>
              <span style={{ color: theme.edge.dp }}>⊡ dp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Btn({ children, onClick, theme, active }: {
  children: React.ReactNode; onClick: () => void; theme: Theme; active?: boolean
}) {
  return (
    <button onClick={onClick} style={{
      background: active ? theme.edge.call : theme.canvas,
      border: `1px solid ${active ? theme.edge.call : theme.border}`,
      color: active ? '#fff' : theme.text,
      borderRadius: 3, padding: '4px 8px',
      cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}
