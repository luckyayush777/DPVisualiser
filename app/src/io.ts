import type { RecursionTree } from './types'

export function saveJSON(tree: RecursionTree) {
  const blob = new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tree.meta.title.replace(/\s+/g, '_') || 'tree'}.rtree.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function loadJSON(): Promise<RecursionTree> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file'))
      const reader = new FileReader()
      reader.onload = e => {
        try {
          resolve(JSON.parse(e.target!.result as string))
        } catch {
          reject(new Error('Invalid JSON'))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  })
}

export function exportPNG(canvas: HTMLCanvasElement, title: string) {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/\s+/g, '_') || 'tree'}.png`
  a.click()
}

export function exportSVG(_canvas: HTMLCanvasElement, _title: string) {
  alert('SVG export: use the PNG export for now — SVG from canvas requires a separate serializer.')
}
