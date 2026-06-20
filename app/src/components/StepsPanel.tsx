import type { RecursionTree, StepEvent } from '../types'
import type { Theme } from '../theme'

interface Props {
  tree: RecursionTree
  currentStep: number
  onStepChange: (n: number) => void
  onAddStep: (step: StepEvent) => void
  onRemoveStep: (seq: number) => void
  theme: Theme
}

export default function StepsPanel({ tree, currentStep, onStepChange, onAddStep, onRemoveStep, theme }: Props) {
  const steps = tree.steps
  const total = steps.length - 1

  const label = (_t: string): React.CSSProperties => ({
    fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1,
  })

  const getLabel = (id: string) => tree.nodes.find(n => n.id === id)?.label || id

  function addStep() {
    const nextSeq = steps.length > 0 ? Math.max(...steps.map(s => s.seq)) + 1 : 0
    const nodeId = tree.nodes[0]?.id
    if (!nodeId) return
    onAddStep({ seq: nextSeq, type: 'call', node: nodeId })
  }

  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, background: theme.panel, fontFamily: 'monospace', fontSize: 13 }}>
      <div style={label('')}>Steps Timeline</div>

      {/* Playback controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        <button onClick={() => onStepChange(0)} style={ctrlBtn(theme)}>⏮</button>
        <button onClick={() => onStepChange(Math.max(0, currentStep - 1))} style={ctrlBtn(theme)}>◀</button>
        <button onClick={() => onStepChange(Math.min(total, currentStep + 1))} style={ctrlBtn(theme)}>▶</button>
        <button onClick={() => onStepChange(total)} style={ctrlBtn(theme)}>⏭</button>
        <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 4 }}>
          {total < 0 ? '–' : `${currentStep} / ${total}`}
        </span>
      </div>
      {total >= 0 && (
        <input
          type="range" min={0} max={total} value={currentStep}
          onChange={e => onStepChange(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 8 }}
        />
      )}

      {/* Step list */}
      <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
        {steps.map((s, i) => (
          <div
            key={s.seq}
            onClick={() => onStepChange(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 6px',
              background: i === currentStep ? theme.node.active.fill : 'transparent',
              border: `1px solid ${i === currentStep ? theme.node.active.stroke : 'transparent'}`,
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 11,
              color: theme.text,
            }}
          >
            <span style={{ color: theme.textMuted, width: 20 }}>#{s.seq}</span>
            <span style={{ color: s.type === 'call' ? theme.edge.call : theme.edge.return }}>
              {s.type === 'call' ? '↓' : '↑'}
            </span>
            <span>{getLabel(s.node)}</span>
            {s.value && <span style={{ color: theme.textMuted }}>= {s.value}</span>}
            <button
              onClick={e => { e.stopPropagation(); onRemoveStep(s.seq) }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: 11 }}
            >✕</button>
          </div>
        ))}
      </div>
      <button onClick={addStep} style={{ ...ctrlBtn(theme), width: '100%', fontSize: 11 }}>+ Add step</button>
    </div>
  )
}

function ctrlBtn(theme: Theme): React.CSSProperties {
  return {
    background: theme.canvas, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 3, padding: '3px 8px',
    cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
  }
}
