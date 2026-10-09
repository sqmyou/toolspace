import { describe, expect, it } from 'vitest'
import {
  analyzeGrid,
  bandPositions,
  buildDataset,
  escapeXml,
  geometry,
  makeScale,
  niceCeil,
  niceFloor,
  parseGrid,
  pieSlices,
  PALETTE,
  renderChart,
  sniffDelimiter,
  splitLine,
} from './chart'

describe('splitLine', () => {
  it('splits on the delimiter', () => {
    expect(splitLine('a,b,c', ',')).toEqual(['a', 'b', 'c'])
  })

  it('keeps a quoted delimiter inside one cell', () => {
    expect(splitLine('"a,b",c', ',')).toEqual(['a,b', 'c'])
  })

  it('unescapes doubled quotes', () => {
    expect(splitLine('"he said ""hi""",x', ',')).toEqual(['he said "hi"', 'x'])
  })

  it('swallows the rest of an unclosed quote', () => {
    expect(splitLine('a,"b,c', ',')).toEqual(['a', 'b,c'])
  })
})

describe('sniffDelimiter', () => {
  it('picks comma for comma-separated text', () => {
    expect(sniffDelimiter('a,b,c\nd,e,f')).toBe(',')
  })

  it('picks tab for tab-separated text', () => {
    expect(sniffDelimiter('a\tb\tc')).toBe('\t')
  })

  it('defaults to comma when there is no delimiter', () => {
    expect(sniffDelimiter('single')).toBe(',')
  })
})

