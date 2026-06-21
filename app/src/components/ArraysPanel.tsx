import { useState } from 'react'
import type { RecursionTree, VisArray } from '../types'
import type { Theme } from '../theme'

interface Props {
  tree: RecursionTree
  theme: Theme
  onAddArray: (arr: VisArray) => void
  onRemoveArray: (id: string) => void
  onUpdateArray: (id: string, patch: Partial<VisArray>) => void
}

let _nextArrayId = 0
const newArrayId = () => `arr${_nextArrayId++}`

export default function ArraysPanel({ tree, theme, onAddArray, onRemoveArray, onUpdateArray }: Props) {
  const [newName, setNewName] = useState('')
  const [newValues, setNewValues] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editValues, setEditValues] = useState('')

  const arrays = tree.dp.arrays ?? []

  function handleAdd() {
    if (!newName.trim()) return
    const values = newValues.split(',').map(v => v.trim())
    onAddArray({ id: newArrayId(), name: newName.trim(), values })
    setNewName('')
    setNewValues('')
  }

  function openEdit(arr: VisArray) {
    setEditingId(arr.id)
    setEditName(arr.name)
    setEditValues(arr.values.join(', '))
  }

  function commitEdit() {
    if (!editingId) return
    const values = editValues.split(',').map(v => v.trim())
    onUpdateArray(editingId, { name: editName.trim(), values })
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  const inp: React.CSSProperties = {
    flex: 1, minWidth: 0,
    background: theme.canvas, border: `1px solid ${theme.border}`,
    color: theme.text, fontFamily: 'monospace', fontSize: 11,
    padding: '3px 5px', borderRadius: 3, outline: 'none',
  }

  const btn: React.CSSProperties = {
    background: theme.node.active.stroke, color: '#fff', border: 'none',
    borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
    fontFamily: 'monospace', fontSize: 12,
  }

  const smallBtn: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${theme.border}`,
    color: theme.textMuted, borderRadius: 3, padding: '1px 5px',
    cursor: 'pointer', fontFamily: 'monospace', fontSize: 10,
  }

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: `1px solid ${theme.border}`,
      fontFamily: 'monospace',
      fontSize: 13,
    }}>
      <div style={{
        fontSize: 10, color: theme.textMuted,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
      }}>
        Arrays
      </div>

      {arrays.map(arr => (
        <div key={arr.id} style={{ marginBottom: 10 }}>
          {editingId === arr.id ? (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="name"
                  style={{ ...inp, width: 60, flex: 'none' }}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                />
                <input
                  value={editValues}
                  onChange={e => setEditValues(e.target.value)}
                  placeholder="1, 2, 3, …"
                  style={inp}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={commitEdit} style={btn}>Save</button>
                <button onClick={cancelEdit} style={smallBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: theme.textMuted, fontSize: 11 }}>{arr.name}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => openEdit(arr)} style={smallBtn}>edit</button>
                <button onClick={() => onRemoveArray(arr.id)} style={{ ...smallBtn, color: '#ef4444' }}>×</button>
              </div>
              <ArrayView values={arr.values} theme={theme} />
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: arrays.length > 0 ? 8 : 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="name"
            style={{ ...inp, width: 60, flex: 'none' }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <input
            value={newValues}
            onChange={e => setNewValues(e.target.value)}
            placeholder="1, 2, 3, …"
            style={inp}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <button onClick={handleAdd} style={btn}>+</button>
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted }}>comma-separated values</div>
      </div>
    </div>
  )
}

function ArrayView({ values, theme }: { values: string[]; theme: Theme }) {
  const cellW = Math.max(32, ...values.map(v => v.length * 8 + 12))

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
      <div style={{ display: 'inline-flex', gap: 2 }}>
        {values.map((v, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: cellW,
              padding: '4px 2px',
              textAlign: 'center',
              background: theme.node.called.fill,
              border: `1.5px solid ${theme.node.called.stroke}`,
              borderRadius: 3,
              fontSize: 12,
              color: theme.text,
              fontWeight: 600,
              fontFamily: 'monospace',
            }}>
              {v || '·'}
            </div>
            <div style={{
              fontSize: 9,
              color: theme.textMuted,
              fontFamily: 'monospace',
              marginTop: 2,
            }}>
              {i}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
