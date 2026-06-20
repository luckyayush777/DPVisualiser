import type { TreeNode, NodeStatus, TreeEdge } from '../types'
import type { Theme } from '../theme'

interface Props {
  node: TreeNode
  returnEdge?: TreeEdge
  theme: Theme
  onChange: (patch: Partial<TreeNode>) => void
  onEdgeValueChange: (val: string) => void
  onDelete: () => void
  onAddChild: () => void
}

const STATUSES: NodeStatus[] = ['called', 'active', 'returning', 'returned', 'base', 'cachehit']

export default function NodeEditor({ node, returnEdge, theme, onChange, onEdgeValueChange, onDelete, onAddChild }: Props) {
  const s: React.CSSProperties = {
    padding: '12px',
    borderBottom: `1px solid ${theme.border}`,
    background: theme.panel,
    color: theme.text,
    fontFamily: 'monospace',
    fontSize: '13px',
  }
  const label = (t: string) => (
    <div style={{ color: theme.textMuted, fontSize: '10px', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{t}</div>
  )
  const input = (value: string, onChange: (v: string) => void, placeholder = '') => (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: theme.canvas,
        border: `1px solid ${theme.border}`,
        color: theme.text,
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '4px 6px',
        borderRadius: 3,
        boxSizing: 'border-box',
      }}
    />
  )

  return (
    <div>
      <div style={s}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected node</div>
        <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 8 }}>{node.id}</div>

        {label('Call label fn(args)')}
        {input(node.label, v => onChange({ label: v }), 'foo(2, 3)')}

        <div style={{ marginTop: 8 }}>
          {label('Return value')}
          {input(node.ret ?? '', v => onChange({ ret: v || null }), '5')}
        </div>

        <div style={{ marginTop: 8 }}>
          {label('Return arrow label')}
          {input(returnEdge?.value ?? '', onEdgeValueChange, '5')}
        </div>

        <div style={{ marginTop: 8 }}>
          {label('State snapshot')}
          {input(node.state_snapshot, v => onChange({ state_snapshot: v }), '[Q . . .]')}
        </div>

        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            {label('Step in #')}
            <input
              type="number"
              value={node.step_in ?? ''}
              onChange={e => onChange({ step_in: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="0"
              style={{
                width: '100%', background: theme.canvas, border: `1px solid ${theme.border}`,
                color: theme.text, fontFamily: 'monospace', fontSize: '12px', padding: '4px 6px',
                borderRadius: 3, boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            {label('Step out #')}
            <input
              type="number"
              value={node.step_out ?? ''}
              onChange={e => onChange({ step_out: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="11"
              style={{
                width: '100%', background: theme.canvas, border: `1px solid ${theme.border}`,
                color: theme.text, fontFamily: 'monospace', fontSize: '12px', padding: '4px 6px',
                borderRadius: 3, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          {label('Status')}
          <select
            value={node.status}
            onChange={e => onChange({ status: e.target.value as NodeStatus })}
            style={{
              width: '100%', background: theme.canvas, border: `1px solid ${theme.border}`,
              color: theme.text, fontFamily: 'monospace', fontSize: '12px', padding: '4px 6px',
              borderRadius: 3,
            }}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={onAddChild} style={btnStyle(theme, '#3b82f6')}>+ Child</button>
          <button onClick={onDelete} style={btnStyle(theme, '#ef4444')}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function btnStyle(_theme: Theme, color: string): React.CSSProperties {
  return {
    flex: 1, padding: '5px 0', background: color, color: '#fff',
    border: 'none', borderRadius: 3, cursor: 'pointer',
    fontFamily: 'monospace', fontSize: '12px', fontWeight: 600,
  }
}
