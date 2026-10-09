/**
 * Watermark placement geometry.
 *
 * The maths lives here, pure and DOM-free, so the rules for where a mark lands
 * — nine anchors, tiling, rotation, padding — are unit tested. The canvas
 * drawing itself happens in `index.ts`.
 */

export type Anchor = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export const ANCHORS: Anchor[] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

/** A single mark to draw: top-left corner of its unrotated box, plus rotation. */
export interface Placement {
  x: number
  y: number
  rotation: number
}

/** Where the top-left of a mark box sits for a given 3×3 anchor and padding. */
export function anchorPoint(anchor: Anchor, canvasW: number, canvasH: number, markW: number, markH: number, padding: number): { x: number; y: number } {
  const column = ANCHORS.indexOf(anchor) % 3
  const row = Math.floor(ANCHORS.indexOf(anchor) / 3)
  const x = column === 0 ? padding : column === 1 ? (canvasW - markW) / 2 : canvasW - markW - padding
  const y = row === 0 ? padding : row === 1 ? (canvasH - markH) / 2 : canvasH - markH - padding
  return { x, y }
}

function clampInside(value: number, limit: number): number {
  return Math.max(0, Math.min(value, Math.max(0, limit)))
}

export interface PlanInput {
  anchor: Anchor
  tiled: boolean
  rotation: number
  padding: number
  gap: number
  canvasW: number
  canvasH: number
  markW: number
  markH: number
}

/**
 * All the places a mark should be drawn.
 *
 * A single anchor gives one placement; tiling gives a staggered grid that covers
 * the whole canvas, including a bleed of one step on every edge so there are no
 * bare corners once the grid is rotated.
 */
export function planWatermark(input: PlanInput): Placement[] {
  const { anchor, tiled, rotation, padding, gap, canvasW, canvasH, markW, markH } = input
  if (markW <= 0 || markH <= 0 || canvasW <= 0 || canvasH <= 0) return []

  if (!tiled) {
    const point = anchorPoint(anchor, canvasW, canvasH, markW, markH, padding)
    return [{ x: clampInside(point.x, canvasW - markW), y: clampInside(point.y, canvasH - markH), rotation }]
  }

  const stepX = markW + gap
  const stepY = markH + gap
  const placements: Placement[] = []
  let row = 0
  for (let y = -stepY; y < canvasH + stepY; y += stepY, row += 1) {
    const offset = row % 2 === 0 ? 0 : -stepX / 2
    for (let x = -stepX + offset; x < canvasW + stepX; x += stepX) {
      placements.push({ x, y, rotation })
    }
  }
  return placements
}

/** Scale a logo so its width is a percentage of the image width, keeping aspect. */
export function resolveLogoSize(naturalW: number, naturalH: number, widthPercent: number, canvasW: number): { width: number; height: number } {
  const width = (widthPercent / 100) * canvasW
  const height = naturalW > 0 ? (naturalH / naturalW) * width : width
  return { width, height }
}

/** Split watermark text into lines, dropping a trailing empty line. */
export function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** The bounding box of a block of lines drawn at a given font size. */
export function textBlockSize(lineWidths: number[], lineCount: number, fontSize: number, lineHeight = 1.2): { width: number; height: number } {
  const width = lineWidths.reduce((max, value) => Math.max(max, value), 0)
  return { width, height: Math.max(1, lineCount) * fontSize * lineHeight }
}

export interface WatermarkConfig {
  mode: 'text' | 'image'
  text: string
  fontScale: number
  lineHeight: number
  color: string
  opacity: number
  bold: boolean
  italic: boolean
  strokeWidth: number
  strokeColor: string
  logoScale: number
  anchor: Anchor
  tiled: boolean
  rotation: number
  padding: number
  gap: number
}

export const DEFAULT_CONFIG: WatermarkConfig = {
  mode: 'text',
  text: '© toolspace',
  fontScale: 6,
  lineHeight: 1.2,
  color: '#ffffff',
  opacity: 0.55,
  bold: true,
  italic: false,
  strokeWidth: 0,
  strokeColor: '#000000',
  logoScale: 18,
  anchor: 'bottom-right',
  tiled: false,
  rotation: 0,
  padding: 4,
  gap: 6,
}
