export type NodeStatus = 'called' | 'active' | 'returning' | 'returned' | 'base' | 'cachehit'

export interface NodePos {
  x: number
  y: number
  w?: number
  h?: number
}

export interface TreeNode {
  id: string
  parent: string | null
  label: string
  ret: string | null
  state_snapshot: string
  step_in: number | null
  step_out: number | null
  depth: number
  order: number
  status: NodeStatus
  pos: NodePos
  meta: Record<string, unknown>
}

export type EdgeKind = 'call' | 'return'

export interface TreeEdge {
  from: string
  to: string
  kind: EdgeKind
  seq: number
  value?: string
}

export type StepType = 'call' | 'return'

export interface StepEvent {
  seq: number
  type: StepType
  node: string
  value?: string
}

export interface DPCell {
  key: string
  value: string
  written_by: string
  written_seq: number
}

export interface DPHit {
  node: string
  cell_key: string
  seq: number
}

export interface VisArray {
  id: string
  name: string
  values: string[]
}

export interface DPData {
  enabled: boolean
  cells: DPCell[]
  hits: DPHit[]
  arrays: VisArray[]
}

export interface TreeMeta {
  title: string
  source: 'gui' | 'tracer' | 'solver'
  function?: string
  createdAt: string
}

export interface RecursionTree {
  version: '1'
  meta: TreeMeta
  nodes: TreeNode[]
  edges: TreeEdge[]
  steps: StepEvent[]
  dp: DPData
}
