/**
 * Chart geometry.
 *
 * Pure maths and string building — no DOM, so every layout decision is unit
 * testable. The renderer emits SVG built from numbers, and any text is escaped,
 * so nothing a user pastes can become markup.
 */

export const PALETTE = ['#5b8def', '#f2707a', '#3ddc97', '#e6b450', '#b07cf0', '#2ec5d3', '#ef8f5a', '#8fb339']

export type ChartType = 'line' | 'bar' | 'area' | 'scatter' | 'pie'

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'area', label: 'Area' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'pie', label: 'Pie' },
]

export interface Row {
  label: string
  value: number
}

export interface Series {
  name: string
  values: (number | null)[]
}

export interface Dataset {
  categories: string[]
  series: Series[]
}

/** A single parsed table, used to draw the column-picker preview. */
export interface ParsedTable {
  header: string[]
  rows: string[][]
}

export interface ChartOptions {
  type: ChartType
  title: string
  showLegend: boolean
  showGrid: boolean
}

/**
 * Split one line on a delimiter, honouring double quotes.
 *
 * A quoted cell may contain the delimiter or an escaped `""`. An unclosed quote
 * swallows the rest of the line rather than throwing — the forgiving behaviour a
 * paste-anything tool needs.
 */
export function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}

/** The delimiter that appears most often outside of quotes on the first line. */
export function sniffDelimiter(text: string): string {
  const firstLine = text.split('\n').find((line) => line.trim()) ?? ''
  const counts = [',', '\t', ';', '|'].map((delimiter) => ({ delimiter, count: splitLine(firstLine, delimiter).length - 1 }))
  counts.sort((a, b) => b.count - a.count)
  return counts[0].count > 0 ? counts[0].delimiter : ','
}

/** Turn a JSON array of objects (or arrays) into a grid, or null if it is not one. */
function gridFromJson(text: string): ParsedTable | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null
  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    return null
  }
  const array = Array.isArray(data) ? data : [data]
  if (array.length === 0) return { header: [], rows: [] }
  const first = array[0]
  if (Array.isArray(first)) {
    const [header, ...rest] = array as unknown[][]
    return { header: header.map(String), rows: rest.map((row) => row.map(String)) }
  }
  if (first && typeof first === 'object') {
    const header = Object.keys(first as Record<string, unknown>)
    const rows = (array as Record<string, unknown>[]).map((item) => header.map((key) => (item[key] == null ? '' : String(item[key]))))
    return { header, rows }
  }
  return null
}

/** Parse CSV-ish text into a header and rows, dropping blank lines. */
export function parseGrid(text: string, delimiter?: string): ParsedTable {
  const json = gridFromJson(text)
  if (json) return json
  const delim = delimiter ?? sniffDelimiter(text)
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim() !== '')
  if (lines.length === 0) return { header: [], rows: [] }
  const [first, ...rest] = lines
  return { header: splitLine(first, delim).map((cell) => cell.trim()), rows: rest.map((line) => splitLine(line, delim).map((cell) => cell.trim())) }
}

function toNumber(cell: string | undefined): number | null {
  if (cell == null || cell.trim() === '') return null
  const value = Number(cell.replace(/[%,$\s]/g, ''))
  return Number.isFinite(value) ? value : null
}

/** How each column behaves, so the UI can default the row/column pickers. */
export interface GridHints {
  /** The first column that is not mostly numeric — a good default category axis. */
  categoryIndex: number
  /** Indices of columns that are mostly numeric — good default series. */
  numericIndices: number[]
  /** True when the first row looks like titles rather than data. */
  hasHeader: boolean
}

export function analyzeGrid(table: ParsedTable): GridHints {
  const { header, rows } = table
  const columns = Math.max(header.length, ...rows.map((row) => row.length), 0)
  const numericIndices: number[] = []
  for (let c = 0; c < columns; c += 1) {
    let numeric = 0
    let filled = 0
    for (const row of rows) {
      const cell = row[c]
      if (cell == null || cell === '') continue
      filled += 1
      if (toNumber(cell) !== null) numeric += 1
    }
    if (filled > 0 && numeric / filled >= 0.6) numericIndices.push(c)
  }
  let categoryIndex = -1
  for (let c = 0; c < columns; c += 1) {
    if (!numericIndices.includes(c)) {
      categoryIndex = c
      break
    }
  }
  const hasHeader = header.some((cell) => cell !== '' && toNumber(cell) === null)
  return { categoryIndex: categoryIndex === -1 ? 0 : categoryIndex, numericIndices, hasHeader }
}

export interface BuildOptions {
  categoryIndex: number
  valueIndices: number[]
  hasHeader: boolean
}

