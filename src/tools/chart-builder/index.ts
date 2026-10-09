import { actions, button, checkbox, copyButton, field, note, panel, section, segmented, select, textField, textarea, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { download } from '../../core/ui'
import {
  analyzeGrid,
  buildDataset,
  CHART_TYPES,
  type ChartType,
  PALETTE,
  parseGrid,
  renderChart,
} from './chart'

const SAMPLE = `month,revenue,expenses
Jan,42,31
Feb,48,29
Mar,55,34
Apr,61,38
May,58,36
Jun,72,41`

/**
 * Series colours are remembered per browser. They are keyed by slot index
 * (series order, or pie-slice order), which is what the renderer uses, so a
 * saved palette lines up as long as the columns keep their order. A stored
 * value that is not a colour string is dropped rather than trusted.
 */
const COLORS_KEY = 'toolspace:chart-builder-colors'

function loadColors(): (string | null)[] {
  try {
    const raw = localStorage.getItem(COLORS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((value) => (typeof value === 'string' ? value : null))
  } catch {
    return []
  }
}

function saveColors(colors: (string | null)[]): void {
  try {
    const trimmed = colors.map((color) => (typeof color === 'string' ? color : null))
    while (trimmed.length && trimmed[trimmed.length - 1] == null) trimmed.pop()
    localStorage.setItem(COLORS_KEY, JSON.stringify(trimmed))
  } catch {
    /* private mode: colours still apply for this session */
  }
}

const tool: Tool = {
  slug: 'chart-builder',
  name: 'Chart Builder',
  description: 'Paste CSV, TSV, Markdown or JSON and turn it into a line, bar, area, scatter or pie chart you can download as SVG or PNG.',
  category: 'Data',
  keywords: ['chart', 'graph', 'plot', 'csv', 'svg', 'bar', 'line', 'pie', 'scatter', 'visualise', 'data', 'mermaid'],
  render(root) {
    let chartType: ChartType = 'line'
    let title = ''
    let showGrid = true
    let showLegend = true

    const input = textarea({ rows: 10, value: SAMPLE, onInput: () => { table = parseGrid(input.value); syncColumns(); render() } })

    const canvas = el('div', { class: 'ts-chart-canvas' })
    const empty = el('p', { class: 'ts-chart-empty' }, 'Paste a table to draw a chart.')
    const legendBox = el('div', { class: 'ts-chart-legend' })
    const previewRows = el('tbody')
    const previewHead = el('thead')
    const preview = el('table', { class: 'ts-chart-preview' }, previewHead, previewRows)

    const categorySelect = select({ options: [], onChange: (value) => { categoryIndex = Number(value); render() } })
    const valueList = el('div', { class: 'ts-chart-columns' })
    const valueBoxes: HTMLInputElement[] = []
    let valueIndices: number[] = []

    let table = parseGrid(SAMPLE)
    let categoryIndex = 0
    let hasHeader = true
    let svg = ''
    // Overrides, keyed by the slot index the renderer uses (series order, or
    // pie-slice order). A missing key means "use the palette colour".
    const colorOverrides: (string | null)[] = loadColors()

    function paletteFor(index: number): string {
      return PALETTE[index % PALETTE.length]
    }

    const typeControl = segmented({
      label: 'Chart type',
      value: chartType,
      items: CHART_TYPES,
      onChange: (value) => {
        chartType = value as ChartType
        render()
      },
    })

    function columnLabels(): string[] {
      const count = Math.max(table.header.length, ...table.rows.map((row) => row.length), 0)
      return Array.from({ length: count }, (_, index) => table.header[index]?.trim() || `Column ${index + 1}`)
    }

    function syncColumns() {
      const hints = analyzeGrid(table)
      hasHeader = hints.hasHeader
      const headerBox = headerToggle.querySelector('input') as HTMLInputElement | null
      if (headerBox) headerBox.checked = hasHeader

      categorySelect.replaceChildren(...columnLabels().map((label, index) => el('option', { value: String(index), selected: index === hints.categoryIndex }, label)))
      categoryIndex = hints.categoryIndex

      valueList.replaceChildren()
      valueBoxes.length = 0
      valueIndices = []
      columnLabels().forEach((label, index) => {
        if (index === categoryIndex) return
        const defaultOn = hints.numericIndices.includes(index)
        const box = el('input', { class: 'ts-k-check__box', type: 'checkbox', checked: defaultOn }) as HTMLInputElement
        if (defaultOn) valueIndices.push(index)
        box.addEventListener('change', () => {
          valueIndices = valueBoxes
            .filter((node) => node.checked)
            .map((node) => Number(node.dataset.index))
          render()
        })
        valueBoxes.push(box)
        box.dataset.index = String(index)
        valueList.append(el('label', { class: 'ts-chart-column' }, box, el('span', {}, label)))
      })
      if (valueIndices.length === 0) {
        const fallback = columnLabels().findIndex((_, index) => index !== categoryIndex)
        if (fallback >= 0 && valueBoxes[fallback]) {
          valueBoxes[fallback].checked = true
          valueIndices = [fallback]
        }
      }
    }

    function currentDataset() {
      return buildDataset(table, { categoryIndex, valueIndices, hasHeader })
    }

    function renderPreview() {
      const labels = columnLabels().slice(0, 6)
      previewHead.replaceChildren(el('tr', {}, ...labels.map((label) => el('th', {}, label))))
      previewRows.replaceChildren(
        ...table.rows.slice(0, 5).map((row) => el('tr', {}, ...labels.map((_, index) => el('td', {}, row[index] ?? '')))),
      )
    }

    function render() {
      renderPreview()
      const dataset = currentDataset()
      const colorItems = chartType === 'pie'
        ? dataset.categories.map((label, index) => ({ label, index }))
        : dataset.series.map((series, index) => ({ label: series.name, index }))
      svg = renderChart(dataset, { type: chartType, title, showLegend, showGrid, colors: colorOverrides })
      if (svg) {
        canvas.replaceChildren(el('div', { class: 'ts-chart-frame', innerHTML: svg }))
        empty.hidden = true
      } else {
        canvas.replaceChildren(empty)
        empty.hidden = false
      }
      renderColors(colorItems)
      const legendItems = chartType === 'pie'
        ? dataset.categories.map((label, index) => ({ label, index }))
        : dataset.series.map((series, index) => ({ label: series.name, index }))
      legendBox.replaceChildren(
        ...legendItems.map((item) => el('span', { class: 'ts-chart-legend__item' }, el('i', { class: 'ts-chart-swatch', style: `background:${colorOverrides[item.index] ?? paletteFor(item.index)}` }), item.label)),
      )
      legendBox.hidden = !showLegend || legendItems.length < 2
    }

    /**
     * One colour control per series (or pie slice). Changing a swatch redraws
     * the chart and the legend so the two never disagree.
     */
    function renderColors(items: { label: string; index: number }[]): void {
      colorList.replaceChildren(
        ...items.map((item) => {
          const value = colorOverrides[item.index] ?? paletteFor(item.index)
          const swatch = el('input', {
            class: 'ts-chart-color',
            type: 'color',
            value,
            'aria-label': `Colour for ${item.label}`,
          }) as HTMLInputElement
          swatch.addEventListener('input', () => {
            colorOverrides[item.index] = swatch.value
            saveColors(colorOverrides)
            render()
          })
          return el('label', { class: 'ts-chart-colorrow' }, swatch, el('span', {}, item.label))
        }),
      )
      resetColors.hidden = items.length === 0 || colorOverrides.every((color) => color === null || color === undefined)
    }

    function downloadSvg() {
      if (!svg) return
      download('chart.svg', svg, 'image/svg+xml')
    }

    function downloadPng() {
      if (!svg) return
      const image = new Image()
      image.onload = () => {
        const scale = 2
        const canvasEl = document.createElement('canvas')
        canvasEl.width = 720 * scale
        canvasEl.height = 420 * scale
        const context = canvasEl.getContext('2d')
        if (!context) return
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-soft').trim() || '#ffffff'
        context.fillRect(0, 0, canvasEl.width, canvasEl.height)
        context.drawImage(image, 0, 0, canvasEl.width, canvasEl.height)
        canvasEl.toBlob((blob) => {
          if (blob) download('chart.png', blob, 'image/png')
        }, 'image/png')
      }
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    }

    const gridToggle = checkbox({ label: 'Gridlines', checked: true, onChange: (checked) => { showGrid = checked; render() } })
    const legendToggle = checkbox({ label: 'Legend', checked: true, onChange: (checked) => { showLegend = checked; render() } })
    const headerToggle = checkbox({ label: 'First row is a header', checked: true, onChange: (checked) => { hasHeader = checked; render() } })

    const titleField = textField({ value: '', placeholder: 'Chart title', onInput: (value) => { title = value; render() } })

    const colorList = el('div', { class: 'ts-chart-colors' })
    const resetColors = el(
      'button',
      {
        type: 'button',
        class: 'ts-k-button ts-chart-resetcolors',
        onclick: () => {
          colorOverrides.length = 0
          saveColors(colorOverrides)
          render()
        },
      },
      'Reset colours',
    ) as HTMLButtonElement

    const fileInput = el('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', class: 'ts-chart-file' }) as HTMLInputElement
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      input.value = await file.text()
      table = parseGrid(input.value)
      syncColumns()
      render()
    })

    syncColumns()
    render()

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Data', icon: 'table' },
          field(input, { label: 'Paste CSV, TSV, Markdown or JSON' }),
          actions(
            el('label', { class: 'ts-k-button ts-chart-filelabel' }, 'Load a file', fileInput),
            button('Load sample', { icon: 'refresh', onClick: () => { input.value = SAMPLE; table = parseGrid(input.value); syncColumns(); render() } }),
          ),
          el('div', { class: 'ts-chart-hasheader' }, headerToggle),
          preview,
        ),
        panel(
          { title: 'Chart', icon: 'chart' },
          typeControl,
          field(titleField, { label: 'Title' }),
          el('div', { class: 'ts-chart-options' }, gridToggle, legendToggle),
          el('div', { class: 'ts-k-grid ts-chart-config' },
            field(categorySelect, { label: 'Category (x-axis)' }),
            field(valueList, { label: 'Series (y-axis)' }),
          ),
          field(colorList, { label: 'Series colours' }),
          el('div', { class: 'ts-chart-colorfoot' }, resetColors),
          actions(
            copyButton(() => svg, { label: 'Copy SVG', size: 'sm' }),
            button('Download SVG', { icon: 'download', onClick: downloadSvg }),
            button('Download PNG', { variant: 'primary', icon: 'download', onClick: downloadPng }),
          ),
          canvas,
          legendBox,
        ),
        section(
          'About this tool',
          note('Everything is drawn locally with SVG — no chart library, no network, nothing leaves the tab. Handles CSV, TSV, semicolon and pipe tables, Markdown tables and JSON arrays of objects (converted to a grid first). Series colours are remembered in this browser.'),
        ),
      ),
    )
  },
}

export default tool