describe('parseGrid', () => {
  it('takes the first row as the header and drops blank lines', () => {
    const table = parseGrid('fruit,qty\napple,3\n\npear,5\n')
    expect(table.header).toEqual(['fruit', 'qty'])
    expect(table.rows).toEqual([['apple', '3'], ['pear', '5']])
  })

  it('is empty for empty input', () => {
    expect(parseGrid('   ')).toEqual({ header: [], rows: [] })
  })

  it('reads a JSON array of objects into header and rows', () => {
    const table = parseGrid('[{"month":"Jan","revenue":10},{"month":"Feb","revenue":20}]')
    expect(table.header).toEqual(['month', 'revenue'])
    expect(table.rows).toEqual([['Jan', '10'], ['Feb', '20']])
  })

  it('reads a JSON array of arrays', () => {
    const table = parseGrid('[["m","v"],["Jan",10],["Feb",20]]')
    expect(table.header).toEqual(['m', 'v'])
    expect(table.rows).toEqual([['Jan', '10'], ['Feb', '20']])
  })

  it('falls back to CSV when the JSON is malformed', () => {
    const table = parseGrid('[not json\na,b\n1,2')
    expect(table.header).toEqual(['[not json'])
    expect(table.rows).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('analyzeGrid', () => {
  it('finds the text column as categories and the numeric columns as series', () => {
    const table = parseGrid('month,revenue,cost\nJan,10,4\nFeb,20,8\nMar,30,12')
    const hints = analyzeGrid(table)
    expect(hints.categoryIndex).toBe(0)
    expect(hints.numericIndices).toEqual([1, 2])
    expect(hints.hasHeader).toBe(true)
  })

  it('treats an all-numeric first row as data, not a header', () => {
    const table = parseGrid('1,2\n3,4')
    const hints = analyzeGrid(table)
    expect(hints.hasHeader).toBe(false)
  })
})

describe('buildDataset', () => {
  it('builds categories and named series from chosen columns', () => {
    const table = parseGrid('month,revenue,cost\nJan,10,4\nFeb,20,8')
    const data = buildDataset(table, { categoryIndex: 0, valueIndices: [1, 2], hasHeader: true })
    expect(data.categories).toEqual(['Jan', 'Feb'])
    expect(data.series.map((s) => s.name)).toEqual(['revenue', 'cost'])
    expect(data.series[0].values).toEqual([10, 20])
  })

  it('uses the first row as data when there is no header', () => {
    const table = parseGrid('1,2\n3,4')
    const data = buildDataset(table, { categoryIndex: 0, valueIndices: [1], hasHeader: false })
    expect(data.categories).toEqual(['1', '3'])
    expect(data.series[0].values).toEqual([2, 4])
  })

  it('turns unparseable cells, percents and thousands separators into numbers', () => {
    const table = parseGrid('k,v\na,"1,200"\nb,50%\nc,dash')
    const data = buildDataset(table, { categoryIndex: 0, valueIndices: [1], hasHeader: true })
    expect(data.series[0].values).toEqual([1200, 50, null])
  })
})

describe('niceCeil / niceFloor', () => {
  it('rounds maxima up to a friendly tick', () => {
    expect(niceCeil(87)).toBe(100)
    expect(niceCeil(23)).toBe(25)
    expect(niceCeil(4)).toBe(5)
    expect(niceCeil(1)).toBe(1)
    expect(niceCeil(0)).toBe(1)
  })

  it('rounds negative minima down to a friendly tick', () => {
    expect(niceFloor(-37)).toBe(-50)
    expect(niceFloor(5)).toBe(0)
  })
})

describe('makeScale', () => {
  it('maps the maximum to the top of the plot and zero to the bottom', () => {
    const geo = geometry(720, 420)
    const scale = makeScale([0, 50, 100], geo)
    expect(scale.max).toBe(100)
    expect(scale.y(100)).toBeCloseTo(geo.top, 6)
    expect(scale.y(0)).toBeCloseTo(geo.top + geo.plotHeight, 6)
  })

  it('handles a flat all-zero series without dividing by zero', () => {
    const geo = geometry()
    const scale = makeScale([0, 0, 0], geo)
    expect(scale.max).toBe(1)
    expect(Number.isFinite(scale.y(0))).toBe(true)
  })

  it('produces one more tick than intervals', () => {
    expect(makeScale([0, 10], geometry(), 5).ticks).toHaveLength(6)
  })
})

describe('bandPositions', () => {
  it('centres each category in an equal slot', () => {
    const geo = geometry(720, 420)
    const { positions, band } = bandPositions(4, geo)
    expect(band).toBeCloseTo(geo.plotWidth / 4, 6)
    expect(positions[0]).toBeCloseTo(geo.left + band / 2, 6)
    expect(positions[3]).toBeCloseTo(geo.left + band * 3.5, 6)
  })

  it('does not divide by zero for no categories', () => {
    const { positions, band } = bandPositions(0, geometry())
    expect(positions).toEqual([])
    expect(Number.isFinite(band)).toBe(true)
  })
})

describe('pieSlices', () => {
  it('splits a whole into fractions of the circle', () => {
    const slices = pieSlices([{ label: 'a', value: 1 }, { label: 'b', value: 3 }], 100, 100, 50)
    expect(slices).toHaveLength(2)
    expect(slices[0].fraction).toBeCloseTo(0.25, 6)
    expect(slices[1].fraction).toBeCloseTo(0.75, 6)
  })

  it('returns nothing when the total is zero', () => {
    expect(pieSlices([{ label: 'a', value: 0 }], 100, 100, 50)).toEqual([])
  })
})

describe('escapeXml', () => {
  it('neutralises markup characters', () => {
    expect(escapeXml('<script>"x" & \'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;')
  })
})

describe('renderChart', () => {
  const data = buildDataset(parseGrid('m,v\nJan,10\nFeb,20\nMar,30'), { categoryIndex: 0, valueIndices: [1], hasHeader: true })

  it('emits an SVG with a polyline for a line chart', () => {
    const svg = renderChart(data, { type: 'line', title: 'Revenue', showLegend: true, showGrid: true })
    expect(svg).toContain('<svg')
    expect(svg).toContain('polyline')
    expect(svg).toContain('Revenue')
  })

  it('emits rectangles for a bar chart', () => {
    expect(renderChart(data, { type: 'bar', title: '', showLegend: true, showGrid: true })).toContain('<rect')
  })

  it('emits slice paths for a pie chart', () => {
    const svg = renderChart(data, { type: 'pie', title: '', showLegend: true, showGrid: false })
    expect(svg).toContain('ts-chart-slice')
  })

  it('escapes a title so it cannot inject markup', () => {
    const svg = renderChart(data, { type: 'line', title: '<img src=x>', showLegend: true, showGrid: true })
    expect(svg).not.toContain('<img src=x>')
    expect(svg).toContain('&lt;img src=x&gt;')
  })

  it('is empty when there is nothing to draw', () => {
    expect(renderChart({ categories: [], series: [] }, { type: 'line', title: '', showLegend: true, showGrid: true })).toBe('')
  })

  it('omits gridlines when the grid is off', () => {
    const svg = renderChart(data, { type: 'line', title: '', showLegend: true, showGrid: false })
    expect(svg).not.toContain('ts-chart-grid')
  })

  it('uses a custom colour for a series', () => {
    const svg = renderChart(data, { type: 'line', title: '', showLegend: true, showGrid: true, colors: ['#123456'] })
    expect(svg).toContain('#123456')
    expect(svg).not.toContain(PALETTE[0])
  })

  it('falls back to the palette when an override is null or invalid', () => {
    const svg = renderChart(data, { type: 'bar', title: '', showLegend: true, showGrid: true, colors: [null] })
    expect(svg).toContain(PALETTE[0])
    const bad = renderChart(data, { type: 'bar', title: '', showLegend: true, showGrid: true, colors: ['red; background:url(x)'] })
    expect(bad).toContain(PALETTE[0])
    expect(bad).not.toContain('url(')
  })

  it('colours pie slices from the override index', () => {
    const svg = renderChart(data, { type: 'pie', title: '', showLegend: true, showGrid: false, colors: [null, '#000000'] })
    expect(svg).toContain('#000000')
    expect(svg).toContain(PALETTE[0])
  })
})