/** Turn a parsed grid plus column choices into a dataset ready to render. */
export function buildDataset(table: ParsedTable, options: BuildOptions): Dataset {
  const { categoryIndex, valueIndices, hasHeader } = options
  const body = hasHeader ? table.rows : [table.header, ...table.rows]
  const header = hasHeader ? table.header : table.header.map((_, index) => `Column ${index + 1}`)
  const categories = body.map((row, index) => row[categoryIndex]?.trim() || String(index + 1))
  const series: Series[] = valueIndices.map((columnIndex) => ({
    name: header[columnIndex]?.trim() || `Series ${columnIndex + 1}`,
    values: body.map((row) => toNumber(row[columnIndex])),
  }))
  return { categories, series }
}

export interface Geometry {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
  plotWidth: number
  plotHeight: number
}

export function geometry(width = 720, height = 420): Geometry {
  const left = 54
  const right = 20
  const top = 18
  const bottom = 46
  return { width, height, left, right, top, bottom, plotWidth: width - left - right, plotHeight: height - top - bottom }
}

/** Round a maximum up to a friendly tick value (1, 2, 2.5 or 5 × 10ⁿ). */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const magnitude = 10 ** exponent
  const fraction = value / magnitude
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return step * magnitude
}

/** Round a minimum down to a friendly value. */
export function niceFloor(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? -niceCeil(-value) : 0
}

export interface Scale {
  min: number
  max: number
  ticks: number[]
  /** Map a data value to a y pixel (SVG coordinates, origin at the top). */
  y(value: number): number
}

export function makeScale(values: number[], geo: Geometry, tickCount = 5): Scale {
  let min = 0
  let max = 0
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  if (min === 0 && max === 0) max = 1
  const max2 = niceCeil(max)
  const min2 = niceFloor(min)
  const ticks: number[] = []
  for (let i = 0; i <= tickCount; i += 1) ticks.push(min2 + ((max2 - min2) * i) / tickCount)
  const span = max2 - min2 || 1
  return {
    min: min2,
    max: max2,
    ticks,
    y: (value: number) => geo.top + geo.plotHeight - ((value - min2) / span) * geo.plotHeight,
  }
}

/** The x centre of each category slot, plus the slot width. */
export function bandPositions(count: number, geo: Geometry): { positions: number[]; band: number } {
  const band = count > 0 ? geo.plotWidth / count : geo.plotWidth
  return { positions: Array.from({ length: count }, (_, index) => geo.left + band * (index + 0.5)), band }
}

/** The path and centroid of each pie slice. */
export function pieSlices(rows: Row[], cx: number, cy: number, radius: number): { path: string; midAngle: number; row: Row; fraction: number }[] {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0)
  if (total <= 0) return []
  let angle = -Math.PI / 2
  return rows.map((row) => {
    const fraction = Math.max(0, row.value) / total
    const sweep = fraction * Math.PI * 2
    const start = angle
    const end = angle + sweep
    angle = end
    const x1 = cx + radius * Math.cos(start)
    const y1 = cy + radius * Math.sin(start)
    const x2 = cx + radius * Math.cos(end)
    const y2 = cy + radius * Math.sin(end)
    const large = sweep > Math.PI ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
    return { path, midAngle: start + sweep / 2, row, fraction }
  })
}

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape text before it goes into SVG, since SVG is XML. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char])
}

function cleanNumbers(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value))
}

