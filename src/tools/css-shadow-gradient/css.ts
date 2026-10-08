/** Build box-shadow and linear/radial gradient CSS declarations. */

export interface ShadowLayer {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  inset: boolean
}

export function shadowLayerCss(layer: ShadowLayer): string {
  const parts = [layer.inset ? 'inset' : '', `${layer.x}px`, `${layer.y}px`, `${layer.blur}px`, `${layer.spread}px`, layer.color]
    .filter(Boolean)
  return parts.join(' ')
}

export function boxShadowCss(layers: ShadowLayer[]): string {
  if (layers.length === 0) return 'none'
  return layers.map(shadowLayerCss).join(', ')
}

export interface GradientStop {
  color: string
  position: number
}

export type GradientType = 'linear' | 'radial'

export interface GradientOptions {
  type: GradientType
  angle: number
  stops: GradientStop[]
}

export function gradientCss(options: GradientOptions): string {
  const stops = [...options.stops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(', ')

  if (options.type === 'radial') return `radial-gradient(circle, ${stops})`
  return `linear-gradient(${options.angle}deg, ${stops})`
}

export function ruleFor(selector: string, declarations: Record<string, string>): string {
  const body = Object.entries(declarations)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

/** Parse a #rgb/#rrggbb colour into 0–255 parts; null when unparseable. */
export function parseHex(input: string): { r: number; g: number; b: number } | null {
  const hex = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
  }
  return null
}

export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return '#' + [r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')
}

export function randomHex(random: () => number = Math.random): string {
  return toHex({ r: random() * 255, g: random() * 255, b: random() * 255 })
}
