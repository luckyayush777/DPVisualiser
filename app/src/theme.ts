export const LIGHT: Theme = {
  bg: '#fafaf7',
  canvas: '#ffffff',
  panel: '#f5f5f0',
  border: '#d4d4aa',
  text: '#1a1a1a',
  textMuted: '#6b6b5a',
  node: {
    called:    { fill: '#f0f0e8', stroke: '#aaaaaa' },
    active:    { fill: '#dbeafe', stroke: '#3b82f6' },
    returning: { fill: '#fef3c7', stroke: '#f59e0b' },
    returned:  { fill: '#dcfce7', stroke: '#22c55e' },
    base:      { fill: '#ffedd5', stroke: '#ea580c' },
    cachehit:  { fill: '#f3e8ff', stroke: '#a855f7' },
  },
  edge: {
    call:   '#3b82f6',
    return: '#22c55e',
    dp:     '#a855f7',
  },
}

export const DARK: Theme = {
  bg: '#141414',
  canvas: '#1c1c1c',
  panel: '#232323',
  border: '#3a3a2a',
  text: '#f0f0e8',
  textMuted: '#8a8a72',
  node: {
    called:    { fill: '#2a2a22', stroke: '#555544' },
    active:    { fill: '#1e3a5f', stroke: '#60a5fa' },
    returning: { fill: '#3d2e00', stroke: '#f59e0b' },
    returned:  { fill: '#14391e', stroke: '#4ade80' },
    base:      { fill: '#431407', stroke: '#fb923c' },
    cachehit:  { fill: '#2e1a4a', stroke: '#c084fc' },
  },
  edge: {
    call:   '#60a5fa',
    return: '#4ade80',
    dp:     '#c084fc',
  },
}

export interface NodeColors { fill: string; stroke: string }
export interface Theme {
  bg: string
  canvas: string
  panel: string
  border: string
  text: string
  textMuted: string
  node: Record<string, NodeColors>
  edge: { call: string; return: string; dp: string }
}
