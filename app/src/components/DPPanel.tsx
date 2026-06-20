import { useState } from 'react'
import type { RecursionTree, DPCell, DPHit } from '../types'
import type { Theme } from '../theme'

interface Props {
  tree: RecursionTree
  theme: Theme
  onAddCell: (cell: DPCell) => void
  onAddHit: (hit: DPHit) => void
}

export default function DPPanel({ tree, theme, onAddCell, onAddHit }: Props) {
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [newWrittenBy, setNewWrittenBy] = useState('')
  const [hitNode, setHitNode] = useState('')
  const [hitKey, setHitKey] = useState('')

  const dp = tree.dp
  if (!dp.enabled && dp.cells.length === 0) {
    return (
      <div style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: theme.textMuted }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>DP Table</div>
        <div style={{ fontSize: 11 }}>No DP data. Add cells below.</div>
        <AddCellForm theme={theme} newKey={newKey} newVal={newVal} newWrittenBy={newWrittenBy}
          setNewKey={setNewKey} setNewVal={setNewVal} setNewWrittenBy={setNewWrittenBy}
          onAdd={() => {
            if (!newKey) return
            onAddCell({ key: newKey, value: newVal, written_by: newWrittenBy, written_seq: tree.steps.length })
            setNewKey(''); setNewVal(''); setNewWrittenBy('')
          }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, background: theme.panel, fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>DP Table</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
        {dp.cells.map(cell => {
          const isHit = dp.hits.some(h => h.cell_key === cell.key)
          return (
            <div key={cell.key} style={{
              padding: '4px 8px',
              background: isHit ? theme.node.cachehit.fill : theme.node.returned.fill,
              border: `1px ${isHit ? 'dashed' : 'solid'} ${isHit ? theme.edge.dp : theme.node.returned.stroke}`,
              borderRadius: 3,
              fontSize: 11,
              color: theme.text,
            }}>
              <div style={{ color: theme.textMuted, fontSize: 10 }}>{cell.key}</div>
              <div style={{ fontWeight: 700 }}>{cell.value}</div>
              {isHit && <div style={{ fontSize: 9, color: theme.edge.dp }}>cache hit</div>}
            </div>
          )
        })}
      </div>

      <AddCellForm theme={theme} newKey={newKey} newVal={newVal} newWrittenBy={newWrittenBy}
        setNewKey={setNewKey} setNewVal={setNewVal} setNewWrittenBy={setNewWrittenBy}
        onAdd={() => {
          if (!newKey) return
          onAddCell({ key: newKey, value: newVal, written_by: newWrittenBy, written_seq: tree.steps.length })
          setNewKey(''); setNewVal(''); setNewWrittenBy('')
        }} />

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Add hit</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input placeholder="node id" value={hitNode} onChange={e => setHitNode(e.target.value)} style={inp(theme)} />
          <input placeholder="key" value={hitKey} onChange={e => setHitKey(e.target.value)} style={inp(theme)} />
          <button onClick={() => {
            if (!hitNode || !hitKey) return
            onAddHit({ node: hitNode, cell_key: hitKey, seq: tree.steps.length })
            setHitNode(''); setHitKey('')
          }} style={btn(theme)}>+</button>
        </div>
      </div>
    </div>
  )
}

function AddCellForm({ theme, newKey, newVal, newWrittenBy, setNewKey, setNewVal, setNewWrittenBy, onAdd }: {
  theme: Theme; newKey: string; newVal: string; newWrittenBy: string;
  setNewKey: (v: string) => void; setNewVal: (v: string) => void; setNewWrittenBy: (v: string) => void;
  onAdd: () => void
}) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Add cell</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input placeholder="key" value={newKey} onChange={e => setNewKey(e.target.value)} style={inp(theme)} />
        <input placeholder="val" value={newVal} onChange={e => setNewVal(e.target.value)} style={inp(theme)} />
        <input placeholder="by (node)" value={newWrittenBy} onChange={e => setNewWrittenBy(e.target.value)} style={inp(theme)} />
        <button onClick={onAdd} style={btn(theme)}>+</button>
      </div>
    </div>
  )
}

const inp = (theme: Theme): React.CSSProperties => ({
  flex: 1, minWidth: 0, background: theme.canvas, border: `1px solid ${theme.border}`,
  color: theme.text, fontFamily: 'monospace', fontSize: 11, padding: '3px 5px', borderRadius: 3,
})
const btn = (theme: Theme): React.CSSProperties => ({
  background: theme.edge.dp, color: '#fff', border: 'none',
  borderRadius: 3, padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
})
