import type { RecursionTree } from '../types'
import type { Theme } from '../theme'

interface Props {
  tree: RecursionTree
  callStack: string[]
  theme: Theme
}

export default function CallStackPanel({ tree, callStack, theme }: Props) {
  const s: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.border}`,
    background: theme.panel,
    color: theme.text,
    fontFamily: 'monospace',
    fontSize: '13px',
  }

  const getLabel = (id: string) => tree.nodes.find(n => n.id === id)?.label || id

  return (
    <div style={s}>
      <div style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Call Stack
      </div>
      {callStack.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: 11 }}>empty</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[...callStack].reverse().map((id, i) => (
            <div
              key={id + i}
              style={{
                padding: '3px 8px',
                background: i === 0 ? theme.node.active.fill : theme.canvas,
                border: `1px solid ${i === 0 ? theme.node.active.stroke : theme.border}`,
                borderRadius: 3,
                fontSize: 11,
                color: theme.text,
              }}
            >
              {i === 0 && <span style={{ color: theme.edge.call, marginRight: 4 }}>▶</span>}
              {getLabel(id)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