/** Trim a long axis label so it does not run into its neighbours. */
function labelFor(text: string, max = 12): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatTick(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/**
 * Render a dataset to an SVG string.
 *
 * Every dynamic value is a number, and every label is escaped, so the result is
 * safe to assign to `innerHTML`.
 */
export function renderChart(dataset: Dataset, options: ChartOptions): string {
  const { categories, series } = dataset
  if (series.length === 0 || categories.length === 0) return ''
  const geo = geometry()

  if (options.type === 'pie') {
    const rows: Row[] = categories.map((label, index) => ({ label, value: cleanNumbers([series[0].values[index] ?? null])[0] ?? 0 }))
    return renderPie(rows, options, geo)
  }

  const usable = series.filter((s) => s.values.some((value) => value !== null))
  if (usable.length === 0) return ''
  const scale = makeScale(usable.flatMap((s) => cleanNumbers(s.values)), geo)
  const { positions, band } = bandPositions(categories.length, geo)
  const plotBottom = geo.top + geo.plotHeight
  const zero = scale.y(0)

  const parts: string[] = []
  if (options.showGrid) {
    parts.push(`<g class="ts-chart-grid">${scale.ticks.map((tick) => `<line x1="${geo.left}" y1="${scale.y(tick).toFixed(1)}" x2="${geo.width - geo.right}" y2="${scale.y(tick).toFixed(1)}" />`).join('')}</g>`)
    parts.push(`<g class="ts-chart-ylabels">${scale.ticks.map((tick) => `<text x="${geo.left - 8}" y="${(scale.y(tick) + 4).toFixed(1)}" text-anchor="end">${formatTick(tick)}</text>`).join('')}</g>`)
  }
  parts.push(`<line class="ts-chart-axis" x1="${geo.left}" y1="${geo.top}" x2="${geo.left}" y2="${plotBottom}" />`)
  parts.push(`<line class="ts-chart-axis" x1="${geo.left}" y1="${plotBottom}" x2="${geo.width - geo.right}" y2="${plotBottom}" />`)

  const labelEvery = categories.length > 18 ? Math.ceil(categories.length / 12) : 1
  if (options.type !== 'bar') {
    parts.push(`<g class="ts-chart-xlabels">${categories
      .map((label, index) => (index % labelEvery === 0 ? `<text x="${positions[index].toFixed(1)}" y="${plotBottom + 18}" text-anchor="middle">${escapeXml(labelFor(label))}</text>` : ''))
      .join('')}</g>`)
  } else {
    parts.push(`<g class="ts-chart-xlabels">${categories
      .map((label, index) => (index % labelEvery === 0 ? `<text x="${positions[index].toFixed(1)}" y="${plotBottom + 18}" text-anchor="middle">${escapeXml(labelFor(label))}</text>` : ''))
      .join('')}</g>`)
  }

  const seriesEls: string[] = []
  usable.forEach((s, sIndex) => {
    const color = PALETTE[sIndex % PALETTE.length]
    if (options.type === 'bar') {
      const groupWidth = band * 0.68
      const barWidth = groupWidth / usable.length
      const bars = s.values
        .map((value, index) => {
          if (value === null) return ''
          const x = positions[index] - groupWidth / 2 + sIndex * barWidth
          const y = Math.min(scale.y(value), zero)
          const height = Math.abs(scale.y(value) - zero)
          return `<rect class="ts-chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, barWidth - 2).toFixed(1)}" height="${height.toFixed(1)}" rx="3" fill="${color}" />`
        })
        .join('')
      seriesEls.push(`<g class="ts-chart-series">${bars}</g>`)
      return
    }
    const points = s.values
      .map((value, index) => (value === null ? null : `${positions[index].toFixed(1)},${scale.y(value).toFixed(1)}`))
      .filter((point): point is string => point !== null)
    if (points.length === 0) return
    if (options.type === 'area') {
      const firstIndex = s.values.findIndex((v) => v !== null)
      const lastIndex = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null)
      seriesEls.push(`<path class="ts-chart-area" d="M ${points.join(' L ')} L ${positions[lastIndex].toFixed(1)},${zero.toFixed(1)} L ${positions[firstIndex].toFixed(1)},${zero.toFixed(1)} Z" fill="${color}" />`)
      seriesEls.push(`<polyline class="ts-chart-line" points="${points.join(' ')}" fill="none" stroke="${color}" />`)
    } else if (options.type === 'scatter') {
      const dots = s.values
        .map((value, index) => (value === null ? '' : `<circle class="ts-chart-dot" cx="${positions[index].toFixed(1)}" cy="${scale.y(value).toFixed(1)}" r="3.6" fill="${color}" />`))
        .join('')
      seriesEls.push(`<g class="ts-chart-series">${dots}</g>`)
    } else {
      seriesEls.push(`<polyline class="ts-chart-line" points="${points.join(' ')}" fill="none" stroke="${color}" />`)
      const dots = s.values
        .map((value, index) => (value === null ? '' : `<circle class="ts-chart-dot" cx="${positions[index].toFixed(1)}" cy="${scale.y(value).toFixed(1)}" r="2.8" fill="${color}" />`))
        .join('')
      seriesEls.push(`<g class="ts-chart-series">${dots}</g>`)
    }
  })

  return svgWrap(options, geo, `${parts.join('')}${seriesEls.join('')}`)
}

function renderPie(rows: Row[], options: ChartOptions, geo: Geometry): string {
  const cx = geo.width / 2
  const cy = geo.top + geo.plotHeight / 2
  const radius = Math.min(geo.plotWidth, geo.plotHeight) / 2 - 6
  const slices = pieSlices(rows, cx, cy, radius)
  if (slices.length === 0) return ''
  const parts = slices
    .map((slice, index) => {
      const color = PALETTE[index % PALETTE.length]
      const lx = cx + radius * 0.62 * Math.cos(slice.midAngle)
      const ly = cy + radius * 0.62 * Math.sin(slice.midAngle)
      return `<path class="ts-chart-slice" d="${slice.path}" fill="${color}" /><text class="ts-chart-pielabel" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${Math.round(slice.fraction * 100)}%</text>`
    })
    .join('')
  return svgWrap(options, geo, `<g class="ts-chart-series">${parts}</g>`)
}

function svgWrap(options: ChartOptions, geo: Geometry, body: string): string {
  return (
    `<svg class="ts-chart" viewBox="0 0 ${geo.width} ${geo.height}" role="img" ` +
    `aria-label="${escapeXml(options.title || 'Chart')}">` +
    `${options.title ? `<text class="ts-chart-title" x="${geo.left}" y="13">${escapeXml(options.title)}</text>` : ''}` +
    `${body}</svg>`
  )
}
